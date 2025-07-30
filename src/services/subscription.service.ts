import { FastifyInstance } from 'fastify';
import { eq, and, lte, gte } from 'drizzle-orm';
import { purifierConnections, subscriptionPayments, users } from '../models/schema';
import { PaymentStatus, PurifierConnectionStatus, NotificationType, NotificationChannel } from '../types';
import { generateId } from '../utils/helpers';
import { notFound, badRequest, serverError } from '../utils/errors';
import { getFastifyInstance } from '../shared/fastify-instance';
import * as notificationService from './notification.service';
import crypto from 'crypto';

// Create Razorpay subscription for autopay
export async function createAutopaySubscription(purifierConnectionId: string) {
  const fastify = getFastifyInstance();

  const connection = await fastify.db.query.purifierConnections.findFirst({
    where: eq(purifierConnections.id, purifierConnectionId),
    with: {
      customer: true,
      product: true
    }
  });

  if (!connection) {
    throw notFound('Purifier connection');
  }

  if (connection.planType !== 'rental') {
    throw badRequest('Autopay is only available for rental plans');
  }

  if (!connection.monthlyAmount) {
    throw badRequest('Monthly amount not set for this connection');
  }

  try {
    // Create Razorpay subscription
    const subscription = await fastify.razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_RENTAL_PLAN_ID, // You need to create this plan in Razorpay
      customer_notify: 1,
      quantity: 1,
      total_count: 120, // 10 years worth of payments
      start_at: Math.floor(new Date(connection.nextPaymentDate!).getTime() / 1000),
      addons: [],
      notes: {
        purifierConnectionId: connection.id,
        connectId: connection.connectId,
        customerId: connection.customerId
      }
    });

    // Update connection with subscription ID
    await fastify.db
      .update(purifierConnections)
      .set({
        razorpaySubscriptionId: subscription.id,
        updatedAt: new Date().toISOString()
      })
      .where(eq(purifierConnections.id, purifierConnectionId));

    return subscription;
  } catch (error) {
    fastify.log.error('Error creating Razorpay subscription:', error);
    throw serverError('Failed to create autopay subscription');
  }
}

// Process subscription payment webhook
export async function processSubscriptionPayment(webhookData: any) {
  const fastify = getFastifyInstance();

  const { event, payload } = webhookData;

  if (event === 'subscription.charged') {
    const subscription = payload.subscription.entity;
    const payment = payload.payment.entity;

    // Find the purifier connection
    const connection = await fastify.db.query.purifierConnections.findFirst({
      where: eq(purifierConnections.razorpaySubscriptionId, subscription.id)
    });

    if (!connection) {
      fastify.log.error('Purifier connection not found for subscription:', subscription.id);
      return;
    }

    // Create subscription payment record
    const paymentId = await generateId('sub_pay');
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await fastify.db.transaction(async (tx) => {
      // Insert payment record
      await tx.insert(subscriptionPayments).values({
        id: paymentId,
        purifierConnectionId: connection.id,
        amount: payment.amount / 100, // Convert from paise
        dueDate: now.toISOString(),
        paidDate: new Date(payment.created_at * 1000).toISOString(),
        status: payment.status === 'captured' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        paymentMethod: 'autopay',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });

      // Update next payment date
      await tx
        .update(purifierConnections)
        .set({
          nextPaymentDate: nextMonth.toISOString(),
          updatedAt: now.toISOString()
        })
        .where(eq(purifierConnections.id, connection.id));
    });

    // Send notification to customer
    try {
      await notificationService.send(
        connection.customerId,
        'Payment Successful',
        `Your monthly subscription payment of ₹${payment.amount / 100} has been processed successfully.`,
        NotificationType.PAYMENT_SUCCESS,
        [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        connection.id,
        'subscription_payment'
      );
    } catch (error) {
      fastify.log.error('Failed to send payment notification:', error);
    }
  }
}

// Check for overdue payments and send reminders
export async function processOverduePayments() {
  const fastify = getFastifyInstance();
  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find connections with overdue payments
  const overdueConnections = await fastify.db.query.purifierConnections.findMany({
    where: and(
      eq(purifierConnections.status, PurifierConnectionStatus.ACTIVE),
      eq(purifierConnections.planType, 'rental'),
      lte(purifierConnections.nextPaymentDate, now.toISOString())
    ),
    with: {
      customer: true,
      product: true
    }
  });

  for (const connection of overdueConnections) {
    const daysPastDue = Math.floor(
      (now.getTime() - new Date(connection.nextPaymentDate!).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPastDue >= 7) {
      // Suspend connection after 7 days
      await fastify.db
        .update(purifierConnections)
        .set({
          status: PurifierConnectionStatus.SUSPENDED,
          updatedAt: new Date().toISOString()
        })
        .where(eq(purifierConnections.id, connection.id));

      // Send suspension notification
      try {
        await notificationService.send(
          connection.customerId,
          'Service Suspended',
          `Your purifier service has been suspended due to overdue payment. Please contact support to reactivate.`,
          NotificationType.STATUS_UPDATE,
          [NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
          connection.id,
          'subscription'
        );
      } catch (error) {
        fastify.log.error('Failed to send suspension notification:', error);
      }
    } else if (daysPastDue >= 3) {
      // Send reminder after 3 days
      try {
        await notificationService.send(
          connection.customerId,
          'Payment Overdue',
          `Your subscription payment of ₹${connection.monthlyAmount} is ${daysPastDue} days overdue. Please make payment to avoid service suspension.`,
          NotificationType.RENTAL_REMINDER,
          [NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
          connection.id,
          'subscription'
        );
      } catch (error) {
        fastify.log.error('Failed to send overdue notification:', error);
      }
    }
  }
}

// Manual payment processing
export async function processManualPayment(
  purifierConnectionId: string,
  amount: number,
  paymentMethod: string = 'manual'
) {
  const fastify = getFastifyInstance();

  const connection = await fastify.db.query.purifierConnections.findFirst({
    where: eq(purifierConnections.id, purifierConnectionId)
  });

  if (!connection) {
    throw notFound('Purifier connection');
  }

  const paymentId = await generateId('sub_pay');
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  await fastify.db.transaction(async (tx) => {
    // Insert payment record
    await tx.insert(subscriptionPayments).values({
      id: paymentId,
      purifierConnectionId: connection.id,
      amount,
      dueDate: connection.nextPaymentDate || now.toISOString(),
      paidDate: now.toISOString(),
      status: PaymentStatus.COMPLETED,
      paymentMethod,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });

    // Update next payment date and reactivate if suspended
    await tx
      .update(purifierConnections)
      .set({
        nextPaymentDate: nextMonth.toISOString(),
        status: PurifierConnectionStatus.ACTIVE,
        updatedAt: now.toISOString()
      })
      .where(eq(purifierConnections.id, purifierConnectionId));
  });

  return paymentId;
}