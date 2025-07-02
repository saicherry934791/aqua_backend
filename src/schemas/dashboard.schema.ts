import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UserRole } from '../types';
import { ErrorResponseSchema } from './auth.schema';

// Dashboard Stats Request Schema
export const DashboardStatsQuerySchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT, UserRole.CUSTOMER]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// Common metric schema
export const MetricSchema = z.object({
  value: z.string(),
  trend: z.string().optional(),
});

// Chart dataset schema
export const ChartDatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.number()),
});

// Chart schema
export const ChartSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
});

// Distribution item schema
export const DistributionItemSchema = z.object({
  name: z.string(),
  population: z.number(),
  color: z.string(),
});

// Admin Dashboard Response Schema
export const AdminDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: z.object({
      totalRevenue: MetricSchema,
      activeFranchises: MetricSchema,
      totalOrders: MetricSchema,
      serviceRequests: MetricSchema,
    }),
    trends: z.object({
      orderDistribution: z.array(DistributionItemSchema),
      revenueOrdersTrend: ChartSchema,
      performanceByCategory: ChartSchema,
    }),
    finance: z.object({
      totalIncome: z.string(),
      expenses: z.string(),
      netProfit: z.string(),
      franchiseRevenue: z.string(),
      revenueByCategory: ChartSchema,
      financialTrends: ChartSchema,
    }),
  }),
});

// Franchise Owner Dashboard Response Schema
export const FranchiseOwnerDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: z.object({
      monthlyRevenue: MetricSchema,
      activeOrders: MetricSchema,
      newCustomers: MetricSchema,
      serviceTasks: MetricSchema,
    }),
    trends: z.object({
      customerDistribution: z.array(DistributionItemSchema),
      franchisePerformance: ChartSchema,
      serviceCategories: ChartSchema,
    }),
    finance: z.object({
      totalOrders: z.string(),
      orderRevenue: z.string(),
      serviceRevenue: z.string(),
      monthlyGrowth: z.string(),
      revenueTrends: ChartSchema,
      revenueSources: ChartSchema,
    }),
  }),
});

// Service Agent Dashboard Response Schema
export const ServiceAgentDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: z.object({
      todaysTasks: z.object({ value: z.string() }),
      completed: z.object({ value: z.string() }),
      pending: z.object({ value: z.string() }),
      thisWeek: z.object({ value: z.string() }),
    }),
    trends: z.object({
      taskDistribution: z.array(DistributionItemSchema),
      weeklyPerformance: ChartSchema,
    }),
    tasks: z.object({
      allTasks: z.string(),
      inProgress: z.string(),
      overdue: z.string(),
      completed: z.string(),
    }),
  }),
});

// Customer Dashboard Response Schema
export const CustomerDashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    overview: z.object({
      activeOrders: z.object({ value: z.string() }),
      activeRentals: z.object({ value: z.string() }),
      pendingServices: z.object({ value: z.string() }),
      totalOrders: z.object({ value: z.string() }),
    }),
    orders: z.array(z.any()),
    rentals: z.array(z.any()),
    serviceRequests: z.array(z.any()),
  }),
});

// Export schemas for route definitions
export const dashboardStatsSchema = {
  querystring: zodToJsonSchema(DashboardStatsQuerySchema),
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' }
      }
    },
    400: zodToJsonSchema(ErrorResponseSchema),
    401: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ['dashboard'],
  summary: 'Get role-based dashboard statistics',
  description: 'Returns comprehensive dashboard statistics based on user role',
  security: [{ bearerAuth: [] }],
};