import { FastifyInstance } from 'fastify';
import {
  getFranchiseReport,
  getSubscriptionReport,
  getServiceReport,
  downloadFranchiseReport
} from '../controllers/reports.controller';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Get franchise performance report
  fastify.get(
    '/franchise/:franchiseAreaId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            franchiseAreaId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              report: { type: 'object' }
            }
          }
        },
        tags: ['reports'],
        summary: 'Get franchise performance report',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])]
    },
    getFranchiseReport
  );

  // Download franchise report as PDF/Excel
  fastify.get(
    '/franchise/:franchiseAreaId/download',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            franchiseAreaId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['pdf', 'excel'] },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          }
        },
        tags: ['reports'],
        summary: 'Download franchise report',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])]
    },
    downloadFranchiseReport
  );

  // Get subscription report
  fastify.get(
    '/subscriptions',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            franchiseAreaId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              report: { type: 'object' }
            }
          }
        },
        tags: ['reports'],
        summary: 'Get subscription report',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])]
    },
    getSubscriptionReport
  );

  // Get service report
  fastify.get(
    '/services',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            franchiseAreaId: { type: 'string' },
            agentId: { type: 'string' },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              report: { type: 'object' }
            }
          }
        },
        tags: ['reports'],
        summary: 'Get service report',
        security: [{ bearerAuth: [] }]
      },
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT])]
    },
    getServiceReport
  );

  fastify.log.info('Reports routes registered');
}