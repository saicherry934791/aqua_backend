import { FastifyRequest, FastifyReply } from 'fastify';
import * as installationRequestService from '../services/installationRequest.service';
import { handleError, notFound, forbidden, badRequest } from '../utils/errors';
import { UserRole, InstallationRequestStatus } from '../types';

// Create installation request
export async function createInstallationRequest(
  request: FastifyRequest<{
    Body: {
      productId: string;
      customerName: string;
      customerPhone: string;
      city: string;
      installationAddress: string;
      locationLatitude: number;
      locationLongitude: number;
    }
  }>,
  reply: FastifyReply
) {
  try {
    const userId = request.user.userId;
    const requestData = {
      ...request.body,
      customerId: userId
    };

    const installationRequest = await installationRequestService.createInstallationRequest(requestData);
    
    return reply.code(201).send({
      message: 'Installation request created successfully',
      installationRequest
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get user's installation requests
export async function getUserInstallationRequests(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const userId = request.user.userId;
    const requests = await installationRequestService.getUserInstallationRequests(userId);
    
    return reply.code(200).send({ installationRequests: requests });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get all installation requests (admin/franchise owner)
export async function getAllInstallationRequests(
  request: FastifyRequest<{
    Querystring: {
      status?: InstallationRequestStatus;
      franchiseAreaId?: string;
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { status, franchiseAreaId } = request.query;
    const user = request.user;

    const requests = await installationRequestService.getAllInstallationRequests(
      { status, franchiseAreaId },
      user
    );
    
    return reply.code(200).send({ installationRequests: requests });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get installation request by ID
export async function getInstallationRequestById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = request.user;
    
    const installationRequest = await installationRequestService.getInstallationRequestById(id);
    
    if (!installationRequest) {
      throw notFound('Installation Request');
    }

    // Check permissions
    const hasPermission = 
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.FRANCHISE_OWNER && installationRequest.franchiseAreaId === user.franchiseAreaId) ||
      installationRequest.customerId === user.userId;

    if (!hasPermission) {
      throw forbidden('You do not have permission to view this installation request');
    }
    
    return reply.code(200).send({ installationRequest });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update installation request status
export async function updateInstallationRequestStatus(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      status: InstallationRequestStatus;
      notes?: string;
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { status, notes } = request.body;
    const user = request.user;

    // Only admin and franchise owners can update status
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER].includes(user.role)) {
      throw forbidden('You are not authorized to update installation request status');
    }

    const updatedRequest = await installationRequestService.updateInstallationRequestStatus(
      id,
      status,
      notes,
      user.userId
    );
    
    return reply.code(200).send({
      message: 'Installation request status updated successfully',
      installationRequest: updatedRequest
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Approve installation request and generate connect ID
export async function approveInstallationRequest(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      planName: string;
      planType: 'rental' | 'purchase';
      monthlyAmount?: number;
      notes?: string;
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { planName, planType, monthlyAmount, notes } = request.body;
    const user = request.user;

    // Only admin and franchise owners can approve
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER].includes(user.role)) {
      throw forbidden('You are not authorized to approve installation requests');
    }

    const result = await installationRequestService.approveInstallationRequest(
      id,
      {
        planName,
        planType,
        monthlyAmount,
        notes
      },
      user.userId
    );
    
    return reply.code(200).send({
      message: 'Installation request approved successfully',
      installationRequest: result.installationRequest,
      purifierConnection: result.purifierConnection,
      connectId: result.connectId
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}