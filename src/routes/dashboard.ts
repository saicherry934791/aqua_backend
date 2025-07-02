import { FastifyInstance } from 'fastify';
import { getDashboardStats, getAdminDashboardStats } from '../controllers/dashboard.controller';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Main dashboard stats endpoint - role-based
  fastify.get(
    '/stats',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            role: { 
              type: 'string', 
              enum: [UserRole.ADMIN, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT, UserRole.CUSTOMER] 
            },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          },
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
        tags: ['dashboard'],
        summary: 'Get role-based dashboard statistics',
        description: 'Returns dashboard statistics based on user role (admin, franchise_owner, service_agent, customer)',
        security: [{ bearerAuth: [] }],
      },
    },
    (request, reply) => getDashboardStats(request as any, reply as any)
  );

  // Legacy admin stats endpoint for backward compatibility
  fastify.get(
    '/admin-stats',
    {
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' }
          },
        },
        tags: ['dashboard'],
        summary: 'Get admin dashboard stats (legacy)',
        description: 'Returns detailed admin dashboard statistics for the given period',
        security: [{ bearerAuth: [] }],
      },
    },
    (request, reply) => getAdminDashboardStats(request as any, reply as any)
  );

  fastify.log.info('Dashboard routes registered');
}