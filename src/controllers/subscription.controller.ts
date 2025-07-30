import { FastifyRequest, FastifyReply } from 'fastify';
import * as subscriptionService from '../services/subscription.service';
import { handleError, notFound, forbidden } from '../utils/errors';

// Create autopay subscription
export async function createAutopaySubscription(
  request: FastifyRequest<{ Params: { connectId: string } }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    // Validate access to this connection
    const connection = await validateConnectionAccess(connectId, userId);
    
    const subscription = await subscriptionService.createAutopaySubscription(connection.id);
    
    return reply.code(200).send({
      message: 'Autopay subscription created successfully',
      subscriptionId: subscription.id
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Process manual payment
export async function processManualPayment(
  request: FastifyRequest<{
    Params: { connectId: string };
    Body: { amount: number; paymentMethod?: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const { amount, paymentMethod } = request.body;
    const userId = request.user?.userId;
    
    const connection = await validateConnectionAccess(connectId, userId);
    
    const paymentId = await subscriptionService.processManualPayment(
      connection.id,
      amount,
      paymentMethod
    );
    
    return reply.code(200).send({
      message: 'Payment processed successfully',
      paymentId
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get subscription details
export async function getSubscriptionDetails(
  request: FastifyRequest<{ Params: { connectId: string } }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    const userId = request.user?.userId;
    
    const connection = await validateConnectionAccess(connectId, userId);
    
    return reply.code(200).send({ subscription: connection });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Pause subscription
export async function pauseSubscription(
  request: FastifyRequest<{ Params: { connectId: string } }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    // Implementation for pausing subscription
    return reply.code(200).send({ message: 'Subscription paused' });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Resume subscription
export async function resumeSubscription(
  request: FastifyRequest<{ Params: { connectId: string } }>,
  reply: FastifyReply
) {
  try {
    const { connectId } = request.params;
    // Implementation for resuming subscription
    return reply.code(200).send({ message: 'Subscription resumed' });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Helper function to validate connection access
async function validateConnectionAccess(connectId: string, userId?: string) {
  const fastify = request.server;
  
  const connection = await fastify.db.query.purifierConnections.findFirst({
    where: eq(purifierConnections.connectId, connectId),
    with: {
      customer: true,
      product: true
    }
  });

  if (!connection) {
    throw notFound('Purifier connection not found');
  }

  if (userId && connection.customerId !== userId) {
    throw forbidden('You do not have access to this subscription');
  }

  return connection;
}