import { FastifyRequest, FastifyReply } from 'fastify';
import * as purifierDashboardService from '../services/purifierDashboard.service';
import { handleError, notFound, forbidden } from '../utils/errors';

// Connect ID login
export async function connectIdLogin(
  request: FastifyRequest<{
    Body: {
      connectId: string;
      phone: string;
    }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId, phone } = request.body;
    const result = await purifierDashboardService.authenticateWithConnectId(connectId, phone);
    
    return reply.code(200).send(result);
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get purifier dashboard data
export async function getPurifierDashboard(
  request: FastifyRequest<{
    Params: { connectId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    const dashboardData = await purifierDashboardService.getPurifierDashboardData(connectId, userId);
    
    return reply.code(200).send({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get plan details
export async function getPlanDetails(
  request: FastifyRequest<{
    Params: { connectId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    const planDetails = await purifierDashboardService.getPlanDetails(connectId, userId);
    
    return reply.code(200).send({ planDetails });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get payment information
export async function getPaymentInfo(
  request: FastifyRequest<{
    Params: { connectId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    const paymentInfo = await purifierDashboardService.getPaymentInfo(connectId, userId);
    
    return reply.code(200).send({ paymentInfo });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get service requests for purifier
export async function getPurifierServiceRequests(
  request: FastifyRequest<{
    Params: { connectId: string };
    Querystring: { status?: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const { status } = request.query;
    const userId = request.user?.userId;
    
    const serviceRequests = await purifierDashboardService.getPurifierServiceRequests(
      connectId, 
      userId, 
      status
    );
    
    return reply.code(200).send({ serviceRequests });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Create service request for purifier
export async function createPurifierServiceRequest(
  request: FastifyRequest<{
    Params: { connectId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    // Handle form-data parsing
    const parts = request.parts();
    const fields: Record<string, any> = {};
    const images: string[] = [];

    for await (const part of parts) {
      if (part.file) {
        const filename = `service-requests/${Date.now()}-${part.filename}`;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        if (request.server.uploadToS3) {
          const uploadedUrl = await request.server.uploadToS3(buffer, filename, part.mimetype);
          images.push(uploadedUrl);
        }
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    const serviceRequestData = {
      type: fields.type,
      description: fields.description,
      images
    };
    
    const serviceRequest = await purifierDashboardService.createPurifierServiceRequest(
      connectId,
      userId,
      serviceRequestData
    );
    
    return reply.code(201).send({
      message: 'Service request created successfully',
      serviceRequest
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get payment history
export async function getPaymentHistory(
  request: FastifyRequest<{
    Params: { connectId: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    const paymentHistory = await purifierDashboardService.getPaymentHistory(connectId, userId);
    
    return reply.code(200).send({ paymentHistory });
  } catch (error) {
    handleError(error, request, reply);
  }
}