import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fetch from 'node-fetch';
import { eq } from 'drizzle-orm';
import { notifications, pushSubscriptions } from '../models/schema';
import { NotificationChannel, NotificationType, NotificationStatus } from '../types';

declare module 'fastify' {
  interface FastifyInstance {
    notification: {
      send: (
        userId: string, 
        title: string, 
        message: string, 
        type: NotificationType, 
        channels: NotificationChannel[],
        referenceId?: string,
        referenceType?: string,
        scheduledAt?: Date
      ) => Promise<string>;
      processPendingNotifications: () => Promise<void>;
    };
  }
}

export default fp(async function (fastify: FastifyInstance) {
  // Initialize notification services
  const sendEmail = async (to: string, subject: string, body: string): Promise<boolean> => {
    // Email implementation would go here
    // This is a placeholder for actual email sending logic
    fastify.log.info(`Email sent to ${to} with subject: ${subject}`);
    return true;
  };

  const sendSMS = async (to: string, message: string): Promise<boolean> => {
    // SMS implementation would go here
    // This is a placeholder for actual SMS sending logic
    fastify.log.info(`SMS sent to ${to} with message: ${message}`);
    return true;
  };

  const sendWhatsApp = async (to: string, message: string): Promise<boolean> => {
    // WhatsApp implementation would go here
    // This is a placeholder for actual WhatsApp sending logic
    fastify.log.info(`WhatsApp message sent to ${to}: ${message}`);
    return true;
  };

  const sendPushNotification = async (
    userId: string, 
    title: string, 
    body: string
  ): Promise<boolean> => {
    try {
      // Get user's push subscriptions
      const userSubscriptions = await fastify.db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      if (userSubscriptions.length === 0) {
        return false;
      }

      const privateKey = process.env.PUSH_NOTIFICATION_PRIVATE_KEY;
      if (!privateKey) {
        fastify.log.warn('Push notification private key missing');
        return false;
      }

      // For each subscription, send the notification
      for (const subscription of userSubscriptions) {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        // Here you would use web-push library to send the notification
        // This is simplified for the example
        fastify.log.info(`Push notification sent to ${userId}: ${title} - ${body}`);
      }

      return true;
    } catch (error) {
      fastify.log.error(`Error sending push notification: ${error}`);
      return false;
    }
  };

  const send = async (
    userId: string, 
    title: string, 
    message: string, 
    type: NotificationType, 
    channels: NotificationChannel[],
    referenceId?: string,
    referenceType?: string,
    scheduledAt?: Date
  ): Promise<string> => {
    try {
      // Get user details
      const user = await fastify.db.query.users.findFirst({
        where: eq(fastify.db.query.users.id, userId),
      });

      if (!user) {
        throw new Error(`User not found with ID: ${userId}`);
      }

      // Create notification record
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      await fastify.db.insert(notifications).values({
        id: notificationId,
        userId,
        title,
        message,
        type,
        referenceId,
        referenceType,
        channels: JSON.stringify(channels),
        status: scheduledAt && scheduledAt > new Date() 
          ? NotificationStatus.PENDING 
          : NotificationStatus.SENT,
        scheduledAt: scheduledAt?.toISOString(),
      });

      // If scheduled for future, don't send now
      if (scheduledAt && scheduledAt > new Date()) {
        return notificationId;
      }

      // Send notifications through selected channels
      for (const channel of channels) {
        switch (channel) {
          case NotificationChannel.EMAIL:
            if (user.email) {
              await sendEmail(user.email, title, message);
            }
            break;
          case NotificationChannel.SMS:
            await sendSMS(user.phone, message);
            break;
          case NotificationChannel.WHATSAPP:
            await sendWhatsApp(user.phone, message);
            break;
          case NotificationChannel.PUSH:
            await sendPushNotification(userId, title, message);
            break;
        }
      }

      return notificationId;
    } catch (error) {
      fastify.log.error(`Error sending notification: ${error}`);
      throw error;
    }
  };

  // Process pending notifications (could be called by a scheduler)
  const processPendingNotifications = async (): Promise<void> => {
    try {
      const now = new Date();
      
      // Get pending notifications that are scheduled for now or earlier
      const pendingNotifications = await fastify.db
        .select()
        .from(notifications)
        .where(eq(notifications.status, NotificationStatus.PENDING))
        .where((notification) => {
          return notification.scheduledAt && notification.scheduledAt <= now.toISOString();
        });

      for (const notification of pendingNotifications) {
        try {
          // Get user details
          const user = await fastify.db.query.users.findFirst({
            where: eq(fastify.db.query.users.id, notification.userId),
          });

          if (!user) {
            continue;
          }

          // Parse channels
          const channels = JSON.parse(notification.channels) as NotificationChannel[];

          // Send notifications through selected channels
          for (const channel of channels) {
            switch (channel) {
              case NotificationChannel.EMAIL:
                if (user.email) {
                  await sendEmail(user.email, notification.title, notification.message);
                }
                break;
              case NotificationChannel.SMS:
                await sendSMS(user.phone, notification.message);
                break;
              case NotificationChannel.WHATSAPP:
                await sendWhatsApp(user.phone, notification.message);
                break;
              case NotificationChannel.PUSH:
                await sendPushNotification(notification.userId, notification.title, notification.message);
                break;
            }
          }

          // Update notification status
          await fastify.db
            .update(notifications)
            .set({ status: NotificationStatus.SENT, updatedAt: new Date().toISOString() })
            .where(eq(notifications.id, notification.id));
        } catch (error) {
          fastify.log.error(`Error processing notification ${notification.id}: ${error}`);
          // Update notification status to failed
          await fastify.db
            .update(notifications)
            .set({ status: NotificationStatus.FAILED, updatedAt: new Date().toISOString() })
            .where(eq(notifications.id, notification.id));
        }
      }
    } catch (error) {
      fastify.log.error(`Error processing pending notifications: ${error}`);
    }
  };

  // Decorate Fastify instance with notification methods
  fastify.decorate('notification', {
    send,
    processPendingNotifications,
  });

  fastify.log.info('Notification plugin registered');
});