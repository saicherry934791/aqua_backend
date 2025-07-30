import { FastifyRequest, FastifyReply } from 'fastify';
import * as reportingService from '../services/reporting.service';
import { handleError, forbidden } from '../utils/errors';
import { UserRole } from '../types';

// Get franchise performance report
export async function getFranchiseReport(
  request: FastifyRequest<{
    Params: { franchiseAreaId: string };
    Querystring: { from?: string; to?: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { franchiseAreaId } = request.params;
    const { from, to } = request.query;
    const user = request.user;

    // Check permissions
    if (user.role === UserRole.FRANCHISE_OWNER && user.franchiseAreaId !== franchiseAreaId) {
      throw forbidden('You can only view reports for your own franchise area');
    }

    const report = await reportingService.generateFranchiseReport(franchiseAreaId, from, to);
    
    return reply.code(200).send({ report });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Download franchise report
export async function downloadFranchiseReport(
  request: FastifyRequest<{
    Params: { franchiseAreaId: string };
    Querystring: { format?: string; from?: string; to?: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { franchiseAreaId } = request.params;
    const { format = 'pdf', from, to } = request.query;
    const user = request.user;

    if (user.role === UserRole.FRANCHISE_OWNER && user.franchiseAreaId !== franchiseAreaId) {
      throw forbidden('You can only download reports for your own franchise area');
    }

    const report = await reportingService.generateFranchiseReport(franchiseAreaId, from, to);
    
    // For now, return JSON. In production, you'd generate actual PDF/Excel files
    const filename = `franchise-report-${franchiseAreaId}-${Date.now()}.${format}`;
    
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel');
    
    return reply.code(200).send(report);
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get subscription report
export async function getSubscriptionReport(
  request: FastifyRequest<{
    Querystring: { franchiseAreaId?: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { franchiseAreaId } = request.query;
    const user = request.user;

    // Franchise owners can only see their own area
    const targetFranchiseId = user.role === UserRole.FRANCHISE_OWNER 
      ? user.franchiseAreaId 
      : franchiseAreaId;

    const report = await reportingService.generateSubscriptionReport(targetFranchiseId);
    
    return reply.code(200).send({ report });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get service report
export async function getServiceReport(
  request: FastifyRequest<{
    Querystring: { 
      franchiseAreaId?: string;
      agentId?: string;
      from?: string;
      to?: string;
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { franchiseAreaId, agentId, from, to } = request.query;
    const user = request.user;

    // Role-based filtering
    let targetFranchiseId = franchiseAreaId;
    let targetAgentId = agentId;

    if (user.role === UserRole.FRANCHISE_OWNER) {
      targetFranchiseId = user.franchiseAreaId;
    } else if (user.role === UserRole.SERVICE_AGENT) {
      targetAgentId = user.userId;
      targetFranchiseId = user.franchiseAreaId;
    }

    // Generate service report (implementation would be similar to franchise report)
    const report = {
      message: 'Service report functionality to be implemented',
      filters: {
        franchiseAreaId: targetFranchiseId,
        agentId: targetAgentId,
        from,
        to
      }
    };
    
    return reply.code(200).send({ report });
  } catch (error) {
    handleError(error, request, reply);
  }
}