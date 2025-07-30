import { FastifyInstance } from 'fastify';
import {
  createAutopaySubscription,
  processManualPayment,
  getSubscriptionDetails,
  pauseSubscription,
  resumeSubscription
} from '../controllers/subscription.controller';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Create autopay subscription
  fastify.post(
    '/:connectId/autopay',
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
              message: { type: 'string' },
              subscriptionId: { type: 'string' }
            }
          }
        },
        tags: ['subscriptions'],
        summary: 'Enable autopay for subscription',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    createAutopaySubscription
  );

  // Process manual payment
  fastify.post(
    '/:connectId/manual-payment',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            connectId: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number' },
            paymentMethod: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              paymentId: { type: 'string' }
            }
          }
        },
        tags: ['subscriptions'],
        summary: 'Process manual payment',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    processManualPayment
  );

  // Get subscription details
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
              subscription: { type: 'object' }
            }
          }
        },
        tags: ['subscriptions'],
        summary: 'Get subscription details',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    getSubscriptionDetails
  );

  // Pause subscription
  fastify.post(
    '/:connectId/pause',
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
              message: { type: 'string' }
            }
          }
        },
        tags: ['subscriptions'],
        summary: 'Pause subscription',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    pauseSubscription
  );

  // Resume subscription
  fastify.post(
    '/:connectId/resume',
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
              message: { type: 'string' }
            }
          }
        },
        tags: ['subscriptions'],
        summary: 'Resume subscription',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authenticate]
    },
    resumeSubscription
  );

  // Webhook endpoint for Razorpay
  fastify.post(
    '/webhook',
    {
      schema: {
        body: { type: 'object' },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' }
            }
          }
        },
        tags: ['subscriptions'],
        summary: 'Razorpay webhook endpoint'
      }
    },
    async (request, reply) => {
      // Webhook processing logic would go here
      return reply.code(200).send({ status: 'ok' });
    }
  );

  fastify.log.info('Subscription routes registered');
}