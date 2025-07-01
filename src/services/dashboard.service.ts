import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { users, franchiseAreas, products, orders, rentals, serviceRequests, payments } from '../models/schema';
import { UserRole, RentalStatus, OrderType, OrderStatus, PaymentStatus, PaymentType, ServiceRequestStatus } from '../types';
import { getFastifyInstance } from '../shared/fastify-instance';

export async function getAdminDashboardStats(from?: string, to?: string) {
  const fastify = getFastifyInstance()
  const dateFilter = (col: any) => {
    if (from && to) return and(gte(col, from), lte(col, to));
    if (from) return gte(col, from);
    if (to) return lte(col, to);
    return undefined;
  };

  // Users
  const allUsers = await fastify.db.query.users.findMany({});
  const usersByRole = allUsers.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {} as Record<string, number>);
  const newUsers = from || to ? allUsers.filter(u => {
    const d = new Date(u.createdAt);
    return (!from || d >= new Date(from)) && (!to || d <= new Date(to));
  }).length : 0;
  const activeUsers = allUsers.filter(u => u.isActive).length;
  const inactiveUsers = allUsers.filter(u => !u.isActive).length;

  // Franchises
  const allFranchises = await fastify.db.query.franchiseAreas.findMany({});
  const activeFranchises = allFranchises.filter(f => f.isActive).length;
  const inactiveFranchises = allFranchises.filter(f => !f.isActive).length;

  // Products
  const allProducts = await fastify.db.query.products.findMany({});
  const activeProducts = allProducts.filter(p => p.isActive).length;
  const inactiveProducts = allProducts.filter(p => !p.isActive).length;

  // Orders
  const allOrders = await fastify.db.query.orders.findMany({});
  const ordersByType = allOrders.reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  // Rentals
  const allRentals = await fastify.db.query.rentals.findMany({});
  const rentalsByStatus = allRentals.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  // Service Requests
  const allSRs = await fastify.db.query.serviceRequests.findMany({});
  const serviceRequestsByStatus = allSRs.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  // Payments
  const allPayments = await fastify.db.query.payments.findMany({});
  const paymentsByStatus = allPayments.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const revenueByType = allPayments.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + (p.status === PaymentStatus.COMPLETED ? p.amount : 0);
    return acc;
  }, {} as Record<string, number>);
  const totalRevenue = Object.values(revenueByType).reduce((a, b) => a + b, 0);

  // Top products (by orders)
  const productOrderCounts: Record<string, { name: string; totalOrders: number; totalRevenue: number }> = {};
  for (const o of allOrders) {
    if (!productOrderCounts[o.productId]) {
      const prod = allProducts.find(p => p.id === o.productId);
      productOrderCounts[o.productId] = { name: prod?.name || '', totalOrders: 0, totalRevenue: 0 };
    }
    productOrderCounts[o.productId].totalOrders++;
    productOrderCounts[o.productId].totalRevenue += o.totalAmount || 0;
  }
  const topProducts = Object.entries(productOrderCounts)
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 5);

  // Top franchises (by revenue)
  const franchiseRevenue: Record<string, { name: string; totalOrders: number; totalRevenue: number }> = {};
  for (const o of allOrders) {
    const user = allUsers.find(u => u.id === o.customerId);
    const franchiseId = user?.franchiseAreaId;
    if (!franchiseId) continue;
    if (!franchiseRevenue[franchiseId]) {
      const fr = allFranchises.find(f => f.id === franchiseId);
      franchiseRevenue[franchiseId] = { name: fr?.name || '', totalOrders: 0, totalRevenue: 0 };
    }
    franchiseRevenue[franchiseId].totalOrders++;
    franchiseRevenue[franchiseId].totalRevenue += o.totalAmount || 0;
  }
  const topFranchises = Object.entries(franchiseRevenue)
    .map(([franchiseId, data]) => ({ franchiseId, ...data }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Recent activity
  const recentOrders = allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  const recentRentals = allRentals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  const recentServiceRequests = allSRs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  const recentPayments = allPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  // Time series (daily for the period)
  // For brevity, only revenue and new users are implemented here
  const timeSeries: any = { revenue: [], newUsers: [], orders: [], rentals: [], serviceRequests: [] };
  if (from && to) {
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().slice(0, 10);
      timeSeries.revenue.push({ date: day, amount: allPayments.filter(p => p.status === PaymentStatus.COMPLETED && p.createdAt.slice(0, 10) === day).reduce((a, b) => a + b.amount, 0) });
      timeSeries.newUsers.push({ date: day, count: allUsers.filter(u => u.createdAt.slice(0, 10) === day).length });
      timeSeries.orders.push({ date: day, count: allOrders.filter(o => o.createdAt.slice(0, 10) === day).length });
      timeSeries.rentals.push({ date: day, count: allRentals.filter(r => r.createdAt.slice(0, 10) === day).length });
      timeSeries.serviceRequests.push({ date: day, count: allSRs.filter(s => s.createdAt.slice(0, 10) === day).length });
    }
  }

  return {
    overview: {
      totalUsers: allUsers.length,
      usersByRole,
      newUsers,
      activeUsers,
      inactiveUsers,
      totalFranchises: allFranchises.length,
      activeFranchises,
      inactiveFranchises,
      totalProducts: allProducts.length,
      activeProducts,
      inactiveProducts,
      totalOrders: allOrders.length,
      ordersByType,
      totalRentals: allRentals.length,
      rentalsByStatus,
      totalServiceRequests: allSRs.length,
      serviceRequestsByStatus,
      totalRevenue,
      revenueByType,
      totalPayments: allPayments.length,
      paymentsByStatus
    },
    topProducts,
    topFranchises,
    recentOrders,
    recentRentals,
    recentServiceRequests,
    recentPayments,
    timeSeries
  };
} 