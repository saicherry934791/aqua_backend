import { FastifyInstance } from 'fastify';
import {
  connectIdLogin,
  getPurifierDashboard,
  getPlanDetails,
  getPaymentInfo,
  getPurifierServiceRequests,
  createPurifierServiceRequest,
  getPaymentHistory
} from '../controllers/purifierDashboard.controller';

export default async function (fastify: FastifyInstance) {
  // Connect ID login
  fastify.post(
    '/connect-login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['connectId', 'phone'],
          properties: {
            connectId: { type: 'string' },
            phone: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              user: { type: 'object' },
              purifierConnection: { type: 'object' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Login with Connect ID'
      }
    },
    connectIdLogin
  );

  // Get purifier dashboard
  fastify.get(
    '/:connectId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Get purifier dashboard data',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getPurifierDashboard
  );

  // Get plan details
  fastify.get(
    '/:connectId/plan',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              planDetails: { type: 'object' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Get plan details',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getPlanDetails
  );

  // Get payment info
  fastify.get(
    '/:connectId/payment-info',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              paymentInfo: { type: 'object' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Get payment information',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getPaymentInfo
  );

  // Get service requests
  fastify.get(
    '/:connectId/service-requests',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              serviceRequests: { type: 'array' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Get purifier service requests',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getPurifierServiceRequests
  );

  // Create service request
  fastify.post(
    '/:connectId/service-requests',
    {
      schema: {
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['type', 'description'],
          properties: {
            type: { type: 'string' },
            description: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' }
            }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              serviceRequest: { type: 'object' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Create service request for purifier',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate],
      validatorCompiler: () => () => true
    },
    createPurifierServiceRequest
  );

  // Get payment history
  fastify.get(
    '/:connectId/payment-history',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              paymentHistory: { type: 'array' }
            }
          }
        },
        tags: ['purifier-dashboard'],
        summary: 'Get payment history',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getPaymentHistory
  );

  fastify.log.info('Purifier Dashboard routes registered');
}