import { FastifyRequest, FastifyReply } from 'fastify';
import * as orderService from '../services/order.service';
import * as productService from '../services/product.service';
import { handleError, notFound, badRequest, forbidden } from '../utils/errors';
import { UserRole, OrderType, OrderStatus } from '../types';

// Get all orders
export async function getAllOrders(
  request: FastifyRequest<{ Querystring: { status?: OrderStatus; type?: OrderType } }>,
  reply: FastifyReply
) {
  try {
    const { status, type } = request.query;
    
    // Only admins and franchise owners can see all orders
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER].includes(request.user.role)) {
      throw forbidden('You are not authorized to view all orders');
    }
    
    const orders = await orderService.getAllOrders(status, type, request.user);
    return reply.code(200).send({ orders });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get orders for the current user
export async function getUserOrders(
  request: FastifyRequest<{ Querystring: { status?: OrderStatus; type?: OrderType } }>,
  reply: FastifyReply
) {
  try {
    const { status, type } = request.query;
    const userId = request.user.userId;
    
    const orders = await orderService.getUserOrders(userId, status, type);
    return reply.code(200).send({ orders });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get order by ID
export async function getOrderById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const order = await orderService.getOrderById(id);
    
    if (!order) {
      throw notFound('Order');
    }
    
    // Check if user has permission to view this order
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      request.user.role === UserRole.FRANCHISE_OWNER || 
      order.customerId === request.user.userId ||
      (request.user.role === UserRole.SERVICE_AGENT && order.serviceAgentId === request.user.userId);
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to view this order');
    }
    
    return reply.code(200).send({ order });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Create a new order
export async function createOrder(
  request: FastifyRequest<{ 
    Body: { 
      productId: string;
      type: OrderType;
      installationDate?: string;
    } 
  }>,
  reply: FastifyReply
) {
  try {
    const { productId, type, installationDate } = request.body;
    const customerId = request.user.userId;
    
    // Validate product
    const product = await productService.getProductById(productId);
    if (!product) {
      throw notFound('Product');
    }
    
    // Check if product can be purchased/rented based on order type
    if (type === OrderType.PURCHASE && !product.isPurchasable) {
      throw badRequest('This product is not available for purchase');
    }
    
    if (type === OrderType.RENTAL && !product.isRentable) {
      throw badRequest('This product is not available for rent');
    }
    
    // Create the order
    const order = await orderService.createOrder({
      productId,
      customerId,
      type,
      installationDate: installationDate ? new Date(installationDate) : undefined
    });
    
    return reply.code(201).send({ 
      message: 'Order created successfully',
      order 
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update order status
export async function updateOrderStatus(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { status: OrderStatus } 
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { status } = request.body;
    
    // Only admins, franchise owners or service agents can update order status
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT].includes(request.user.role)) {
      throw forbidden('You are not authorized to update order status');
    }
    
    const order = await orderService.updateOrderStatus(id, status, request.user);
    
    return reply.code(200).send({ 
      message: 'Order status updated successfully',
      order 
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Assign service agent to order
export async function assignServiceAgent(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { serviceAgentId: string } 
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { serviceAgentId } = request.body;
    
    // Only admins and franchise owners can assign service agents
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER].includes(request.user.role)) {
      throw forbidden('You are not authorized to assign service agents');
    }
    
    const order = await orderService.assignServiceAgent(id, serviceAgentId, request.user);
    
    return reply.code(200).send({ 
      message: 'Service agent assigned successfully',
      order 
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update installation date
export async function updateInstallationDate(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { installationDate: string } 
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { installationDate } = request.body;
    
    // Only admins, franchise owners or assigned service agents can update installation date
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT].includes(request.user.role)) {
      throw forbidden('You are not authorized to update installation date');
    }
    
    const order = await orderService.updateInstallationDate(
      id, 
      new Date(installationDate),
      request.user
    );
    
    return reply.code(200).send({ 
      message: 'Installation date updated successfully',
      order 
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Cancel an order
export async function cancelOrder(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    
    const order = await orderService.getOrderById(id);
    if (!order) {
      throw notFound('Order');
    }
    
    // Check if user has permission to cancel this order
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      (order.customerId === request.user.userId && 
        [OrderStatus.CREATED, OrderStatus.PAYMENT_PENDING].includes(order.status));
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to cancel this order');
    }
    
    const updatedOrder = await orderService.updateOrderStatus(id, OrderStatus.CANCELLED, request.user);
    
    return reply.code(200).send({ 
      message: 'Order cancelled successfully',
      order: updatedOrder
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Create payment for order
export async function initiatePayment(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { paymentType?: string } 
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { paymentType } = request.body;
    
    const order = await orderService.getOrderById(id);
    if (!order) {
      throw notFound('Order');
    }
    
    // Only the customer or admin can initiate payment
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      order.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to make payment for this order');
    }
    
    const paymentInfo = await orderService.initiatePayment(id);
    
    return reply.code(200).send({ 
      message: 'Payment initiated',
      paymentInfo
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Verify payment and update order status
export async function verifyPayment(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { 
      razorpayPaymentId: string;
      razorpayOrderId: string;
      razorpaySignature: string;
    } 
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = request.body;
    
    const paymentVerified = await orderService.verifyPayment(
      id, 
      razorpayPaymentId, 
      razorpayOrderId, 
      razorpaySignature
    );
    
    if (paymentVerified) {
      return reply.code(200).send({ 
        message: 'Payment verified successfully',
        success: true
      });
    } else {
      throw badRequest('Payment verification failed');
    }
  } catch (error) {
    handleError(error, request, reply);
  }
}