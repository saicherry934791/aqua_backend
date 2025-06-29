import { FastifyRequest, FastifyReply } from 'fastify';
import * as serviceRequestService from '../services/serviceRequest.service';
import { handleError, notFound, badRequest, forbidden } from '../utils/errors';
import { UserRole } from '../types';

// Get all service requests
export async function getAllServiceRequests(
  request: FastifyRequest<{ Querystring: any }>,
  reply: FastifyReply
) {
  try {
    const filters = request.query;
    const user = request.user;
    const serviceRequests = await serviceRequestService.getAllServiceRequests(filters, user);
    return reply.code(200).send({ serviceRequests });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get service request by ID
export async function getServiceRequestById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = request.user;
    const sr = await serviceRequestService.getServiceRequestById(id);
    if (!sr) throw notFound('Service Request');
    // Permission: admin, franchise owner (same area), assigned agent, or customer
    const hasPermission =
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.FRANCHISE_OWNER && sr.franchiseAreaId === user.franchiseAreaId) ||
      (user.role === UserRole.SERVICE_AGENT && sr.assignedToId === user.id) ||
      (user.role === UserRole.CUSTOMER && sr.customerId === user.id);
    if (!hasPermission) throw forbidden('You do not have permission to view this service request');
    return reply.code(200).send({ serviceRequest: sr });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Create a new service request
export async function createServiceRequest(
  request: FastifyRequest<{ Body: any }>,
  reply: FastifyReply
) {
  try {
    const user = request.user;
    const sr = await serviceRequestService.createServiceRequest(request.body, user);
    return reply.code(201).send({ message: 'Service request created', serviceRequest: sr });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update service request status
export async function updateServiceRequestStatus(
  request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { status } = request.body;
    const user = request.user;
    const sr = await serviceRequestService.updateServiceRequestStatus(id, status, user);
    return reply.code(200).send({ message: 'Service request status updated', serviceRequest: sr });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Assign service agent
export async function assignServiceAgent(
  request: FastifyRequest<{ Params: { id: string }; Body: { assignedToId: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { assignedToId } = request.body;
    const user = request.user;
    const sr = await serviceRequestService.assignServiceAgent(id, assignedToId, user);
    return reply.code(200).send({ message: 'Service agent assigned', serviceRequest: sr });
  } catch (error) {
    handleError(error, request, reply);
  }
} 