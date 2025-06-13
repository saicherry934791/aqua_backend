import { FastifyInstance } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import { rentals, orders, payments, users, products } from '../models/schema';
import * as userService from './user.service';
import * as notificationService from './notification.service';
import { RentalStatus, UserRole, PaymentStatus, PaymentType, User, NotificationType, NotificationChannel } from '../types';
import { generateId } from '../utils/helpers';
import { notFound, badRequest, serverError } from '../utils/errors';
import crypto from 'crypto';

// Get all rentals
export async function getAllRentals(status?: RentalStatus, user?: User) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  let query = fastify.db.query.rentals.findMany({
    with: {
      customer: true,
      product: true
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
    
    results = await fastify.db.query.rentals.findMany({
      where: (rentals) => {
        let conditions = inArray(rentals.customerId, customerIds);
        
        if (status) {
          conditions = and(conditions, eq(rentals.status, status));
        }
        
        return conditions;
      },
      with: {
        customer: true,
        product: true
      },
    });
  } else {
    // Apply status filter if provided
    if (status) {
      results = await fastify.db.query.rentals.findMany({
        where: eq(fastify.db.query.rentals.status, status),
        with: {
          customer: true,
          product: true
        }
      });
    } else {
      results = await fastify.db.query.rentals.findMany({
        with: {
          customer: true,
          product: true
        }
      });
    }
  }
  
  return results;
}

// Get rentals for a specific user
export async function getUserRentals(userId: string, status?: RentalStatus) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  let conditions = eq(fastify.db.query.rentals.customerId, userId);
  
  if (status) {
    conditions = and(conditions, eq(fastify.db.query.rentals.status, status));
  }
  
  const results = await fastify.db.query.rentals.findMany({
    where: conditions,
    with: {
      product: true
    },
  });
  
  return results;
}

// Get rental by ID
export async function getRentalById(id: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const result = await fastify.db.query.rentals.findFirst({
    where: eq(fastify.db.query.rentals.id, id),
    with: {
      customer: true,
      product: true,
    },
  });

  return result;
}

