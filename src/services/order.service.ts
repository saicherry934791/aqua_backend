import { FastifyInstance } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import { orders, payments, users, products, rentals, franchiseAreas } from '../models/schema';
import * as userService from './user.service';
import * as franchiseService from './franchise.service';
import * as notificationService from './notification.service';
import { OrderType, OrderStatus, PaymentStatus, PaymentType, User, NotificationType, NotificationChannel, UserRole } from '../types';
import { generateId } from '../utils/helpers';
import { notFound, badRequest, serverError } from '../utils/errors';
import crypto from 'crypto';

// Get all orders
export async function getAllOrders(status?: OrderStatus, type?: OrderType, user?: User) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  let query = fastify.db.query.orders.findMany({
    with: {
      customer: true,
      product: true,
      serviceAgent: true,
    }
  });

  let results;
  
  // Apply filters based on user role and parameters
  if (user && user.role === UserRole.FRANCHISE_OWNER) {
    if (!user.franchiseAreaId) {
      return []; // No franchise area assigned
    }
    
    // Get all customers in this franchise area
    const customersInArea = await fastify.db.query.users.findMany({
      where: eq(users.franchiseAreaId, user.franchiseAreaId),
    });
    
    const customerIds = customersInArea.map(customer => customer.id);
    
    results = await fastify.db.query.orders.findMany({
      where: (orders) => {
        let conditions = inArray(orders.customerId, customerIds);
        
        if (status) {
          conditions = and(conditions, eq(orders.status, status));
        }
        
        if (type) {
          conditions = and(conditions, eq(orders.type, type));
        }
        
        return conditions;
      },
      with: {
        customer: true,
        product: true,
        serviceAgent: true,
      },
    });
  } else {
    // Build the query based on filters
    let conditions = undefined;
    
    if (status) {
      conditions = eq(fastify.db.query.orders.status, status);
    }
    
    if (type) {
      conditions = conditions 
        ? and(conditions, eq(fastify.db.query.orders.type, type)) 
        : eq(fastify.db.query.orders.type, type);
    }
    
    // Apply the filters
    results = conditions 
      ? await fastify.db.query.orders.findMany({
          where: conditions,
          with: {
            customer: true,
            product: true,
            serviceAgent: true,
          },
        }) 
      : await fastify.db.query.orders.findMany({
          with: {
            customer: true,
            product: true,
            serviceAgent: true,
          },
        });
  }
  
  return results;
}

// Get orders for a specific user
export async function getUserOrders(userId: string, status?: OrderStatus, type?: OrderType) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  let conditions = eq(fastify.db.query.orders.customerId, userId);
  
  if (status) {
    conditions = and(conditions, eq(fastify.db.query.orders.status, status));
  }
  
  if (type) {
    conditions = and(conditions, eq(fastify.db.query.orders.type, type));
  }
  
  const results = await fastify.db.query.orders.findMany({
    where: conditions,
    with: {
      product: true,
      serviceAgent: true,
    },
  });
  
  return results;
}

// Get order by ID
export async function getOrderById(id: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const result = await fastify.db.query.orders.findFirst({
    where: eq(fastify.db.query.orders.id, id),
    with: {
      customer: true,
      product: true,
      serviceAgent: true,
      payments: true,
    },
  });

  return result;
}

