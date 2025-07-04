// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import * as dashboardService from '../services/dashboard.service';
import { handleError, forbidden, badRequest } from '../utils/errors';
import { UserRole } from '../types';

export async function getDashboardStats(
  request: FastifyRequest<{ 
    Querystring: { 
      role?: UserRole;
      from?: string; 
      to?: string;
    } 
  }>,
  reply: FastifyReply
) {
  try {
    const { role } = request.query;
    const user = request.user;
    
    // If role is specified in query, validate it matches user's role (except for admin)
    if (role && role !== user.role && user.role !== UserRole.ADMIN) {
      throw forbidden('You cannot access dashboard data for other roles');
    }
    
    // Use the role from query if provided, otherwise use user's role
    const targetRole = role || user.role;
    
    const stats = await dashboardService.getDashboardStats(
      user.userId, 
      targetRole, 
      user.franchiseAreaId
    );
    
    return reply.code(200).send(stats);
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Legacy function for backward compatibility
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