// Update rental status
export async function updateRentalStatus(id: string, status: RentalStatus) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const rental = await getRentalById(id);
  if (!rental) {
    throw notFound('Rental');
  }
  
  const now = new Date();
  
  // Update the rental status
  const updateData: any = {
    status, 
    updatedAt: now.toISOString()
  };
  
  if (status === RentalStatus.PAUSED) {
    updateData.pausedAt = now.toISOString();
  } else if (status === RentalStatus.ACTIVE && rental.pausedAt) {
    // Adjust the period end date based on the pause duration
    const pausedAt = new Date(rental.pausedAt);
    const currentEndDate = new Date(rental.currentPeriodEndDate);
    const pauseDuration = now.getTime() - pausedAt.getTime();
    
    const newEndDate = new Date(currentEndDate.getTime() + pauseDuration);
    updateData.currentPeriodEndDate = newEndDate.toISOString();
    updateData.pausedAt = null; // Reset the pausedAt
  }
  
  await fastify.db
    .update(rentals)
    .set(updateData)
    .where(eq(rentals.id, id));
  
  const updatedRental = await getRentalById(id);
  
  // Send notification to customer
  try {
    await fastify.notification.send(
      rental.customerId,
      `Rental ${status === RentalStatus.PAUSED ? 'Paused' : 'Resumed'}`,
      `Your rental for ${rental.product.name} has been ${status === RentalStatus.PAUSED ? 'paused' : 'resumed'}.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'rental'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  return updatedRental;
}

// Terminate rental
export async function terminateRental(id: string, terminationReason?: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const rental = await getRentalById(id);
  if (!rental) {
    throw notFound('Rental');
  }
  
  // Update the rental status
  await fastify.db
    .update(rentals)
    .set({ 
      status: RentalStatus.TERMINATED, 
      endDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .where(eq(rentals.id, id));
  
  const updatedRental = await getRentalById(id);
  
  // Send notification to customer
  try {
    await fastify.notification.send(
      rental.customerId,
      'Rental Terminated',
      `Your rental for ${rental.product.name} has been terminated.${terminationReason ? ` Reason: ${terminationReason}` : ''}`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'rental'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }
  
  // Create service request for pickup
  // This functionality would be implemented in a separate service
  
  return updatedRental;
}

// Initiate renewal payment
export async function initiateRenewalPayment(rentalId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const rental = await getRentalById(rentalId);
  if (!rental) {
    throw notFound('Rental');
  }
  
  if (rental.status !== RentalStatus.ACTIVE) {
    throw badRequest('Only active rentals can be renewed');
  }
  
  // Create a payment record for the renewal
  const paymentId = generateId('pay');
  
  await fastify.db.insert(payments).values({
    id: paymentId,
    orderId: rental.orderId,
    amount: rental.monthlyAmount,
    type: PaymentType.RENTAL,
    status: PaymentStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  // Create Razorpay order
  const razorpayOrder = await fastify.razorpay.orders.create({
    amount: rental.monthlyAmount * 100, // Amount in paise
    currency: 'INR',
    receipt: paymentId,
    notes: {
      rentalId: rental.id,
      productName: rental.product.name,
      customerId: rental.customerId
    }
  });
  
  // Update payment record with Razorpay order ID
  await fastify.db
    .update(payments)
    .set({ 
      razorpayOrderId: razorpayOrder.id,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(payments.id, paymentId));
  
  // Return payment information for frontend
  return {
    rentalId,
    paymentId,
    razorpayOrderId: razorpayOrder.id,
    amount: rental.monthlyAmount * 100, // in paise
    currency: 'INR',
    productName: rental.product.name
  };
}

// Verify renewal payment
export async function verifyRenewalPayment(
  rentalId: string, 
  razorpayPaymentId: string, 
  razorpayOrderId: string, 
  razorpaySignature: string
): Promise<boolean> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const rental = await getRentalById(rentalId);
  if (!rental) {
    throw notFound('Rental');
  }
  
  // Get the payment record
  const payment = await fastify.db.query.payments.findFirst({
    where: and(
      eq(fastify.db.query.payments.orderId, rental.orderId),
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
      
      // Extend the rental period
      const currentEndDate = new Date(rental.currentPeriodEndDate);
      const newStartDate = new Date(currentEndDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      
      // Update the rental
      await fastify.db
        .update(rentals)
        .set({ 
          currentPeriodStartDate: newStartDate.toISOString(),
          currentPeriodEndDate: newEndDate.toISOString(),
          updatedAt: new Date().toISOString() 
        })
        .where(eq(rentals.id, rentalId));
      
      // Send notification to customer
      try {
        await fastify.notification.send(
          rental.customerId,
          'Rental Renewed Successfully',
          `Your rental for ${rental.product.name} has been renewed until ${newEndDate.toLocaleDateString()}.`,
          NotificationType.PAYMENT_SUCCESS,
          [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          rentalId,
          'rental'
        );
      } catch (error) {
        fastify.log.error(`Failed to send notification: ${error}`);
      }
      
      return true;
    } else {
      // Send notification about failed payment
      try {
        await fastify.notification.send(
          rental.customerId,
          'Rental Renewal Failed',
          `Your payment for the renewal of ${rental.product.name} could not be verified.`,
          NotificationType.PAYMENT_FAILURE,
          [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          rentalId,
          'rental'
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

// Check for expiring rentals and send notifications
export async function checkExpiringRentals() {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  
  // Find rentals expiring in the next 7 days
  const expiringRentals = await fastify.db.query.rentals.findMany({
    where: and(
      eq(rentals.status, RentalStatus.ACTIVE),
      // currentPeriodEndDate is between now and 7 days from now
      lte(rentals.currentPeriodEndDate, sevenDaysLater.toISOString()),
      gte(rentals.currentPeriodEndDate, now.toISOString())
    ),
    with: {
      customer: true,
      product: true
    }
  });
  
  // Send reminders
  for (const rental of expiringRentals) {
    const endDate = new Date(rental.currentPeriodEndDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    try {
      await fastify.notification.send(
        rental.customerId,
        'Rental Period Ending Soon',
        `Your rental period for ${rental.product.name} will end in ${daysRemaining} days. Please renew to continue using the product.`,
        NotificationType.RENTAL_REMINDER,
        [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        rental.id,
        'rental'
      );
    } catch (error) {
      fastify.log.error(`Failed to send reminder notification: ${error}`);
    }
  }
}

// Get all payments for a rental
export async function getRentalPayments(rentalId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const rental = await getRentalById(rentalId);
  if (!rental) {
    throw notFound('Rental');
  }
  
  const results = await fastify.db.query.payments.findMany({
    where: eq(fastify.db.query.payments.orderId, rental.orderId),
    orderBy: (payments, { desc }) => [desc(payments.createdAt)]
  });
  
  return results;
}