// Create a new order
export async function createOrder(data: {
  productId: string;
  customerId: string;
  type: OrderType;
  installationDate?: Date;
}) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  // Get product info to calculate total amount
  const product = await fastify.db.query.products.findFirst({
    where: eq(fastify.db.query.products.id, data.productId),
  });
  
  if (!product) {
    throw notFound('Product');
  }
  
  // Get customer info to determine franchise area
  const customer = await userService.getUserById(data.customerId);
  if (!customer) {
    throw notFound('Customer');
  }
  
  // Find franchise area if not already assigned to the customer
  let franchiseAreaId = customer.franchiseAreaId;
  if (!franchiseAreaId && customer.location) {
    franchiseAreaId = await franchiseService.findFranchiseAreaForLocation(customer.location);
  }
  
  if (!franchiseAreaId) {
    throw badRequest('No franchise area available for this location');
  }
  
  const orderId = generateId('ord');
  
  // Calculate total amount based on order type
  const totalAmount = data.type === OrderType.PURCHASE 
    ? product.buyPrice 
    : product.deposit; // For rentals, initial payment is the deposit amount
  
  // Create the order
  await fastify.db.insert(orders).values({
    id: orderId,
    customerId: data.customerId,
    productId: data.productId,
    type: data.type,
    status: OrderStatus.CREATED,
    totalAmount,
    paymentStatus: PaymentStatus.PENDING,
    installationDate: data.installationDate?.toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  // Send notification to customer
  try {
    await fastify.notification.send(
      data.customerId,
      'New Order Created',
      `Your order for ${product.name} has been created. Please proceed to payment.`,
      NotificationType.ORDER_CONFIRMATION,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      orderId,
      'order'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  const createdOrder = await getOrderById(orderId);
  
  // Create payment record
  if (data.type === OrderType.RENTAL) {
    // For rentals, create deposit payment record
    await fastify.db.insert(payments).values({
      id: generateId('pay'),
      orderId,
      amount: product.deposit,
      type: PaymentType.DEPOSIT,
      status: PaymentStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    // For purchases, create purchase payment record
    await fastify.db.insert(payments).values({
      id: generateId('pay'),
      orderId,
      amount: product.buyPrice,
      type: PaymentType.PURCHASE,
      status: PaymentStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  
  return createdOrder;
}

// Update order status
export async function updateOrderStatus(id: string, status: OrderStatus, user: { userId: string; role: UserRole; franchiseAreaId?: string }) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const order = await getOrderById(id);
  if (!order) {
    throw notFound('Order');
  }
  
  // Check if user has permission based on role
  if (user.role === UserRole.SERVICE_AGENT && order.serviceAgentId !== user.userId) {
    throw badRequest('You are not assigned to this order');
  }
  
  if (user.role === UserRole.FRANCHISE_OWNER) {
    // Check if order is in the franchise owner's area
    const customer = await userService.getUserById(order.customerId);
    if (!customer || customer.franchiseAreaId !== user.franchiseAreaId) {
      throw badRequest('This order is not in your franchise area');
    }
  }
  
  // Update the order status
  await fastify.db
    .update(orders)
    .set({ 
      status, 
      updatedAt: new Date().toISOString() 
    })
    .where(eq(orders.id, id));
  
  // Send notification to customer
  try {
    await fastify.notification.send(
      order.customerId,
      'Order Status Updated',
      `Your order status has been updated to ${status}.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'order'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  // If the order is installed and it's a rental, create rental record
  if (status === OrderStatus.INSTALLED && order.type === OrderType.RENTAL) {
    await createRentalFromOrder(id);
  }
  
  return getOrderById(id);
}

// Assign service agent to order
export async function assignServiceAgent(id: string, serviceAgentId: string, user: { userId: string; role: UserRole; franchiseAreaId?: string }) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const order = await getOrderById(id);
  if (!order) {
    throw notFound('Order');
  }
  
  // Validate that service agent exists and is active
  const serviceAgent = await userService.getUserById(serviceAgentId);
  if (!serviceAgent || !serviceAgent.isActive || serviceAgent.role !== UserRole.SERVICE_AGENT) {
    throw badRequest('Invalid service agent');
  }
  
  // Check if assignment is within the same franchise area
  if (user.role === UserRole.FRANCHISE_OWNER) {
    if (serviceAgent.franchiseAreaId !== user.franchiseAreaId) {
      throw badRequest('Service agent is not in your franchise area');
    }
    
    // Also check if the order is in this franchise area
    const customer = await userService.getUserById(order.customerId);
    if (!customer || customer.franchiseAreaId !== user.franchiseAreaId) {
      throw badRequest('This order is not in your franchise area');
    }
  }
  
  // Update the order
  await fastify.db
    .update(orders)
    .set({ 
      serviceAgentId, 
      status: OrderStatus.ASSIGNED,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(orders.id, id));
  
  // Send notifications
  try {
    // Notify customer
    await fastify.notification.send(
      order.customerId,
      'Service Agent Assigned',
      `A service agent has been assigned to your order.`,
      NotificationType.ASSIGNMENT_NOTIFICATION,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'order'
    );
    
    // Notify service agent
    await fastify.notification.send(
      serviceAgentId,
      'New Order Assignment',
      `You have been assigned to a new order.`,
      NotificationType.ASSIGNMENT_NOTIFICATION,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'order'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  return getOrderById(id);
}

// Update installation date
export async function updateInstallationDate(id: string, installationDate: Date, user: { userId: string; role: UserRole; franchiseAreaId?: string }) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const order = await getOrderById(id);
  if (!order) {
    throw notFound('Order');
  }
  
  // Check permissions
  if (user.role === UserRole.SERVICE_AGENT && order.serviceAgentId !== user.userId) {
    throw badRequest('You are not assigned to this order');
  }
  
  if (user.role === UserRole.FRANCHISE_OWNER) {
    // Check if order is in the franchise owner's area
    const customer = await userService.getUserById(order.customerId);
    if (!customer || customer.franchiseAreaId !== user.franchiseAreaId) {
      throw badRequest('This order is not in your franchise area');
    }
  }
  
  // Update the order
  await fastify.db
    .update(orders)
    .set({ 
      installationDate: installationDate.toISOString(), 
      updatedAt: new Date().toISOString() 
    })
    .where(eq(orders.id, id));
  
  // Send notification to customer
  try {
    await fastify.notification.send(
      order.customerId,
      'Installation Date Updated',
      `Your installation date has been scheduled for ${installationDate.toLocaleDateString()}.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'order'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  return getOrderById(id);
}

// Initiate payment for an order
export async function initiatePayment(orderId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const order = await getOrderById(orderId);
  if (!order) {
    throw notFound('Order');
  }
  
  // Check if payment is already completed
  if (order.paymentStatus === PaymentStatus.COMPLETED) {
    throw badRequest('Payment for this order has already been completed');
  }
  
  // Create Razorpay order
  const razorpayOrder = await fastify.razorpay.orders.create({
    amount: order.totalAmount * 100, // Amount in paise
    currency: 'INR',
    receipt: orderId,
    notes: {
      orderType: order.type,
      productName: order.product.name,
      customerId: order.customerId
    }
  });
  
  // Update payment record with Razorpay order ID
  await fastify.db
    .update(payments)
    .set({ 
      razorpayOrderId: razorpayOrder.id,
      updatedAt: new Date().toISOString() 
    })
    .where(and(
      eq(payments.orderId, orderId),
      eq(payments.status, PaymentStatus.PENDING)
    ));
  
  // Update order status to payment pending
  await fastify.db
    .update(orders)
    .set({ 
      status: OrderStatus.PAYMENT_PENDING,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(orders.id, orderId));
  
  // Return payment information for frontend
  return {
    orderId,
    razorpayOrderId: razorpayOrder.id,
    amount: order.totalAmount * 100, // in paise
    currency: 'INR',
    productName: order.product.name,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerPhone: order.customer.phone
  };
}

// Verify payment
export async function verifyPayment(
  orderId: string, 
  razorpayPaymentId: string, 
  razorpayOrderId: string, 
  razorpaySignature: string
): Promise<boolean> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const order = await getOrderById(orderId);
  if (!order) {
    throw notFound('Order');
  }
  
  // Get the payment record
  const payment = await fastify.db.query.payments.findFirst({
    where: and(
      eq(fastify.db.query.payments.orderId, orderId),
      eq(fastify.db.query.payments.razorpayOrderId, razorpayOrderId)
    )
  });
  
  if (!payment) {
    throw notFound('Payment record');
  }
  
  // Verify the signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw serverError('Razorpay key not configured');
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    
    const isVerified = expectedSignature === razorpaySignature;
    
    if (isVerified) {
      // Update payment status
      await fastify.db
        .update(payments)
        .set({ 
          razorpayPaymentId,
          status: PaymentStatus.COMPLETED,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(payments.id, payment.id));
      
      // Update order status
      await fastify.db
        .update(orders)
        .set({ 
          paymentStatus: PaymentStatus.COMPLETED,
          status: OrderStatus.PAYMENT_COMPLETED,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(orders.id, orderId));
      
      // Send notification to customer
      try {
        await fastify.notification.send(
          order.customerId,
          'Payment Successful',
          `Your payment for order #${orderId} has been received successfully.`,
          NotificationType.PAYMENT_SUCCESS,
          [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          orderId,
          'order'
        );
      } catch (error) {
        fastify.log.error(`Failed to send notification: ${error}`);
      }
      
      return true;
    } else {
      // Send notification about failed payment
      try {
        await fastify.notification.send(
          order.customerId,
          'Payment Failed',
          `Your payment for order #${orderId} could not be verified.`,
          NotificationType.PAYMENT_FAILURE,
          [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          orderId,
          'order'
        );
      } catch (error) {
        fastify.log.error(`Failed to send notification: ${error}`);
      }
      
      return false;
    }
  } catch (error) {
    fastify.log.error(`Payment verification error: ${error}`);
    return false;
  }
}

// Create rental record from a completed order
async function createRentalFromOrder(orderId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const order = await getOrderById(orderId);
  if (!order || order.type !== OrderType.RENTAL) {
    return null;
  }
  
  const product = await fastify.db.query.products.findFirst({
    where: eq(fastify.db.query.products.id, order.productId),
  });
  
  if (!product) {
    return null;
  }
  
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  // Create rental record
  const rentalId = generateId('rent');
  await fastify.db.insert(rentals).values({
    id: rentalId,
    orderId: order.id,
    customerId: order.customerId,
    productId: order.productId,
    startDate: now.toISOString(),
    currentPeriodStartDate: now.toISOString(),
    currentPeriodEndDate: nextMonth.toISOString(),
    monthlyAmount: product.rentPrice,
    depositAmount: product.deposit,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  
  // Send notification to customer
  try {
    await fastify.notification.send(
      order.customerId,
      'Rental Started',
      `Your rental for ${product.name} has been activated. The first payment period is from ${now.toLocaleDateString()} to ${nextMonth.toLocaleDateString()}.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      rentalId,
      'rental'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  return rentalId;
}