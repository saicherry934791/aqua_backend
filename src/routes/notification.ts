import { FastifyInstance } from 'fastify';
import {
  sendNotification,
  getAllNotifications,
  markNotificationRead,
} from '../controllers/notification.controller';
import {
  sendNotificationSchema,
  getAllNotificationsSchema,
  markNotificationReadSchema,
} from '../schemas/notification.schema';

export default async function (fastify: FastifyInstance) {
  // Send a notification (admin only, or internal usage)
  fastify.post(
    '/',
    {
      schema: sendNotificationSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => sendNotification(request as any, reply as any)
  );

  // Get all notifications for current user
  fastify.get(
    '/',
    {
      schema: getAllNotificationsSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => getAllNotifications(request as any, reply as any)
  );

  // Mark notification as read
  fastify.patch(
    '/:id/read',
    {
      schema: markNotificationReadSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => markNotificationRead(request as any, reply as any)
  );

  fastify.log.info('Notification routes registered');
} 