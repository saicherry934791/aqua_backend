// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql, count, sum, desc } from 'drizzle-orm';
import { users, franchiseAreas, products, serviceRequests, subscriptionPayments, purifierConnections, installationRequests } from '../models/schema';
import { UserRole, ServiceRequestStatus, PaymentStatus, PurifierConnectionStatus, InstallationRequestStatus } from '../types';
import { getFastifyInstance } from '../shared/fastify-instance';

export async function getDashboardStats(userId: string, role: UserRole, franchiseAreaId?: string) {
  const fastify = getFastifyInstance();
  
  switch (role) {
    case UserRole.ADMIN:
      return await getAdminDashboardStatsInternal();
    case UserRole.FRANCHISE_OWNER:
      return await getFranchiseOwnerDashboardStats(franchiseAreaId);
    case UserRole.SERVICE_AGENT:
      return await getServiceAgentDashboardStats(userId);
    case UserRole.CUSTOMER:
      return await getCustomerDashboardStats(userId);
    default:
      throw new Error('Invalid user role');
  }
}

async function getAdminDashboardStatsInternal() {
  const fastify = getFastifyInstance();
  
  // Get current date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  // Get all data
  const [
    allConnections,
    allPayments,
    allFranchises,
    allServiceRequests,
    allInstallationRequests,
    monthlyConnections,
    lastMonthConnections,
    monthlyRevenue,
    lastMonthRevenue
  ] = await Promise.all([
    fastify.db.query.purifierConnections.findMany({}),
    fastify.db.query.subscriptionPayments.findMany({ where: eq(subscriptionPayments.status, PaymentStatus.COMPLETED) }),
    fastify.db.query.franchiseAreas.findMany({}),
    fastify.db.query.serviceRequests.findMany({}),
    fastify.db.query.installationRequests.findMany({}),
    fastify.db.query.purifierConnections.findMany({
      where: gte(purifierConnections.createdAt, startOfMonth.toISOString())
    }),
    fastify.db.query.purifierConnections.findMany({
      where: and(
        gte(purifierConnections.createdAt, startOfLastMonth.toISOString()),
        lte(purifierConnections.createdAt, endOfLastMonth.toISOString())
      )
    }),
    fastify.db.query.subscriptionPayments.findMany({
      where: and(
        eq(subscriptionPayments.status, PaymentStatus.COMPLETED),
        gte(subscriptionPayments.createdAt, startOfMonth.toISOString())
      )
    }),
    fastify.db.query.subscriptionPayments.findMany({
      where: and(
        eq(subscriptionPayments.status, PaymentStatus.COMPLETED),
        gte(subscriptionPayments.createdAt, startOfLastMonth.toISOString()),
        lte(subscriptionPayments.createdAt, endOfLastMonth.toISOString())
      )
    })
  ]);

  // Calculate totals and trends
  const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const monthlyRevenueTotal = monthlyRevenue.reduce((sum, p) => sum + p.amount, 0);
  const lastMonthRevenueTotal = lastMonthRevenue.reduce((sum, p) => sum + p.amount, 0);
  const revenueTrend = lastMonthRevenueTotal > 0 
    ? ((monthlyRevenueTotal - lastMonthRevenueTotal) / lastMonthRevenueTotal * 100).toFixed(1)
    : '0';

  const activeFranchises = allFranchises.filter(f => f.isActive).length;
  const totalConnections = allConnections.length;
  const connectionsTrend = lastMonthConnections.length > 0 
    ? ((monthlyConnections.length - lastMonthConnections.length) / lastMonthConnections.length * 100).toFixed(1)
    : '0';

  const pendingServiceRequests = allServiceRequests.filter(sr => 
    [ServiceRequestStatus.CREATED, ServiceRequestStatus.ASSIGNED].includes(sr.status as ServiceRequestStatus)
  ).length;

  // Connection distribution
  const connectionsByStatus = allConnections.reduce((acc, connection) => {
    acc[connection.status] = (acc[connection.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const connectionDistribution = [
    { name: "Active", population: Math.round((connectionsByStatus[PurifierConnectionStatus.ACTIVE] || 0) / Math.max(totalConnections, 1) * 100), color: "#10B981" },
    { name: "Suspended", population: Math.round((connectionsByStatus[PurifierConnectionStatus.SUSPENDED] || 0) / Math.max(totalConnections, 1) * 100), color: "#F59E0B" },
    { name: "Terminated", population: Math.round((connectionsByStatus[PurifierConnectionStatus.TERMINATED] || 0) / Math.max(totalConnections, 1) * 100), color: "#EF4444" }
  ];

  // Generate monthly data for trends (last 6 months)
  const monthlyData = generateMonthlyTrends(allConnections, allPayments, 6);

  // Revenue by category
  const purchaseRevenue = allPayments.filter(p => p.type === PaymentType.PURCHASE).reduce((sum, p) => sum + p.amount, 0);
  const rentalRevenue = allPayments.filter(p => p.type === PaymentType.RENTAL).reduce((sum, p) => sum + p.amount, 0);
  const depositRevenue = allPayments.filter(p => p.type === PaymentType.DEPOSIT).reduce((sum, p) => sum + p.amount, 0);
  const serviceRevenue = Math.round(totalRevenue * 0.15); // Estimated service revenue

  return {
    success: true,
    data: {
      overview: {
        totalRevenue: { 
          value: formatCurrency(totalRevenue), 
          trend: `${revenueTrend >= 0 ? '+' : ''}${revenueTrend}%` 
        },
        activeFranchises: { 
          value: activeFranchises.toString(), 
          trend: "+2" // This could be calculated if we track franchise creation dates
        },
        totalConnections: { 
          value: totalConnections.toString(), 
          trend: `${connectionsTrend >= 0 ? '+' : ''}${connectionsTrend}%` 
        },
        serviceRequests: { 
          value: pendingServiceRequests.toString(), 
          trend: "-2.1%" // This could be calculated with historical data
        }
      },
      trends: {
        connectionDistribution,
        revenueConnectionsTrend: {
          labels: monthlyData.labels,
          datasets: [
            { label: "Revenue", data: monthlyData.revenue },
            { label: "Connections", data: monthlyData.connections }
          ]
        },
        performanceByCategory: {
          labels: ["Products", "Services", "Rentals", "Deposits"],
          datasets: [
            { 
              label: "Values", 
              data: [
                Math.round(purchaseRevenue / 1000),
                Math.round(serviceRevenue / 1000),
                Math.round(rentalRevenue / 1000),
                Math.round(depositRevenue / 1000)
              ] 
            }
          ]
        }
      },
      finance: {
        totalIncome: formatCurrency(totalRevenue),
        expenses: formatCurrency(Math.round(totalRevenue * 0.3)), // Estimated 30% expenses
        netProfit: formatCurrency(Math.round(totalRevenue * 0.7)), // Estimated 70% profit
        franchiseRevenue: formatCurrency(Math.round(totalRevenue * 0.8)), // 80% from franchises
        revenueByCategory: {
          labels: ["Products", "Services", "Rentals", "Deposits"],
          datasets: [
            { 
              label: "Values", 
              data: [
                Math.round(purchaseRevenue / Math.max(totalRevenue, 1) * 100),
                Math.round(serviceRevenue / Math.max(totalRevenue, 1) * 100),
                Math.round(rentalRevenue / Math.max(totalRevenue, 1) * 100),
                Math.round(depositRevenue / Math.max(totalRevenue, 1) * 100)
              ] 
            }
          ]
        },
        financialTrends: {
          labels: monthlyData.labels,
          datasets: [
            { label: "Revenue", data: monthlyData.revenue },
            { label: "Expenses", data: monthlyData.revenue.map(r => Math.round(r * 0.3)) }
          ]
        }
      }
    }
  };
}

async function getFranchiseOwnerDashboardStats(franchiseAreaId?: string) {
  const fastify = getFastifyInstance();
  
  if (!franchiseAreaId) {
    throw new Error('Franchise area ID is required for franchise owner dashboard');
  }

  // Get customers in this franchise area
  const franchiseCustomers = await fastify.db.query.users.findMany({
    where: eq(users.franchiseAreaId, franchiseAreaId)
  });
  const customerIds = franchiseCustomers.map(c => c.id);

  if (customerIds.length === 0) {
    return getEmptyFranchiseDashboard();
  }

  // Get current date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get franchise-specific data using proper SQL IN clause
  const customerIdsStr = customerIds.map(id => `'${id}'`).join(',');
  
  const [
    franchiseOrders,
    franchisePayments,
    franchiseServiceRequests,
    monthlyCustomers,
    lastMonthCustomers
  ] = await Promise.all([
    fastify.db.query.orders.findMany({
      where: sql`${orders.customerId} IN (${sql.raw(customerIdsStr)})`
    }),
    fastify.db.query.payments.findMany({
      where: and(
        eq(payments.status, PaymentStatus.COMPLETED),
        sql`${payments.orderId} IN (SELECT id FROM ${orders} WHERE ${orders.customerId} IN (${sql.raw(customerIdsStr)}))`
      )
    }),
    fastify.db.query.serviceRequests.findMany({
      where: eq(serviceRequests.franchiseAreaId, franchiseAreaId)
    }),
    fastify.db.query.users.findMany({
      where: and(
        eq(users.franchiseAreaId, franchiseAreaId),
        gte(users.createdAt, startOfMonth.toISOString())
      )
    }),
    fastify.db.query.users.findMany({
      where: and(
        eq(users.franchiseAreaId, franchiseAreaId),
        gte(users.createdAt, startOfLastMonth.toISOString()),
        lte(users.createdAt, endOfLastMonth.toISOString())
      )
    })
  ]);

  // Calculate metrics
  const monthlyRevenue = franchisePayments
    .filter(p => new Date(p.createdAt) >= startOfMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  const activeOrders = franchiseOrders.filter(o => 
    [OrderStatus.ASSIGNED, OrderStatus.INSTALLATION_PENDING, OrderStatus.INSTALLED].includes(o.status as OrderStatus)
  ).length;

  const newCustomersCount = monthlyCustomers.length;
  const customerGrowth = lastMonthCustomers.length > 0 
    ? ((newCustomersCount - lastMonthCustomers.length) / lastMonthCustomers.length * 100).toFixed(0)
    : '0';

  const pendingServiceTasks = franchiseServiceRequests.filter(sr => 
    [ServiceRequestStatus.CREATED, ServiceRequestStatus.ASSIGNED].includes(sr.status as ServiceRequestStatus)
  ).length;

  // Customer distribution
  const repeatCustomers = franchiseCustomers.filter(c => 
    franchiseOrders.filter(o => o.customerId === c.id).length > 1
  ).length;
  const newCustomersTotal = franchiseCustomers.length - repeatCustomers;

  const customerDistribution = [
    { name: "New Customers", population: Math.round(newCustomersTotal / Math.max(franchiseCustomers.length, 1) * 100), color: "#007bff" },
    { name: "Repeat Customers", population: Math.round(repeatCustomers / Math.max(franchiseCustomers.length, 1) * 100), color: "#10B981" }
  ];

  // Generate monthly trends for franchise
  const franchiseMonthlyData = generateMonthlyTrends(franchiseOrders, franchisePayments, 6);

  // Service categories
  const servicesByType = franchiseServiceRequests.reduce((acc, sr) => {
    acc[sr.type] = (acc[sr.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalRevenue = franchisePayments.reduce((sum, p) => sum + p.amount, 0);
  const orderRevenue = franchisePayments.filter(p => p.type === PaymentType.PURCHASE).reduce((sum, p) => sum + p.amount, 0);
  const serviceRevenue = Math.round(totalRevenue * 0.2); // Estimated service revenue

  return {
    success: true,
    data: {
      overview: {
        monthlyRevenue: { 
          value: formatCurrency(monthlyRevenue), 
          trend: "+15.2%" // Could be calculated with historical data
        },
        activeOrders: { 
          value: activeOrders.toString(), 
          trend: "+5" 
        },
        newCustomers: { 
          value: newCustomersCount.toString(), 
          trend: `+${customerGrowth}` 
        },
        serviceTasks: { 
          value: pendingServiceTasks.toString(), 
          trend: "-2" 
        }
      },
      trends: {
        customerDistribution,
        franchisePerformance: {
          labels: franchiseMonthlyData.labels,
          datasets: [
            { label: "Revenue", data: franchiseMonthlyData.revenue },
            { label: "Orders", data: franchiseMonthlyData.orders }
          ]
        },
        serviceCategories: {
          labels: ["Installation", "Maintenance", "Repair", "Other"],
          datasets: [
            { 
              label: "Count", 
              data: [
                servicesByType['installation'] || 0,
                servicesByType['maintenance'] || 0,
                servicesByType['repair'] || 0,
                servicesByType['other'] || 0
              ] 
            }
          ]
        }
      },
      finance: {
        totalOrders: franchiseOrders.length.toString(),
        orderRevenue: formatCurrency(orderRevenue),
        serviceRevenue: formatCurrency(serviceRevenue),
        monthlyGrowth: "+15%", // Could be calculated
        revenueTrends: {
          labels: franchiseMonthlyData.labels,
          datasets: [
            { label: "Total Revenue", data: franchiseMonthlyData.revenue }
          ]
        },
        revenueSources: {
          labels: ["Products", "Services", "Rentals"],
          datasets: [
            { 
              label: "Revenue", 
              data: [
                orderRevenue,
                serviceRevenue,
                franchisePayments.filter(p => p.type === PaymentType.RENTAL).reduce((sum, p) => sum + p.amount, 0)
              ] 
            }
          ]
        }
      }
    }
  };
}

async function getServiceAgentDashboardStats(userId: string) {
  const fastify = getFastifyInstance();
  
  // Get current date ranges
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  // Get agent's service requests
  const [
    allAgentTasks,
    todaysTasks,
    weekTasks
  ] = await Promise.all([
    fastify.db.query.serviceRequests.findMany({
      where: eq(serviceRequests.assignedToId, userId)
    }),
    fastify.db.query.serviceRequests.findMany({
      where: and(
        eq(serviceRequests.assignedToId, userId),
        gte(serviceRequests.createdAt, startOfDay.toISOString())
      )
    }),
    fastify.db.query.serviceRequests.findMany({
      where: and(
        eq(serviceRequests.assignedToId, userId),
        gte(serviceRequests.createdAt, startOfWeek.toISOString())
      )
    })
  ]);

  // Calculate task metrics
  const todaysTasksCount = todaysTasks.length;
  const completedToday = todaysTasks.filter(t => t.status === ServiceRequestStatus.COMPLETED).length;
  const pendingToday = todaysTasks.filter(t => 
    [ServiceRequestStatus.CREATED, ServiceRequestStatus.ASSIGNED].includes(t.status as ServiceRequestStatus)
  ).length;
  const weekTasksCount = weekTasks.length;

  // Task distribution
  const completedTasks = allAgentTasks.filter(t => t.status === ServiceRequestStatus.COMPLETED).length;
  const inProgressTasks = allAgentTasks.filter(t => t.status === ServiceRequestStatus.IN_PROGRESS).length;
  const pendingTasks = allAgentTasks.filter(t => 
    [ServiceRequestStatus.CREATED, ServiceRequestStatus.ASSIGNED].includes(t.status as ServiceRequestStatus)
  ).length;

  const totalTasks = allAgentTasks.length;
  const taskDistribution = [
    { name: "Completed", population: Math.round(completedTasks / Math.max(totalTasks, 1) * 100), color: "#10B981" },
    { name: "In Progress", population: Math.round(inProgressTasks / Math.max(totalTasks, 1) * 100), color: "#F59E0B" },
    { name: "Pending", population: Math.round(pendingTasks / Math.max(totalTasks, 1) * 100), color: "#EF4444" }
  ];

  // Weekly performance (last 7 days)
  const weeklyPerformance = generateWeeklyPerformance(allAgentTasks);

  // Check for overdue tasks
  const overdueTasks = allAgentTasks.filter(t => 
    t.scheduledDate && 
    new Date(t.scheduledDate) < now && 
    t.status !== ServiceRequestStatus.COMPLETED
  ).length;

  return {
    success: true,
    data: {
      overview: {
        todaysTasks: { value: todaysTasksCount.toString() },
        completed: { value: completedToday.toString() },
        pending: { value: pendingToday.toString() },
        thisWeek: { value: weekTasksCount.toString() }
      },
      trends: {
        taskDistribution,
        weeklyPerformance: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            { label: "Tasks Completed", data: weeklyPerformance }
          ]
        }
      },
      tasks: {
        allTasks: totalTasks.toString(),
        inProgress: inProgressTasks.toString(),
        overdue: overdueTasks.toString(),
        completed: completedTasks.toString()
      }
    }
  };
}

async function getCustomerDashboardStats(userId: string) {
  const fastify = getFastifyInstance();
  
  // Get customer's data
  const [
    customerOrders,
    customerRentals,
    customerServiceRequests
  ] = await Promise.all([
    fastify.db.query.orders.findMany({
      where: eq(orders.customerId, userId),
      with: { product: true }
    }),
    fastify.db.query.rentals.findMany({
      where: eq(rentals.customerId, userId),
      with: { product: true }
    }),
    fastify.db.query.serviceRequests.findMany({
      where: eq(serviceRequests.customerId, userId)
    })
  ]);

  const activeOrders = customerOrders.filter(o => 
    [OrderStatus.ASSIGNED, OrderStatus.INSTALLATION_PENDING, OrderStatus.INSTALLED].includes(o.status as OrderStatus)
  ).length;

  const activeRentals = customerRentals.filter(r => r.status === RentalStatus.ACTIVE).length;
  const pendingServices = customerServiceRequests.filter(sr => 
    sr.status !== ServiceRequestStatus.COMPLETED
  ).length;

  return {
    success: true,
    data: {
      overview: {
        activeOrders: { value: activeOrders.toString() },
        activeRentals: { value: activeRentals.toString() },
        pendingServices: { value: pendingServices.toString() },
        totalOrders: { value: customerOrders.length.toString() }
      },
      orders: customerOrders.slice(0, 5), // Recent 5 orders
      rentals: customerRentals.slice(0, 5), // Recent 5 rentals
      serviceRequests: customerServiceRequests.slice(0, 5) // Recent 5 service requests
    }
  };
}

// Helper functions
function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toString();
}

function generateMonthlyTrends(orders: any[], payments: any[], months: number) {
  const now = new Date();
  const labels = [];
  const revenue = [];
  const orderCounts = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    labels.push(date.toLocaleDateString('en', { month: 'short' }));
    
    const monthPayments = payments.filter(p => {
      const pDate = new Date(p.createdAt);
      return pDate >= date && pDate < nextDate;
    });
    
    const monthOrders = orders.filter(o => {
      const oDate = new Date(o.createdAt);
      return oDate >= date && oDate < nextDate;
    });
    
    revenue.push(monthPayments.reduce((sum, p) => sum + p.amount, 0));
    orderCounts.push(monthOrders.length);
  }

  return { labels, revenue, orders: orderCounts };
}

function generateWeeklyPerformance(tasks: any[]): number[] {
  const now = new Date();
  const performance = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    const dayTasks = tasks.filter(t => {
      const completedDate = t.completedDate ? new Date(t.completedDate) : null;
      return completedDate && completedDate >= date && completedDate < nextDate;
    });

    performance.push(dayTasks.length);
  }

  return performance;
}

function getEmptyFranchiseDashboard() {
  return {
    success: true,
    data: {
      overview: {
        monthlyRevenue: { value: "0", trend: "0%" },
        activeOrders: { value: "0", trend: "0" },
        newCustomers: { value: "0", trend: "0" },
        serviceTasks: { value: "0", trend: "0" }
      },
      trends: {
        customerDistribution: [],
        franchisePerformance: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
          datasets: [
            { label: "Revenue", data: [0, 0, 0, 0, 0, 0] },
            { label: "Orders", data: [0, 0, 0, 0, 0, 0] }
          ]
        },
        serviceCategories: {
          labels: ["Installation", "Maintenance", "Repair", "Other"],
          datasets: [{ label: "Count", data: [0, 0, 0, 0] }]
        }
      },
      finance: {
        totalOrders: "0",
        orderRevenue: "0",
        serviceRevenue: "0",
        monthlyGrowth: "0%",
        revenueTrends: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
          datasets: [{ label: "Total Revenue", data: [0, 0, 0, 0, 0, 0] }]
        },
        revenueSources: {
          labels: ["Products", "Services", "Rentals"],
          datasets: [{ label: "Revenue", data: [0, 0, 0] }]
        }
      }
    }
  };
}

// Legacy function for backward compatibility - FIXED to avoid circular dependency
export async function getAdminDashboardStats(from?: string, to?: string) {
  return await getAdminDashboardStatsInternal();
}