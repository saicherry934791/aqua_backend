import { FastifyInstance } from 'fastify';
import {
  createInstallationRequest,
  getUserInstallationRequests,
  getAllInstallationRequests,
  getInstallationRequestById,
  updateInstallationRequestStatus,
  approveInstallationRequest
} from '../controllers/installationRequest.controller';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Create installation request
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['productId', 'customerName', 'customerPhone', 'city', 'installationAddress', 'locationLatitude', 'locationLongitude'],
          properties: {
            productId: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            city: { type: 'string' },
            installationAddress: { type: 'string' },
            locationLatitude: { type: 'number' },
            locationLongitude: { type: 'number' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              installationRequest: { type: 'object' }
            }
          }
        },
        tags: ['installation-requests'],
        summary: 'Create installation request',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    createInstallationRequest
  );

  // Get user's installation requests
  fastify.get(
    '/my-requests',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              installationRequests: { type: 'array' }
            }
          }
        },
        tags: ['installation-requests'],
        summary: 'Get user installation requests',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getUserInstallationRequests
  );

  // Get all installation requests (admin/franchise owner)
  fastify.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            franchiseAreaId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              installationRequests: { type: 'array' }
            }
          }
        },
        tags: ['installation-requests'],
        summary: 'Get all installation requests',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])]
    },
    getAllInstallationRequests
  );

  // Get installation request by ID
  fastify.get(
    '/:id',
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
              installationRequest: { type: 'object' }
            }
          }
        },
        tags: ['installation-requests'],
        summary: 'Get installation request by ID',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getInstallationRequestById
  );

  // Update installation request status
  fastify.patch(
    '/:id/status',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              installationRequest: { type: 'object' }
            }
          }
        },
        tags: ['installation-requests'],
        summary: 'Update installation request status',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])]
    },
    updateInstallationRequestStatus
  );

  // Approve installation request
  fastify.post(
    '/:id/approve',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['planName', 'planType'],
          properties: {
            planName: { type: 'string' },
            planType: { type: 'string', enum: ['rental', 'purchase'] },
            monthlyAmount: { type: 'number' },
            notes: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              installationRequest: { type: 'object' },
              purifierConnection: { type: 'object' },
              connectId: { type: 'string' }
            }
          }
        },
        tags: ['installation-requests'],
        summary: 'Approve installation request and generate connect ID',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])]
    },
    approveInstallationRequest
  );

  fastify.log.info('Installation Request routes registered');
}