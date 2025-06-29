import { FastifyInstance } from 'fastify';
import { getAdminDashboardStats } from '../controllers/dashboard.controller';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
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
        summary: 'Get admin dashboard stats',
        description: 'Returns detailed admin dashboard statistics for the given period',
        security: [{ bearerAuth: [] }],
      },
    },
    (request, reply) => getAdminDashboardStats(request as any, reply as any)
  );
  fastify.log.info('Dashboard routes registered');
} 