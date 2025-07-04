import { FastifyInstance } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import { serviceRequests, users, products, orders, franchiseAreas } from '../models/schema';
import * as notificationService from './notification.service';
import { ServiceRequestStatus, ServiceRequestType, UserRole, NotificationType, NotificationChannel } from '../types';
import { generateId, parseJsonSafe } from '../utils/helpers';
import { notFound, badRequest, forbidden } from '../utils/errors';
import { getFastifyInstance } from '../shared/fastify-instance';

// Get all service requests (with optional filters)
export async function getAllServiceRequests(filters: any, user: any) {
  const fastify = getFastifyInstance();
  let whereConditions: any[] = [];

  // Role-based filtering
  if (user.role === UserRole.FRANCHISE_OWNER) {
    if (!user.franchiseAreaId) return [];
    whereConditions.push(eq(serviceRequests.franchiseAreaId, user.franchiseAreaId));
  } else if (user.role === UserRole.SERVICE_AGENT) {
    whereConditions.push(eq(serviceRequests.assignedToId, user.userId));
  } else if (user.role === UserRole.CUSTOMER) {
    whereConditions.push(eq(serviceRequests.customerId, user.userId));
  }

  // Additional filters
  if (filters.status) {
    whereConditions.push(eq(serviceRequests.status, filters.status));
  }
  if (filters.type) {
    whereConditions.push(eq(serviceRequests.type, filters.type));
  }
  if (filters.franchiseAreaId) {
    whereConditions.push(eq(serviceRequests.franchiseAreaId, filters.franchiseAreaId));
  }

  const results = await fastify.db.query.serviceRequests.findMany({
    where: whereConditions.length ? and(...whereConditions) : undefined,
    with: {
      customer: true,
      product: true,
      assignedTo: true,
    },
  });

  // Process results to ensure proper data structure and parse images
  return results.map(sr => ({
    ...sr,
    images: parseJsonSafe<string[]>(sr.images, []), // Parse images JSON string to array
    product: sr.product ? {
      ...sr.product,
      images: parseJsonSafe<string[]>(sr.product.images as any, [])
    } : null
  }));
}

// Get service request by ID
export async function getServiceRequestById(id: string) {
  const fastify = getFastifyInstance();
  const result = await fastify.db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, id),
    with: {
      customer: true,
      product: true,
      assignedTo: true,
    },
  });

  if (!result) return null;

  // Process result to ensure proper data structure and parse images
  return {
    ...result,
    images: parseJsonSafe<string[]>(result.images, []), // Parse images JSON string to array
    product: result.product ? {
      ...result.product,
      images: parseJsonSafe<string[]>(result.product.images as any, [])
    } : null
  };
}

