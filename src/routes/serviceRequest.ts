import { FastifyInstance } from 'fastify';
import {
  getAllServiceRequests,
  getServiceRequestById,
  createServiceRequest,
  updateServiceRequestStatus,
  assignServiceAgent,
} from '../controllers/serviceRequest.controller';
import {
  getAllServiceRequestsSchema,
  getServiceRequestByIdSchema,
  createServiceRequestSchema,
  updateServiceRequestStatusSchema,
  assignServiceAgentSchema,
} from '../schemas/serviceRequest.schema';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Get all service requests (admin, franchise owner, service agent)
  fastify.get(
    '/',
    {
      schema: getAllServiceRequestsSchema,
      preHandler: [fastify.authenticate],
      // preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT,UserRole.CUSTOMER])],
    },
    (request, reply) => getAllServiceRequests(request as any, reply as any)
  );

  // Get service request by ID
  fastify.get(
    '/:id',
    {
      schema: getServiceRequestByIdSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => getServiceRequestById(request as any, reply as any)
  );

  // Create a new service request
  fastify.post(
    '/',
    {
      schema: createServiceRequestSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => createServiceRequest(request as any, reply as any)
  );

  // Update service request status
  fastify.patch(
    '/:id/status',
    {
      schema: updateServiceRequestStatusSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => updateServiceRequestStatus(request as any, reply as any)
  );

  // Assign service agent
  fastify.patch(
    '/:id/assign',
    {
      schema: assignServiceAgentSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
    },
    (request, reply) => assignServiceAgent(request as any, reply as any)
  );

  fastify.log.info('Service Request routes registered');
} 