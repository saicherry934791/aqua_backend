import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema, UserSchema } from './auth.schema';
import { NotificationType, NotificationChannel, NotificationStatus } from '../types';

// Notification Schema
export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.enum(Object.values(NotificationType) as [NotificationType, ...NotificationType[]]),
  referenceId: z.string().optional().nullable(),
  referenceType: z.string().optional().nullable(),
  channels: z.array(z.enum(Object.values(NotificationChannel) as [NotificationChannel, ...NotificationChannel[]])),
  status: z.enum(Object.values(NotificationStatus) as [NotificationStatus, ...NotificationStatus[]]),
  createdAt: z.string(),
  updatedAt: z.string(),
  scheduledAt: z.string().optional().nullable(),
  user: UserSchema.optional(),
});

// Send Notification
export const SendNotificationBodySchema = z.object({
  userId: z.string().optional(), // null for broadcast
  title: z.string(),
  message: z.string(),
  type: z.enum(Object.values(NotificationType) as [NotificationType, ...NotificationType[]]),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  channels: z.array(z.enum(Object.values(NotificationChannel) as [NotificationChannel, ...NotificationChannel[]])),
  scheduledAt: z.string().optional(),
});
export const SendNotificationResponseSchema = z.object({
  message: z.string(),
  notification: NotificationSchema,
});
export const sendNotificationSchema = {
  body: zodToJsonSchema(SendNotificationBodySchema),
  response: {
    201: zodToJsonSchema(SendNotificationResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["notifications"],
  summary: "Send a notification",
  description: "Send a notification to a user or broadcast (push, email, WhatsApp, etc.)",
  security: [{ bearerAuth: [] }],
};

// Get All Notifications
export const GetAllNotificationsQuerySchema = z.object({
  status: z.enum(Object.values(NotificationStatus) as [NotificationStatus, ...NotificationStatus[]]).optional(),
  type: z.enum(Object.values(NotificationType) as [NotificationType, ...NotificationType[]]).optional(),
  channel: z.enum(Object.values(NotificationChannel) as [NotificationChannel, ...NotificationChannel[]]).optional(),
});
export const GetAllNotificationsResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
});
export const getAllNotificationsSchema = {
  querystring: zodToJsonSchema(GetAllNotificationsQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllNotificationsResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["notifications"],
  summary: "Get all notifications",
  description: "Get a list of notifications for the authenticated user",
  security: [{ bearerAuth: [] }],
};

// Mark Notification as Read
export const MarkNotificationReadParamsSchema = z.object({
  id: z.string(),
});
export const MarkNotificationReadResponseSchema = z.object({
  message: z.string(),
  notification: NotificationSchema,
});
export const markNotificationReadSchema = {
  params: zodToJsonSchema(MarkNotificationReadParamsSchema),
  response: {
    200: zodToJsonSchema(MarkNotificationReadResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["notifications"],
  summary: "Mark notification as read",
  description: "Mark a notification as read by ID",
  security: [{ bearerAuth: [] }],
}; 