import { FastifyRequest, FastifyReply } from 'fastify';
import * as homescreenService from '../services/homescreen.service';
import { handleError } from '../utils/errors';

export async function getHomescreenData(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const userId = request.user?.userId;
    const data = await homescreenService.getHomescreenData(userId);
    
    return reply.code(200).send({
      success: true,
      data,
      message: 'Homescreen data retrieved successfully'
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}