import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { 
  users, 
  purifierConnections, 
  serviceRequests, 
  subscriptionPayments, 
  franchiseAreas,
  products 
} from '../models/schema';
import { UserRole, ServiceRequestStatus, PaymentStatus } from '../types';
import { parseJsonSafe } from '../utils/helpers';
import { getFastifyInstance } from '../shared/fastify-instance';

// Generate franchise performance report
export async function generateFranchiseReport(
  franchiseAreaId: string,
  fromDate?: string,
  toDate?: string
) {
  const fastify = getFastifyInstance();
  
  const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const to = toDate ? new Date(toDate) : new Date();

  // Get franchise details
  const franchise = await fastify.db.query.franchiseAreas.findFirst({
    where: eq(franchiseAreas.id, franchiseAreaId),
    with: {
      owner: true
    }
  });

  if (!franchise) {
    throw new Error('Franchise not found');
  }

  // Get all connections in this franchise
  const connections = await fastify.db.query.purifierConnections.findMany({
    where: and(
      eq(purifierConnections.franchiseAreaId, franchiseAreaId),
      gte(purifierConnections.createdAt, from.toISOString()),
      lte(purifierConnections.createdAt, to.toISOString())
    ),
    with: {
      customer: true,
      product: true
    }
  });

  // Get service requests in this period
  const serviceRequestsData = await fastify.db.query.serviceRequests.findMany({
    where: and(
      eq(serviceRequests.franchiseAreaId, franchiseAreaId),
      gte(serviceRequests.createdAt, from.toISOString()),
      lte(serviceRequests.createdAt, to.toISOString())
    ),
    with: {
      customer: true,
      product: true,
      assignedTo: true
    }
  });

  // Get payments in this period
  const paymentsData = await fastify.db.query.subscriptionPayments.findMany({
    where: and(
      gte(subscriptionPayments.createdAt, from.toISOString()),
      lte(subscriptionPayments.createdAt, to.toISOString())
    )
  });

  // Calculate metrics
  const totalConnections = connections.length;
  const activeConnections = connections.filter(c => c.status === 'active').length;
  const totalRevenue = paymentsData
    .filter(p => p.status === PaymentStatus.COMPLETED)
    .reduce((sum, p) => sum + p.amount, 0);

  const completedServices = serviceRequestsData.filter(
    sr => sr.status === ServiceRequestStatus.COMPLETED
  ).length;

  const servicesByType = serviceRequestsData.reduce((acc, sr) => {
    acc[sr.type] = (acc[sr.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get agent performance
  const agentPerformance = await getAgentPerformance(franchiseAreaId, from, to);

  return {
    franchise: {
      id: franchise.id,
      name: franchise.name,
      city: franchise.city,
      ownerName: franchise.owner?.name || 'Company Managed'
    },
    period: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    summary: {
      totalConnections,
      activeConnections,
      totalRevenue,
      completedServices,
      averageServiceTime: calculateAverageServiceTime(serviceRequestsData)
    },
    connections: connections.map(c => ({
      connectId: c.connectId,
      customerName: c.customer.name,
      customerPhone: c.customer.phone,
      productName: c.product.name,
      planType: c.planType,
      planName: c.planName,
      startDate: c.startDate,
      monthlyAmount: c.monthlyAmount,
      status: c.status
    })),
    serviceRequests: serviceRequestsData.map(sr => ({
      id: sr.id,
      type: sr.type,
      description: sr.description,
      status: sr.status,
      customerName: sr.customer?.name,
      agentName: sr.assignedTo?.name,
      createdAt: sr.createdAt,
      completedDate: sr.completedDate,
      paymentRequired: sr.paymentRequired,
      paymentAmount: sr.paymentAmount
    })),
    servicesByType,
    agentPerformance,
    payments: paymentsData.map(p => ({
      id: p.id,
      amount: p.amount,
      dueDate: p.dueDate,
      paidDate: p.paidDate,
      status: p.status,
      paymentMethod: p.paymentMethod
    }))
  };
}

// Get agent performance data
async function getAgentPerformance(franchiseAreaId: string, from: Date, to: Date) {
  const fastify = getFastifyInstance();

  const agents = await fastify.db.query.users.findMany({
    where: and(
      eq(users.franchiseAreaId, franchiseAreaId),
      eq(users.role, UserRole.SERVICE_AGENT)
    )
  });

  const performance = [];

  for (const agent of agents) {
    const agentServices = await fastify.db.query.serviceRequests.findMany({
      where: and(
        eq(serviceRequests.assignedToId, agent.id),
        gte(serviceRequests.createdAt, from.toISOString()),
        lte(serviceRequests.createdAt, to.toISOString())
      )
    });

    const completed = agentServices.filter(sr => sr.status === ServiceRequestStatus.COMPLETED);
    const totalRevenue = agentServices
      .filter(sr => sr.paymentRequired && sr.paymentAmount)
      .reduce((sum, sr) => sum + (sr.paymentAmount || 0), 0);

    performance.push({
      agentId: agent.id,
      agentName: agent.name,
      agentPhone: agent.phone,
      totalServices: agentServices.length,
      completedServices: completed.length,
      completionRate: agentServices.length > 0 ? (completed.length / agentServices.length * 100).toFixed(1) : '0',
      totalRevenue,
      averageServiceTime: calculateAverageServiceTime(completed)
    });
  }

  return performance;
}

// Calculate average service completion time
function calculateAverageServiceTime(serviceRequests: any[]): string {
  const completedServices = serviceRequests.filter(
    sr => sr.status === ServiceRequestStatus.COMPLETED && sr.completedDate
  );

  if (completedServices.length === 0) return '0 days';

  const totalTime = completedServices.reduce((sum, sr) => {
    const created = new Date(sr.createdAt);
    const completed = new Date(sr.completedDate);
    return sum + (completed.getTime() - created.getTime());
  }, 0);

  const averageMs = totalTime / completedServices.length;
  const averageDays = Math.round(averageMs / (1000 * 60 * 60 * 24));

  return `${averageDays} days`;
}

// Generate subscription report
export async function generateSubscriptionReport(franchiseAreaId?: string) {
  const fastify = getFastifyInstance();

  let whereConditions = eq(purifierConnections.planType, 'rental');
  if (franchiseAreaId) {
    whereConditions = and(whereConditions, eq(purifierConnections.franchiseAreaId, franchiseAreaId));
  }

  const subscriptions = await fastify.db.query.purifierConnections.findMany({
    where: whereConditions,
    with: {
      customer: true,
      product: true,
      franchiseArea: true
    },
    orderBy: desc(purifierConnections.createdAt)
  });

  // Get payment data for each subscription
  const subscriptionData = await Promise.all(
    subscriptions.map(async (sub) => {
      const payments = await fastify.db.query.subscriptionPayments.findMany({
        where: eq(subscriptionPayments.purifierConnectionId, sub.id),
        orderBy: desc(subscriptionPayments.createdAt)
      });

      const totalPaid = payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + p.amount, 0);

      const lastPayment = payments[0];
      const nextPaymentDue = sub.nextPaymentDate ? new Date(sub.nextPaymentDate) : null;
      const isOverdue = nextPaymentDue && nextPaymentDue < new Date();

      return {
        connectId: sub.connectId,
        customerName: sub.customer.name,
        customerPhone: sub.customer.phone,
        productName: sub.product.name,
        franchiseName: sub.franchiseArea.name,
        planName: sub.planName,
        monthlyAmount: sub.monthlyAmount,
        startDate: sub.startDate,
        status: sub.status,
        totalPaid,
        lastPaymentDate: lastPayment?.paidDate,
        nextPaymentDue: sub.nextPaymentDate,
        isOverdue,
        autopayEnabled: !!sub.razorpaySubscriptionId
      };
    })
  );

  return {
    totalSubscriptions: subscriptionData.length,
    activeSubscriptions: subscriptionData.filter(s => s.status === 'active').length,
    suspendedSubscriptions: subscriptionData.filter(s => s.status === 'suspended').length,
    overdueSubscriptions: subscriptionData.filter(s => s.isOverdue).length,
    totalRevenue: subscriptionData.reduce((sum, s) => sum + s.totalPaid, 0),
    subscriptions: subscriptionData
  };
}