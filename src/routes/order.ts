import { FastifyInstance } from 'fastify';
import {
  getAllOrders,
  getUserOrders,
  getOrderById,
  getAvailableServiceAgents,
  createOrder,
  updateOrderStatus,
  assignServiceAgent,
  updateInstallationDate,
  cancelOrder,
  initiatePayment,
  verifyPayment,
} from '../controllers/order.controller';
import {
  getAllOrdersSchema,
  getUserOrdersSchema,
  getOrderByIdSchema,
  getAvailableServiceAgentsSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  assignServiceAgentSchema,
  updateInstallationDateSchema,
  cancelOrderSchema,
  initiatePaymentSchema,
  verifyPaymentSchema,
} from '../schemas/order.schema';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Routes for authenticated users
  
  // Get orders for current user
  fastify.get(
    '/my-orders',
    {
      schema: getUserOrdersSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => {
      return getUserOrders(request as any, reply as any);
    }
  );

  // Create new order
  fastify.post(
    '/',
    {
      schema: createOrderSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => {
      return createOrder(request as any, reply as any);
    }
  );

  // Get order by ID (with permission check in controller)
  fastify.get(
    '/:id',
    {
      schema: getOrderByIdSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => {
      return getOrderById(request as any, reply as any);
    }
  );

  // Get available service agents for order assignment
  fastify.get(
    '/:id/available-agents',
    {
      schema: getAvailableServiceAgentsSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
    },
    (request, reply) => {
      return getAvailableServiceAgents(request as any, reply as any);
    }
  );

  // Cancel order (with permission check in controller)
  fastify.delete(
    '/:id',
    {
      schema: cancelOrderSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => {
      return cancelOrder(request as any, reply as any);
    }
  );

  // Initiate payment (with permission check in controller)
  fastify.post(
    '/:id/payment',
    {
      schema: initiatePaymentSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => {
      return initiatePayment(request as any, reply as any);
    }
  );

  // Verify payment
  fastify.post(
    '/:id/verify-payment',
    {
      schema: verifyPaymentSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => {
      return verifyPayment(request as any, reply as any);
    }
  );

  // Admin, franchise owner, and service agent routes
  
  // Get all orders (admin and franchise owner only)
  fastify.get(
    '/',
    {
      schema: getAllOrdersSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
    },
    (request, reply) => {
      return getAllOrders(request as any, reply as any);
    }
  );

  // Update order status (admin, franchise owner, or assigned service agent)
  fastify.patch(
    '/:id/status',
    {
      schema: updateOrderStatusSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT])],
    },
    (request, reply) => {
      return updateOrderStatus(request as any, reply as any);
    }
  );

  // Assign service agent (admin and franchise owner only)
  fastify.patch(
    '/:id/assign',
    {
      schema: assignServiceAgentSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
    },
    (request, reply) => {
      return assignServiceAgent(request as any, reply as any);
    }
  );

  // Update installation date (admin, franchise owner, or service agent)
  fastify.patch(
    '/:id/installation-date',
    {
      schema: updateInstallationDateSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT])],
    },
    (request, reply) => {
      return updateInstallationDate(request as any, reply as any);
    }
  );

  fastify.log.info('Order routes registered');
}