import { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { purifierConnections, users, products, serviceRequests, subscriptionPayments } from '../models/schema';
import { PurifierConnectionStatus, ServiceRequestType, ServiceRequestStatus, PaymentStatus } from '../types';
import { generateId, parseJsonSafe } from '../utils/helpers';
import { notFound, badRequest, forbidden } from '../utils/errors';
import { getFastifyInstance } from '../shared/fastify-instance';
import * as authService from './auth.service';
import * as serviceRequestService from './serviceRequest.service';

// Authenticate with Connect ID
export async function authenticateWithConnectId(connectId: string, phone: string) {
  const fastify = getFastifyInstance();

  // Find purifier connection
  const connection = await fastify.db.query.purifierConnections.findFirst({
    where: eq(purifierConnections.connectId, connectId),
    with: {
      customer: true,
      product: true
    }
  });

  if (!connection) {
    throw notFound('Invalid Connect ID');
  }

  // Verify phone number matches
  if (connection.customer.phone !== phone && connection.customer.phone !== `+91${phone}`) {
    throw forbidden('Phone number does not match the Connect ID');
  }

  // Generate tokens with connect ID
  const tokens = authService.generateTokens({
    ...connection.customer,
    connectId
  } as any);

  return {
    ...tokens,
    user: connection.customer,
    purifierConnection: {
      ...connection,
      product: {
        ...connection.product,
        images: parseJsonSafe<string[]>(connection.product.images as any, [])
      }
    }
  };
}

// Get purifier dashboard data
export async function getPurifierDashboardData(connectId: string, userId?: string) {
  const fastify = getFastifyInstance();

  const connection = await validateConnectionAccess(connectId, userId);

  // Get recent service requests
  const recentServiceRequests = await fastify.db.query.serviceRequests.findMany({
    where: eq(serviceRequests.purifierConnectionId, connection.id),
    with: {
      assignedTo: true
    },
    orderBy: desc(serviceRequests.createdAt),
    limit: 5
  });

  // Get next payment info
  const nextPayment = connection.nextPaymentDate ? {
    dueDate: connection.nextPaymentDate,
    amount: connection.monthlyAmount || 0
  } : null;

  // Get plan details
  const planDetails = {
    planName: connection.planName,
    planType: connection.planType,
    startDate: connection.startDate,
    endDate: connection.endDate,
    status: connection.status,
    monthlyAmount: connection.monthlyAmount
  };

  return {
    planDetails,
    nextPayment,
    recentServiceRequests: recentServiceRequests.map(sr => ({
      ...sr,
      images: parseJsonSafe<string[]>(sr.images, []),
      beforeImages: parseJsonSafe<string[]>(sr.beforeImages, []),
      afterImages: parseJsonSafe<string[]>(sr.afterImages, [])
    })),
    product: {
      ...connection.product,
      images: parseJsonSafe<string[]>(connection.product.images as any, [])
    }
  };
}

// Get plan details
export async function getPlanDetails(connectId: string, userId?: string) {
  const connection = await validateConnectionAccess(connectId, userId);

  return {
    planName: connection.planName,
    planType: connection.planType,
    startDate: connection.startDate,
    endDate: connection.endDate || (connection.planType === 'purchase' ? 'Unlimited' : null),
    status: connection.status,
    monthlyAmount: connection.monthlyAmount,
    product: {
      ...connection.product,
      images: parseJsonSafe<string[]>(connection.product.images as any, [])
    }
  };
}

// Get payment information
export async function getPaymentInfo(connectId: string, userId?: string) {
  const fastify = getFastifyInstance();
  const connection = await validateConnectionAccess(connectId, userId);

  if (connection.planType === 'purchase') {
    return {
      planType: 'purchase',
      message: 'No recurring payments required for purchased products'
    };
  }

  // Get next payment
  const nextPayment = connection.nextPaymentDate ? {
    dueDate: connection.nextPaymentDate,
    amount: connection.monthlyAmount || 0,
    status: 'upcoming'
  } : null;

  // Get recent payments
  const recentPayments = await fastify.db.query.subscriptionPayments.findMany({
    where: eq(subscriptionPayments.purifierConnectionId, connection.id),
    orderBy: desc(subscriptionPayments.createdAt),
    limit: 5
  });

  return {
    planType: 'rental',
    nextPayment,
    recentPayments,
    autopayEnabled: !!connection.razorpaySubscriptionId
  };
}

// Get service requests for purifier
export async function getPurifierServiceRequests(connectId: string, userId?: string, status?: string) {
  const fastify = getFastifyInstance();
  const connection = await validateConnectionAccess(connectId, userId);

  let whereConditions = eq(serviceRequests.purifierConnectionId, connection.id);
  
  if (status) {
    whereConditions = and(whereConditions, eq(serviceRequests.status, status as ServiceRequestStatus));
  }

  const results = await fastify.db.query.serviceRequests.findMany({
    where: whereConditions,
    with: {
      assignedTo: true
    },
    orderBy: desc(serviceRequests.createdAt)
  });

  return results.map(sr => ({
    ...sr,
    images: parseJsonSafe<string[]>(sr.images, []),
    beforeImages: parseJsonSafe<string[]>(sr.beforeImages, []),
    afterImages: parseJsonSafe<string[]>(sr.afterImages, [])
  }));
}

// Create service request for purifier
export async function createPurifierServiceRequest(
  connectId: string,
  userId: string | undefined,
  serviceRequestData: {
    type: ServiceRequestType;
    description: string;
    images?: string[];
  }
) {
  const connection = await validateConnectionAccess(connectId, userId);

  // Create service request using existing service
  const serviceRequest = await serviceRequestService.createServiceRequest(
    {
      productId: connection.productId,
      purifierConnectionId: connection.id,
      type: serviceRequestData.type,
      description: serviceRequestData.description,
      images: serviceRequestData.images || []
    },
    {
      userId: connection.customerId,
      franchiseAreaId: connection.franchiseAreaId
    }
  );

  return serviceRequest;
}

// Get payment history
export async function getPaymentHistory(connectId: string, userId?: string) {
  const fastify = getFastifyInstance();
  const connection = await validateConnectionAccess(connectId, userId);

  const payments = await fastify.db.query.subscriptionPayments.findMany({
    where: eq(subscriptionPayments.purifierConnectionId, connection.id),
    orderBy: desc(subscriptionPayments.createdAt)
  });

  return payments;
}

// Validate connection access
async function validateConnectionAccess(connectId: string, userId?: string) {
  const fastify = getFastifyInstance();

  const connection = await fastify.db.query.purifierConnections.findFirst({
    where: eq(purifierConnections.connectId, connectId),
    with: {
      customer: true,
      product: true
    }
  });

  if (!connection) {
    throw notFound('Purifier connection not found');
  }

  if (userId && connection.customerId !== userId) {
    throw forbidden('You do not have access to this purifier connection');
  }

  return connection;
}