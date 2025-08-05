// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
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

    console.log('user is inservcie requests ',user)
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

    console.log('service request ',sr)
    console.log('user is ',user)
    // Permission: admin, franchise owner (same area), assigned agent, or customer
    const hasPermission =
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.FRANCHISE_OWNER && sr.franchiseAreaId === user.franchiseAreaId) ||
      (user.role === UserRole.SERVICE_AGENT && sr.assignedToId === user.userId) ||
      (user.role === UserRole.CUSTOMER && sr.customerId === user.userId);
    if (!hasPermission) throw forbidden('You do not have permission to view this service request');
    return reply.code(200).send({ serviceRequest: sr });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Create a new service request - Updated to handle form-data
export async function createServiceRequest(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const user = request.user;
    
    // Handle form-data parsing
    const parts = request.parts();
    const fields: Record<string, any> = {};
    const images: string[] = [];

    for await (const part of parts) {
      if (part.file) {
        // This is a file field (likely "images")
        const filename = `service-requests/${Date.now()}-${part.filename}`;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // Upload to S3 if available
        if (request.server.uploadToS3) {
          const uploadedUrl = await request.server.uploadToS3(buffer, filename, part.mimetype);
          images.push(uploadedUrl);
        }
      } else {
        // This is a regular field
        fields[part.fieldname] = part.value;
      }
    }

    // Prepare service request data
    const serviceRequestData = {
      productId: fields.productId,
      orderId: fields.orderId || undefined,
      type: fields.type,
      description: fields.description,
      scheduledDate: fields.scheduledDate || undefined,
      images: images // Add images to the service request data
    };

    console.log('Service request data:', serviceRequestData);

    const sr = await serviceRequestService.createServiceRequest(serviceRequestData, user);
    return reply.code(201).send({ message: 'Service request created', serviceRequest: sr });
  } catch (error) {
    console.error('Error creating service request:', error);
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

// Start service (with optional images) - NEW ENDPOINT
export async function startService(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = request.user;
    
    // Handle form-data parsing for images
    const parts = request.parts();
    const fields: Record<string, any> = {};
    const images: string[] = [];

    for await (const part of parts) {
      if (part.file) {
        // This is a file field (service start images)
        const filename = `service-requests/${id}/start-${Date.now()}-${part.filename}`;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // Upload to S3 if available
        if (request.server.uploadToS3) {
          const uploadedUrl = await request.server.uploadToS3(buffer, filename, part.mimetype);
          images.push(uploadedUrl);
        }
      } else {
        // This is a regular field
        fields[part.fieldname] = part.value;
      }
    }

    const sr = await serviceRequestService.startService(id, user, {
      notes: fields.notes || '',
      images: images
    });
    
    return reply.code(200).send({ 
      message: 'Service started successfully', 
      serviceRequest: sr 
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Complete service (with optional images) - NEW ENDPOINT
export async function completeService(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = request.user;
    
    // Handle form-data parsing for completion images
    const parts = request.parts();
    const fields: Record<string, any> = {};
    const images: string[] = [];

    for await (const part of parts) {
      if (part.file) {
        // This is a file field (service completion images)
        const filename = `service-requests/${id}/complete-${Date.now()}-${part.filename}`;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // Upload to S3 if available
        if (request.server.uploadToS3) {
          const uploadedUrl = await request.server.uploadToS3(buffer, filename, part.mimetype);
          images.push(uploadedUrl);
        }
      } else {
        // This is a regular field
        fields[part.fieldname] = part.value;
      }
    }

    const sr = await serviceRequestService.completeService(id, user, {
      notes: fields.notes || '',
      images: images
    });
    
    return reply.code(200).send({ 
      message: 'Service completed successfully', 
      serviceRequest: sr 
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Add images to service request - NEW ENDPOINT
export async function addServiceImages(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const user = request.user;
    
    // Handle form-data parsing for additional images
    const parts = request.parts();
    const fields: Record<string, any> = {};
    const images: string[] = [];

    for await (const part of parts) {
      if (part.file) {
        // This is a file field
        const filename = `service-requests/${id}/additional-${Date.now()}-${part.filename}`;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // Upload to S3 if available
        if (request.server.uploadToS3) {
          const uploadedUrl = await request.server.uploadToS3(buffer, filename, part.mimetype);
          images.push(uploadedUrl);
        }
      } else {
        // This is a regular field
        fields[part.fieldname] = part.value;
      }
    }

    const sr = await serviceRequestService.addImages(id, user, images);
    
    return reply.code(200).send({ 
      message: 'Images added successfully', 
      serviceRequest: sr 
    });
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

// Schedule service request - NEW FUNCTION
export async function scheduleServiceRequest(
  request: FastifyRequest<{ Params: { id: string }; Body: { scheduledDate: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { scheduledDate } = request.body;
    const user = request.user;
    
    const sr = await serviceRequestService.scheduleServiceRequest(id, scheduledDate, user);
    return reply.code(200).send({ message: 'Service request scheduled', serviceRequest: sr });
  } catch (error) {
    handleError(error, request, reply);
  }
}