import { FastifyInstance } from 'fastify';
import {
  getAllOrders,
  getUserOrders,
  getOrderById,
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
    getUserOrders
  );

  // Create new order
  fastify.post(
    '/',
    {
      schema: createOrderSchema,
      preHandler: [fastify.authenticate],
    },
    createOrder
  );

  // Get order by ID (with permission check in controller)
  fastify.get(
    '/:id',
    {
      schema: getOrderByIdSchema,
      preHandler: [fastify.authenticate],
    },
    getOrderById
  );

  // Cancel order (with permission check in controller)
  fastify.delete(
    '/:id',
    {
      schema: cancelOrderSchema,
      preHandler: [fastify.authenticate],
    },
    cancelOrder
  );

  // Initiate payment (with permission check in controller)
  fastify.post(
    '/:id/payment',
    {
      schema: initiatePaymentSchema,
      preHandler: [fastify.authenticate],
    },
    initiatePayment
  );

  // Verify payment
  fastify.post(
    '/:id/verify-payment',
    {
      schema: verifyPaymentSchema,
      preHandler: [fastify.authenticate],
    },
    verifyPayment
  );

  // Admin, franchise owner, and service agent routes
  
  // Get all orders (admin and franchise owner only)
  fastify.get(
    '/',
    {
      schema: getAllOrdersSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
    },
    getAllOrders
  );

  // Update order status (admin, franchise owner, or assigned service agent)
  fastify.patch(
    '/:id/status',
    {
      schema: updateOrderStatusSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT])],
    },
    updateOrderStatus
  );

  // Assign service agent (admin and franchise owner only)
  fastify.patch(
    '/:id/assign',
    {
      schema: assignServiceAgentSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
    },
    assignServiceAgent
  );

  // Update installation date (admin, franchise owner, or service agent)
  fastify.patch(
    '/:id/installation-date',
    {
      schema: updateInstallationDateSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT])],
    },
    updateInstallationDate
  );

  fastify.log.info('Order routes registered');
}