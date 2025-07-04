// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import * as notificationService from '../services/notification.service';
import { handleError, notFound } from '../utils/errors';

// Send a notification
export async function sendNotification(
  request: FastifyRequest<{ Body: any }>,
  reply: FastifyReply
) {
  try {
    const {
      userId,
      title,
      message,
      type,
      channels,
      referenceId,
      referenceType,
      scheduledAt,
    } = request.body;
    const notification = await notificationService.send(
      userId || null,
      title,
      message,
      type,
      channels,
      referenceId,
      referenceType,
      scheduledAt
    );
    return reply.code(201).send({ message: 'Notification sent', notification });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get all notifications for current user
export async function getAllNotifications(
  request: FastifyRequest<{ Querystring: any }>,
  reply: FastifyReply
) {
  try {
    const userId = request.user.userId;
    const filters = request.query;
    const notifications = await notificationService.getAll(userId, filters);
    return reply.code(200).send({ notifications });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Mark notification as read
export async function markNotificationRead(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const userId = request.user.userId;
    const notification = await notificationService.markAsRead(id, userId);
    return reply.code(200).send({ message: 'Notification marked as read', notification });
  } catch (error) {
    handleError(error, request, reply);
  }
} 