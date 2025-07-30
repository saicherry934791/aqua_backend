import { FastifyInstance } from 'fastify';
import { eq, and, or, inArray } from 'drizzle-orm';
import { serviceRequests, users, products, orders, franchiseAreas } from '../models/schema';
import * as notificationService from './notification.service';
import { ServiceRequestStatus, ServiceRequestType, UserRole, NotificationType, NotificationChannel } from '../types';
import { generateId, parseJsonSafe } from '../utils/helpers';
import { notFound, badRequest, forbidden } from '../utils/errors';
import { getFastifyInstance } from '../shared/fastify-instance';

// Enhanced service request creation with image handling
export async function createEnhancedServiceRequest(data: {
  customerId: string;
  productId?: string;
  purifierConnectionId?: string;
  type: ServiceRequestType;
  description: string;
  images?: string[];
  franchiseAreaId: string;
}) {
  const fastify = getFastifyInstance();
  const id = await generateId('srq');
  const now = new Date().toISOString();

  const serviceRequest = {
    id,
    customerId: data.customerId,
    productId: data.productId || null,
    purifierConnectionId: data.purifierConnectionId || null,
    type: data.type,
    description: data.description,
    images: data.images && data.images.length > 0 ? JSON.stringify(data.images) : null,
    status: ServiceRequestStatus.CREATED,
    assignedToId: null,
    franchiseAreaId: data.franchiseAreaId,
    paymentRequired: false,
    paymentStatus: 'not_required',
    createdAt: now,
    updatedAt: now,
  };

  await fastify.db.insert(serviceRequests).values(serviceRequest);

  // Notify franchise agents
  await notifyFranchiseAgents(data.franchiseAreaId, id);

  return await getServiceRequestById(id);
}

// Accept service request by agent
export async function acceptServiceRequest(serviceRequestId: string, agentId: string) {
  const fastify = getFastifyInstance();

  const serviceRequest = await getServiceRequestById(serviceRequestId);
  if (!serviceRequest) {
    throw notFound('Service Request');
  }

  if (serviceRequest.status !== ServiceRequestStatus.CREATED) {
    throw badRequest('Service request is no longer available for acceptance');
  }

  await fastify.db
    .update(serviceRequests)
    .set({
      assignedToId: agentId,
      status: ServiceRequestStatus.ASSIGNED,
      updatedAt: new Date().toISOString()
    })
    .where(eq(serviceRequests.id, serviceRequestId));

  // Notify customer
  try {
    await notificationService.send(
      serviceRequest.customerId,
      'Service Agent Assigned',
      'A service agent has accepted your request and will contact you soon.',
      NotificationType.ASSIGNMENT_NOTIFICATION,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      serviceRequestId,
      'service_request'
    );
  } catch (error) {
    fastify.log.error('Failed to send notification:', error);
  }

  return await getServiceRequestById(serviceRequestId);
}

// Complete service with images and payment
export async function completeServiceRequest(
  serviceRequestId: string,
  agentId: string,
  completionData: {
    beforeImages?: string[];
    afterImages?: string[];
    serviceNotes?: string;
    paymentRequired?: boolean;
    paymentAmount?: number;
    paymentProofImage?: string;
  }
) {
  const fastify = getFastifyInstance();

  const serviceRequest = await getServiceRequestById(serviceRequestId);
  if (!serviceRequest) {
    throw notFound('Service Request');
  }

  if (serviceRequest.assignedToId !== agentId) {
    throw forbidden('You are not assigned to this service request');
  }

  const updateData: any = {
    status: ServiceRequestStatus.COMPLETED,
    completedDate: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (completionData.beforeImages?.length) {
    updateData.beforeImages = JSON.stringify(completionData.beforeImages);
  }
  if (completionData.afterImages?.length) {
    updateData.afterImages = JSON.stringify(completionData.afterImages);
  }
  if (completionData.serviceNotes) {
    updateData.serviceNotes = completionData.serviceNotes;
  }
  if (completionData.paymentRequired) {
    updateData.paymentRequired = true;
    updateData.paymentAmount = completionData.paymentAmount || 0;
    updateData.paymentStatus = completionData.paymentProofImage ? 'completed' : 'required';
    if (completionData.paymentProofImage) {
      updateData.paymentProofImage = completionData.paymentProofImage;
    }
  }

  await fastify.db
    .update(serviceRequests)
    .set(updateData)
    .where(eq(serviceRequests.id, serviceRequestId));

  // Notify customer
  try {
    await notificationService.send(
      serviceRequest.customerId,
      'Service Completed',
      'Your service request has been completed successfully.',
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      serviceRequestId,
      'service_request'
    );
  } catch (error) {
    fastify.log.error('Failed to send notification:', error);
  }

  return await getServiceRequestById(serviceRequestId);
}

// Notify franchise agents about new service request
async function notifyFranchiseAgents(franchiseAreaId: string, serviceRequestId: string) {
  const fastify = getFastifyInstance();

  // Get all agents in the franchise area
  const agents = await fastify.db.query.users.findMany({
    where: and(
      eq(users.franchiseAreaId, franchiseAreaId),
      eq(users.role, UserRole.SERVICE_AGENT),
      eq(users.isActive, true)
    )
  });

  // Send notifications to all agents
  for (const agent of agents) {
    try {
      await notificationService.send(
        agent.id,
        'New Service Request Available',
        'A new service request is available in your area. Check the app to accept it.',
        NotificationType.SERVICE_REQUEST,
        [NotificationChannel.PUSH],
        serviceRequestId,
        'service_request'
      );
    } catch (error) {
      fastify.log.error(`Failed to notify agent ${agent.id}:`, error);
    }
  }
}
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