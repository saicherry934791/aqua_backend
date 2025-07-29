import { FastifyInstance } from 'fastify';
import { eq, and, inArray } from 'drizzle-orm';
import { installationRequests, purifierConnections, users, products, franchiseAreas } from '../models/schema';
import { InstallationRequestStatus, PurifierConnectionStatus, UserRole, NotificationType, NotificationChannel } from '../types';
import { generateId, parseJsonSafe } from '../utils/helpers';
import { notFound, badRequest, forbidden } from '../utils/errors';
import { getFastifyInstance } from '../shared/fastify-instance';
import * as notificationService from './notification.service';
import * as franchiseService from './franchise.service';

// Create installation request
export async function createInstallationRequest(data: {
  customerId: string;
  productId: string;
  customerName: string;
  customerPhone: string;
  city: string;
  installationAddress: string;
  locationLatitude: number;
  locationLongitude: number;
}) {
  const fastify = getFastifyInstance();

  // Validate product exists
  const product = await fastify.db.query.products.findFirst({
    where: eq(products.id, data.productId)
  });

  if (!product) {
    throw notFound('Product');
  }

  // Find franchise area based on location
  const franchiseAreaId = await franchiseService.findFranchiseAreaForLocation({
    latitude: data.locationLatitude,
    longitude: data.locationLongitude
  });

  if (!franchiseAreaId) {
    throw badRequest('No franchise area available for the selected location');
  }

  const requestId = await generateId('inst_req');
  const now = new Date().toISOString();

  await fastify.db.insert(installationRequests).values({
    id: requestId,
    customerId: data.customerId,
    productId: data.productId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    city: data.city,
    franchiseAreaId,
    installationAddress: data.installationAddress,
    locationLatitude: data.locationLatitude,
    locationLongitude: data.locationLongitude,
    status: InstallationRequestStatus.CREATED,
    createdAt: now,
    updatedAt: now
  });

  // Send notification to franchise owner and admin
  try {
    await notificationService.send(
      null, // Broadcast to franchise owners and admins
      'New Installation Request',
      `A new installation request has been submitted for ${product.name} in ${data.city}.`,
      NotificationType.SERVICE_REQUEST,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      requestId,
      'installation_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  return await getInstallationRequestById(requestId);
}

// Get installation request by ID
export async function getInstallationRequestById(id: string) {
  const fastify = getFastifyInstance();

  const result = await fastify.db.query.installationRequests.findFirst({
    where: eq(installationRequests.id, id),
    with: {
      customer: true,
      product: true,
      franchiseArea: true,
      reviewedByUser: true
    }
  });

  if (!result) return null;

  return {
    ...result,
    product: result.product ? {
      ...result.product,
      images: parseJsonSafe<string[]>(result.product.images as any, [])
    } : null
  };
}

// Get user's installation requests
export async function getUserInstallationRequests(userId: string) {
  const fastify = getFastifyInstance();

  const results = await fastify.db.query.installationRequests.findMany({
    where: eq(installationRequests.customerId, userId),
    with: {
      product: true,
      franchiseArea: true
    },
    orderBy: (installationRequests, { desc }) => [desc(installationRequests.createdAt)]
  });

  return results.map(result => ({
    ...result,
    product: result.product ? {
      ...result.product,
      images: parseJsonSafe<string[]>(result.product.images as any, [])
    } : null
  }));
}

// Get all installation requests (with filters)
export async function getAllInstallationRequests(
  filters: {
    status?: InstallationRequestStatus;
    franchiseAreaId?: string;
  },
  user: any
) {
  const fastify = getFastifyInstance();
  let whereConditions: any[] = [];

  // Role-based filtering
  if (user.role === UserRole.FRANCHISE_OWNER) {
    if (!user.franchiseAreaId) return [];
    whereConditions.push(eq(installationRequests.franchiseAreaId, user.franchiseAreaId));
  }

  // Additional filters
  if (filters.status) {
    whereConditions.push(eq(installationRequests.status, filters.status));
  }
  if (filters.franchiseAreaId && user.role === UserRole.ADMIN) {
    whereConditions.push(eq(installationRequests.franchiseAreaId, filters.franchiseAreaId));
  }

  const results = await fastify.db.query.installationRequests.findMany({
    where: whereConditions.length ? and(...whereConditions) : undefined,
    with: {
      customer: true,
      product: true,
      franchiseArea: true,
      reviewedByUser: true
    },
    orderBy: (installationRequests, { desc }) => [desc(installationRequests.createdAt)]
  });

  return results.map(result => ({
    ...result,
    product: result.product ? {
      ...result.product,
      images: parseJsonSafe<string[]>(result.product.images as any, [])
    } : null
  }));
}

// Update installation request status
export async function updateInstallationRequestStatus(
  id: string,
  status: InstallationRequestStatus,
  notes: string | undefined,
  reviewedBy: string
) {
  const fastify = getFastifyInstance();

  const installationRequest = await getInstallationRequestById(id);
  if (!installationRequest) {
    throw notFound('Installation Request');
  }

  // Validate status transition
  if (!isValidStatusTransition(installationRequest.status, status)) {
    throw badRequest(`Cannot change status from ${installationRequest.status} to ${status}`);
  }

  const now = new Date().toISOString();
  const updateData: any = {
    status,
    updatedAt: now
  };

  if (notes) updateData.notes = notes;
  if ([InstallationRequestStatus.APPROVED, InstallationRequestStatus.REJECTED].includes(status)) {
    updateData.reviewedBy = reviewedBy;
    updateData.reviewedAt = now;
  }

  await fastify.db
    .update(installationRequests)
    .set(updateData)
    .where(eq(installationRequests.id, id));

  // Send notification to customer
  try {
    let notificationTitle = '';
    let notificationMessage = '';

    switch (status) {
      case InstallationRequestStatus.APPROVED:
        notificationTitle = 'Installation Request Approved';
        notificationMessage = 'Your installation request has been approved. You will receive a Connect ID soon.';
        break;
      case InstallationRequestStatus.REJECTED:
        notificationTitle = 'Installation Request Rejected';
        notificationMessage = 'Your installation request has been rejected. Please contact support for more information.';
        break;
      case InstallationRequestStatus.INSTALLATION_SCHEDULED:
        notificationTitle = 'Installation Scheduled';
        notificationMessage = 'Your installation has been scheduled. Our technician will contact you soon.';
        break;
      case InstallationRequestStatus.INSTALLATION_COMPLETED:
        notificationTitle = 'Installation Completed';
        notificationMessage = 'Your purifier installation has been completed successfully.';
        break;
      default:
        notificationTitle = 'Installation Request Updated';
        notificationMessage = `Your installation request status has been updated to ${status}.`;
    }

    await notificationService.send(
      installationRequest.customerId,
      notificationTitle,
      notificationMessage,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'installation_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  return await getInstallationRequestById(id);
}

// Approve installation request and create purifier connection
export async function approveInstallationRequest(
  id: string,
  approvalData: {
    planName: string;
    planType: 'rental' | 'purchase';
    monthlyAmount?: number;
    notes?: string;
  },
  reviewedBy: string
) {
  const fastify = getFastifyInstance();

  const installationRequest = await getInstallationRequestById(id);
  if (!installationRequest) {
    throw notFound('Installation Request');
  }

  if (installationRequest.status !== InstallationRequestStatus.CREATED) {
    throw badRequest('Installation request has already been processed');
  }

  // Generate connect ID
  const connectId = await generateConnectId();
  const now = new Date().toISOString();

  const result = await fastify.db.transaction(async (tx) => {
    // Update installation request
    await tx
      .update(installationRequests)
      .set({
        status: InstallationRequestStatus.APPROVED,
        notes: approvalData.notes,
        reviewedBy,
        reviewedAt: now,
        connectId,
        updatedAt: now
      })
      .where(eq(installationRequests.id, id));

    // Create purifier connection
    const connectionId = await generateId('conn');
    const startDate = new Date();
    const nextPaymentDate = approvalData.planType === 'rental' 
      ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      : undefined;

    await tx.insert(purifierConnections).values({
      id: connectionId,
      connectId,
      customerId: installationRequest.customerId,
      productId: installationRequest.productId,
      installationRequestId: id,
      franchiseAreaId: installationRequest.franchiseAreaId,
      status: PurifierConnectionStatus.ACTIVE,
      planName: approvalData.planName,
      planType: approvalData.planType,
      startDate: startDate.toISOString(),
      nextPaymentDate: nextPaymentDate?.toISOString(),
      monthlyAmount: approvalData.monthlyAmount,
      createdAt: now,
      updatedAt: now
    });

    return { connectionId, connectId };
  });

  // Send notification with connect ID
  try {
    await notificationService.send(
      installationRequest.customerId,
      'Installation Approved - Connect ID Issued',
      `Your installation request has been approved! Your Connect ID is: ${connectId}. Use this ID to access your purifier dashboard.`,
      NotificationType.STATUS_UPDATE,
      [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      id,
      'installation_request'
    );
  } catch (error) {
    fastify.log.error(`Failed to send notification: ${error}`);
  }

  const updatedRequest = await getInstallationRequestById(id);
  const purifierConnection = await fastify.db.query.purifierConnections.findFirst({
    where: eq(purifierConnections.id, result.connectionId)
  });

  return {
    installationRequest: updatedRequest,
    purifierConnection,
    connectId: result.connectId
  };
}

// Generate unique connect ID
async function generateConnectId(): Promise<string> {
  const fastify = getFastifyInstance();
  
  let connectId: string;
  let isUnique = false;
  
  while (!isUnique) {
    // Generate 8-character alphanumeric ID
    connectId = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Check if it already exists
    const existing = await fastify.db.query.purifierConnections.findFirst({
      where: eq(purifierConnections.connectId, connectId)
    });
    
    if (!existing) {
      isUnique = true;
    }
  }
  
  return connectId!;
}

// Validate status transitions
function isValidStatusTransition(currentStatus: InstallationRequestStatus, newStatus: InstallationRequestStatus): boolean {
  const validTransitions: Record<InstallationRequestStatus, InstallationRequestStatus[]> = {
    [InstallationRequestStatus.CREATED]: [
      InstallationRequestStatus.UNDER_REVIEW,
      InstallationRequestStatus.APPROVED,
      InstallationRequestStatus.REJECTED
    ],
    [InstallationRequestStatus.UNDER_REVIEW]: [
      InstallationRequestStatus.CONTACTING_CUSTOMER,
      InstallationRequestStatus.APPROVED,
      InstallationRequestStatus.REJECTED
    ],
    [InstallationRequestStatus.CONTACTING_CUSTOMER]: [
      InstallationRequestStatus.APPROVED,
      InstallationRequestStatus.REJECTED
    ],
    [InstallationRequestStatus.APPROVED]: [
      InstallationRequestStatus.CONNECT_ID_ISSUED,
      InstallationRequestStatus.INSTALLATION_SCHEDULED
    ],
    [InstallationRequestStatus.CONNECT_ID_ISSUED]: [
      InstallationRequestStatus.INSTALLATION_SCHEDULED
    ],
    [InstallationRequestStatus.INSTALLATION_SCHEDULED]: [
      InstallationRequestStatus.INSTALLATION_IN_PROGRESS
    ],
    [InstallationRequestStatus.INSTALLATION_IN_PROGRESS]: [
      InstallationRequestStatus.INSTALLATION_COMPLETED
    ],
    [InstallationRequestStatus.INSTALLATION_COMPLETED]: [
      InstallationRequestStatus.ACTIVE
    ],
    [InstallationRequestStatus.REJECTED]: [], // Terminal state
    [InstallationRequestStatus.ACTIVE]: [] // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}