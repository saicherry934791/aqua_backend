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
          required: ['type', 'description'],
          properties: {
            productId: { type: 'string' },
            purifierConnectionId: { type: 'string' },
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

  // Accept service request (for agents)
  fastify.post(
    '/:id/accept',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
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
        summary: "Accept service request",
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.SERVICE_AGENT])]
    },
    async (request: any, reply: any) => {
      const { id } = request.params;
      const agentId = request.user.userId;
      
      const serviceRequest = await serviceRequestService.acceptServiceRequest(id, agentId);
      
      return reply.code(200).send({
        message: 'Service request accepted successfully',
        serviceRequest
      });
    }
  );

  // Complete service request with images
  fastify.post(
    '/:id/complete',
    {
      schema: {
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            serviceNotes: { type: 'string' },
            paymentRequired: { type: 'string', enum: ['true', 'false'] },
            paymentAmount: { type: 'string' },
            beforeImages: {
              type: 'array',
              items: { type: 'string', format: 'binary' }
            },
            afterImages: {
              type: 'array',
              items: { type: 'string', format: 'binary' }
            },
            paymentProofImage: { type: 'string', format: 'binary' }
          }
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
        summary: "Complete service request with images",
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.SERVICE_AGENT])],
      validatorCompiler: () => () => true
    },
    async (request: any, reply: any) => {
      const { id } = request.params;
      const agentId = request.user.userId;
      
      // Handle form-data parsing
      const parts = request.parts();
      const fields: Record<string, any> = {};
      const beforeImages: string[] = [];
      const afterImages: string[] = [];
      let paymentProofImage: string | undefined;

      for await (const part of parts) {
        if (part.file) {
          const filename = `service-completion/${Date.now()}-${part.filename}`;
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          
          if (request.server.uploadToS3) {
            const uploadedUrl = await request.server.uploadToS3(buffer, filename, part.mimetype);
            
            if (part.fieldname === 'beforeImages') {
              beforeImages.push(uploadedUrl);
            } else if (part.fieldname === 'afterImages') {
              afterImages.push(uploadedUrl);
            } else if (part.fieldname === 'paymentProofImage') {
              paymentProofImage = uploadedUrl;
            }
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const completionData = {
        beforeImages,
        afterImages,
        serviceNotes: fields.serviceNotes,
        paymentRequired: fields.paymentRequired === 'true',
        paymentAmount: fields.paymentAmount ? Number(fields.paymentAmount) : undefined,
        paymentProofImage
      };

      const serviceRequest = await serviceRequestService.completeServiceRequest(
        id,
        agentId,
        completionData
      );
      
      return reply.code(200).send({
        message: 'Service request completed successfully',
        serviceRequest
      });
    }
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

  fastify.log.info('Service Request routes registered');
}