import { FastifyRequest, FastifyReply } from 'fastify';
import * as dashboardService from '../services/dashboard.service';
import { handleError, forbidden } from '../utils/errors';
import { UserRole } from '../types';

export async function getAdminDashboardStats(
  request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
  reply: FastifyReply
) {
  try {
    if (request.user.role !== UserRole.ADMIN) {
      throw forbidden('You are not authorized to view admin dashboard stats');
    }
    const { from, to } = request.query;
    const stats = await dashboardService.getAdminDashboardStats(from, to);
    return reply.code(200).send(stats);
  } catch (error) {
    handleError(error, request, reply);
  }
} 