// Create a new service request - Updated to handle images
export async function createServiceRequest(data: any, user: any) {
  const fastify = getFastifyInstance();
  const id = await generateId('srq');
  const now = new Date().toISOString();

  console.log('Creating service request with data:', data);

  // Get product and franchise area
  const product = await fastify.db.query.products.findFirst({ where: eq(products.id, data.productId) });
  if (!product) throw notFound('Product');

  // let franchiseAreaId = user.franchiseAreaId;
  // if (!franchiseAreaId) {
  //   // Try to get from product or order if needed
  //   throw badRequest('Franchise area not found for user');
  // }
  const userFromDb = await fastify.db.query.users.findFirst({
    where: eq(users.id,user.userId)
  })
  console.log('userFromDb ',userFromDb)

  const serviceRequest = {
    id,
    customerId: user.userId,
    productId: data.productId,
    orderId: data.orderId || null,
    type: data.type,
    description: data.description,
    images: data.images && data.images.length > 0 ? JSON.stringify(data.images) : null, // Store images as JSON
    status: ServiceRequestStatus.CREATED,
    assignedToId: null,
    franchiseAreaId:userFromDb.franchiseAreaId,
    scheduledDate: data.scheduledDate || null,
    completedDate: null,
    createdAt: now,
    updatedAt: now,
  };

  console.log('Inserting service request:', serviceRequest);

  await fastify.db.insert(serviceRequests).values(serviceRequest);

  // Send notification to admin/franchise owner
  try {
    await notificationService.send(
      null, // broadcast to admins/franchise owners
      'New Service Request',
      `A new service request has been created by ${user.name}.`,
      NotificationType.SERVICE_REQUEST,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'service_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  return await getServiceRequestById(id);
}

// Update service request status
export async function updateServiceRequestStatus(id: string, status: ServiceRequestStatus, user: any) {
  const fastify = getFastifyInstance();
  const sr = await getServiceRequestById(id);
  if (!sr) throw notFound('Service Request');

  // Permission: only admin, franchise owner, or assigned agent
  const hasPermission =
    user.role === UserRole.ADMIN ||
    (user.role === UserRole.FRANCHISE_OWNER && sr.franchiseAreaId === user.franchiseAreaId) ||
    (user.role === UserRole.SERVICE_AGENT && sr.assignedToId === user.userId);
  if (!hasPermission) throw forbidden('You do not have permission to update this service request');

  await fastify.db.update(serviceRequests).set({
    status,
    updatedAt: new Date().toISOString(),
    completedDate: status === ServiceRequestStatus.COMPLETED ? new Date().toISOString() : null,
  }).where(eq(serviceRequests.id, id));

  // Send notification to customer
  try {
    await notificationService.send(
      sr.customerId,
      'Service Request Status Updated',
      `Your service request status is now: ${status}.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'service_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  return await getServiceRequestById(id);
}

// Assign service agent
export async function assignServiceAgent(id: string, assignedToId: string, user: any) {
  const fastify = getFastifyInstance();
  const sr = await getServiceRequestById(id);
  if (!sr) throw notFound('Service Request');

  // Only admin or franchise owner can assign
  if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER].includes(user.role)) {
    throw forbidden('You do not have permission to assign service agents');
  }

  // Check if agent exists and is in the same franchise area
  const agent = await fastify.db.query.users.findFirst({ where: eq(users.id, assignedToId) });
  if (!agent || agent.role !== UserRole.SERVICE_AGENT ) {
    throw badRequest('Invalid service agent for this franchise area');
  }

  await fastify.db.update(serviceRequests).set({
    assignedToId,
    status: ServiceRequestStatus.ASSIGNED,
    updatedAt: new Date().toISOString(),
  }).where(eq(serviceRequests.id, id));

  // Send notification to agent
  try {
    await notificationService.send(
      assignedToId,
      'New Service Assignment',
      `You have been assigned a new service request.`,
      NotificationType.ASSIGNMENT_NOTIFICATION,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'service_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  return await getServiceRequestById(id);
}

// Schedule service request - NEW FUNCTION
export async function scheduleServiceRequest(id: string, scheduledDate: string, user: any) {
  const fastify = getFastifyInstance();
  const sr = await getServiceRequestById(id);
  if (!sr) throw notFound('Service Request');

  // Permission: admin, franchise owner, or assigned agent
  const hasPermission =
    user.role === UserRole.ADMIN ||
    (user.role === UserRole.FRANCHISE_OWNER && sr.franchiseAreaId === user.franchiseAreaId) ||
    (user.role === UserRole.SERVICE_AGENT && sr.assignedToId === user.userId);
  if (!hasPermission) throw forbidden('You do not have permission to schedule this service request');

  // Validate scheduled date is in the future
  const scheduledDateTime = new Date(scheduledDate);
  if (scheduledDateTime <= new Date()) {
    throw badRequest('Scheduled date must be in the future');
  }

  await fastify.db.update(serviceRequests).set({
    scheduledDate: scheduledDateTime.toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(serviceRequests.id, id));

  // Send notification to customer
  try {
    await notificationService.send(
      sr.customerId,
      'Service Scheduled',
      `Your service request has been scheduled for ${scheduledDateTime.toLocaleDateString()}.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'service_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  // If there's an assigned agent, notify them too
  if (sr.assignedToId) {
    try {
      await notificationService.send(
        sr.assignedToId,
        'Service Scheduled',
        `A service request has been scheduled for ${scheduledDateTime.toLocaleDateString()}.`,
        NotificationType.STATUS_UPDATE,
        [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        id,
        'service_request'
      );
    } catch (error) {
      fastify.log.error(`Failed to send notification: ${error}`);
    }
  }

  return await getServiceRequestById(id);
}