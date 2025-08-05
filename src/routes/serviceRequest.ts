import { FastifyInstance } from 'fastify';
import {
  getAllServiceRequests,
  getServiceRequestById,
  createServiceRequest,
  updateServiceRequestStatus,
  assignServiceAgent,
  scheduleServiceRequest,
} from '../controllers/serviceRequest.controller';
import {
  getAllServiceRequestsSchema,
  getServiceRequestByIdSchema,
  createServiceRequestSchema,
  updateServiceRequestStatusSchema,
  assignServiceAgentSchema,
  scheduleServiceRequestSchema,
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

  // Create a new service request - Updated to handle form-data
  fastify.post(
    '/',
    {
      schema: {
        consumes: ['multipart/form-data'],
        body: {
          type: 'object',
          required: ['productId', 'type', 'description'],
          properties: {
            productId: { type: 'string' },
            orderId: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' },
            scheduledDate: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              serviceRequest: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' }
            }
          }
        },
        tags: ["service-requests"],
        summary: "Create a new service request",
        description: "Create a new service request for a product/order with optional image attachments",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
      validatorCompiler: () => () => true // Turn off validation for form-data
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

  // Schedule service request - NEW ENDPOINT
  fastify.patch(
    '/:id/schedule',
    {
      schema: scheduleServiceRequestSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => scheduleServiceRequest(request as any, reply as any)
  );

  // Start service with images - NEW ENDPOINT
  fastify.patch(
    '/:id/start',
    {
      schema: {
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              serviceRequest: { type: 'object' }
            }
          }
        },
        tags: ["service-requests"],
        summary: "Start service with optional images",
        description: "Start a service request and optionally upload images",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
      validatorCompiler: () => () => true
    },
    (request, reply) => startService(request as any, reply as any)
  );

  // Complete service with images - NEW ENDPOINT
  fastify.patch(
    '/:id/complete',
    {
      schema: {
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              serviceRequest: { type: 'object' }
            }
          }
        },
        tags: ["service-requests"],
        summary: "Complete service with optional images",
        description: "Complete a service request and optionally upload completion images",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
      validatorCompiler: () => () => true
    },
    (request, reply) => completeService(request as any, reply as any)
  );

  // Add images to service request - NEW ENDPOINT
  fastify.post(
    '/:id/images',
    {
      schema: {
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              serviceRequest: { type: 'object' }
            }
          }
        },
        tags: ["service-requests"],
        summary: "Add images to service request",
        description: "Add additional images to an existing service request",
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
      validatorCompiler: () => () => true
    },
    (request, reply) => addServiceImages(request as any, reply as any)
  );

  fastify.log.info('Service Request routes registered');
}