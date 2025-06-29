import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { notifications, users } from '../models/schema';
import { NotificationType, NotificationChannel, NotificationStatus } from '../types';
import { generateId } from '../utils/helpers';
import { notFound } from '../utils/errors';

/**
 * Send a notification to a user
 * @param userId User ID to send notification to
 * @param title Notification title
 * @param message Notification message
 * @param type Notification type
 * @param channels Channels to send the notification through
 * @param referenceId Optional reference ID (order ID, rental ID, etc.)
 * @param referenceType Optional reference type (order, rental, etc.)
 * @param scheduledAt Optional time to schedule the notification for
 * @returns ID of the created notification
 */
export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  channels: NotificationChannel[],
  referenceId?: string,
  referenceType?: string,
  scheduledAt?: Date
): Promise<string> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  // Check if user exists
  const user = await fastify.db.query.users.findFirst({
    where: eq(fastify.db.query.users.id, userId)
  });
  
  if (!user) {
    throw notFound('User');
  }
  
  // Create notification record
  const notificationId = generateId('notif');
  
  await fastify.db.insert(notifications).values({
    id: notificationId,
    userId,
    title,
    message,
    type,
    channels: JSON.stringify(channels),
    referenceId,
    referenceType,
    status: scheduledAt && scheduledAt > new Date() ? NotificationStatus.PENDING : NotificationStatus.SENT,
    scheduledAt: scheduledAt?.toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  // If not scheduled for future, send it immediately
  if (!scheduledAt || scheduledAt <= new Date()) {
    try {
      // Use the fastify notification plugin to send the notification
      await fastify.notification.send(
        userId,
        title,
        message,
        type,
        channels,
        referenceId,
        referenceType
      );
    } catch (error) {
      fastify.log.error(`Error sending notification: ${error}`);
      
      // Update status to failed
      await fastify.db
        .update(notifications)
        .set({ 
          status: NotificationStatus.FAILED,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(notifications.id, notificationId));
    }
  }
  
  return notificationId;
}

/**
 * Mark a notification as read
 * @param notificationId Notification ID
 * @param userId User ID (to verify ownership)
 * @returns Updated notification
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const notification = await fastify.db.query.notifications.findFirst({
    where: and(
      eq(fastify.db.query.notifications.id, notificationId),
      eq(fastify.db.query.notifications.userId, userId)
    )
  });
  
  if (!notification) {
    throw notFound('Notification');
  }
  
  await fastify.db
    .update(notifications)
    .set({ 
      status: NotificationStatus.READ,
      updatedAt: new Date().toISOString() 
    })
    .where(eq(notifications.id, notificationId));
  
  return fastify.db.query.notifications.findFirst({
    where: eq(fastify.db.query.notifications.id, notificationId)
  });
}

/**
 * Get notifications for a user
 * @param userId User ID
 * @param limit Maximum number of notifications to return
 * @param offset Offset for pagination
 * @returns Array of notifications
 */
export async function getUserNotifications(userId: string, limit = 20, offset = 0) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const results = await fastify.db.query.notifications.findMany({
    where: eq(fastify.db.query.notifications.userId, userId),
    orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
    limit,
    offset
  });
  
  return results.map(notification => ({
    ...notification,
    channels: JSON.parse(notification.channels) as NotificationChannel[]
  }));
}

/**
 * Get unread notification count for a user
 * @param userId User ID
 * @returns Number of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const results = await fastify.db
    .select({ count: sql`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        notEq(notifications.status, NotificationStatus.READ)
      )
    );
  
  return results[0]?.count || 0;
}

/**
 * Process pending notifications that are scheduled to be sent
 * This function would be called by a scheduler periodically
 */
export async function processPendingNotifications() {
  const fastify = (global as any).fastify as FastifyInstance;
  
  // Call the notification plugin's processPendingNotifications method
  await fastify.notification.processPendingNotifications();
}

// Send notification (push, email, WhatsApp, etc.)
export async function send(
  userId: string | null,
  title: string,
  message: string,
  type: NotificationType,
  channels: NotificationChannel[],
  referenceId?: string,
  referenceType?: string,
  scheduledAt?: string
) {
  const fastify = (global as any).fastify as FastifyInstance;
  const id = generateId('ntf');
  const now = new Date().toISOString();
  const notification = {
    id,
    userId: userId || '',
    title,
    message,
    type,
    referenceId: referenceId || null,
    referenceType: referenceType || null,
    channels: JSON.stringify(channels),
    status: NotificationStatus.PENDING,
    createdAt: now,
    updatedAt: now,
    scheduledAt: scheduledAt || null,
  };
  await fastify.db.insert(notifications).values(notification);

  // Send via channels
  for (const channel of channels) {
    if (channel === NotificationChannel.PUSH) {
      await fastify.push?.send(userId, title, message, referenceId, referenceType);
    } else if (channel === NotificationChannel.EMAIL) {
      await fastify.email?.send(userId, title, message);
    } else if (channel === NotificationChannel.WHATSAPP) {
      await fastify.whatsapp?.send(userId, message);
    } 
  }

  // Mark as sent
  await fastify.db.update(notifications).set({ status: NotificationStatus.SENT, updatedAt: new Date().toISOString() }).where(eq(notifications.id, id));

  return await getNotificationById(id);
}

// Get all notifications for a user
export async function getAll(userId: string, filters: any) {
  const fastify = (global as any).fastify as FastifyInstance;
  let whereClause: any = [eq(notifications.userId, userId)];
  if (filters.status) {
    whereClause.push(eq(notifications.status, filters.status));
  }
  if (filters.type) {
    whereClause.push(eq(notifications.type, filters.type));
  }
  if (filters.channel) {
    whereClause.push(
      (notifications: any) => notifications.channels.includes(filters.channel)
    );
  }
  const results = await fastify.db.query.notifications.findMany({
    where: and(...whereClause),
    with: {
      user: true,
    },
  });
  return results;
}

// Get notification by ID
export async function getNotificationById(id: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  const result = await fastify.db.query.notifications.findFirst({
    where: eq(notifications.id, id),
    with: {
      user: true,
    },
  });
  return result;
}

// Mark notification as read
export async function markAsRead(id: string, userId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  const notification = await getNotificationById(id);
  if (!notification) throw notFound('Notification');
  if (notification.userId !== userId) throw notFound('Notification');
  await fastify.db.update(notifications).set({ status: NotificationStatus.READ, updatedAt: new Date().toISOString() }).where(eq(notifications.id, id));
  return await getNotificationById(id);
}