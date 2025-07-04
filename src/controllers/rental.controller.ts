// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';
import * as rentalService from '../services/rental.service';
import { handleError, notFound, badRequest, forbidden } from '../utils/errors';
import { UserRole, RentalStatus } from '../types';

// Get all rentals (admin or franchise owner only)
export async function getAllRentals(
  request: FastifyRequest<{ Querystring: { status?: RentalStatus } }>,
  reply: FastifyReply
) {
try {
    const { status } = request.query;
    
    // Only admins and franchise owners can see all rentals
    if (![UserRole.ADMIN, UserRole.FRANCHISE_OWNER].includes(request.user.role)) {
      throw forbidden('You are not authorized to view all rentals');
    }
    
    const rentals = await rentalService.getAllRentals(status, request.user);
    return reply.code(200).send({ rentals });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get rentals for current user
export async function getUserRentals(
  request: FastifyRequest<{ Querystring: { status?: RentalStatus } }>,
  reply: FastifyReply
) {
  try {
    const { status } = request.query;
    const userId = request.user.userId;
    
    const rentals = await rentalService.getUserRentals(userId, status);
    return reply.code(200).send({ rentals });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get rental by ID
export async function getRentalById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const rental = await rentalService.getRentalById(id);
    
    if (!rental) {
      throw notFound('Rental');
    }
    
    // Check if user has permission to view this rental
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      request.user.role === UserRole.FRANCHISE_OWNER || 
      rental.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to view this rental');
    }
    
    return reply.code(200).send({ rental });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Pause a rental
export async function pauseRental(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const rental = await rentalService.getRentalById(id);
    
    if (!rental) {
      throw notFound('Rental');
    }
    
    // Only the customer or admin can pause a rental
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      rental.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to pause this rental');
    }
    
    if (rental.status !== RentalStatus.ACTIVE) {
      throw badRequest(`Cannot pause a rental that is currently ${rental.status}`);
    }
    
    const updatedRental = await rentalService.updateRentalStatus(id, RentalStatus.PAUSED);
    
    return reply.code(200).send({ 
      message: 'Rental paused successfully',
      rental: updatedRental
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Resume a paused rental
export async function resumeRental(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const rental = await rentalService.getRentalById(id);
    
    if (!rental) {
      throw notFound('Rental');
    }
    
    // Only the customer or admin can resume a rental
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      rental.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to resume this rental');
    }
    
    if (rental.status !== RentalStatus.PAUSED) {
      throw badRequest(`Cannot resume a rental that is not paused`);
    }
    
    const updatedRental = await rentalService.updateRentalStatus(id, RentalStatus.ACTIVE);
    
    return reply.code(200).send({ 
      message: 'Rental resumed successfully',
      rental: updatedRental
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Terminate a rental
export async function terminateRental(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { terminationReason?: string }
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { terminationReason } = request.body;
    const rental = await rentalService.getRentalById(id);
    
    if (!rental) {
      throw notFound('Rental');
    }
    
    // Only the customer or admin can terminate a rental
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      rental.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to terminate this rental');
    }
    
    if (![RentalStatus.ACTIVE, RentalStatus.PAUSED].includes(rental.status)) {
      throw badRequest(`Cannot terminate a rental with status ${rental.status}`);
    }
    
    const updatedRental = await rentalService.terminateRental(id, terminationReason);
    
    return reply.code(200).send({ 
      message: 'Rental terminated successfully',
      rental: updatedRental
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Renew a rental for another period
export async function renewRental(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const rental = await rentalService.getRentalById(id);
    
    if (!rental) {
      throw notFound('Rental');
    }
    
    // Only the customer or admin can renew a rental
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      rental.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to renew this rental');
    }
    
    if (rental.status !== RentalStatus.ACTIVE) {
      throw badRequest('Only active rentals can be renewed');
    }
    
    // Check if rental period needs renewal
    const currentPeriodEndDate = new Date(rental.currentPeriodEndDate);
    const now = new Date();
    const daysRemaining = Math.floor((currentPeriodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining > 7) {
      throw badRequest(`Renewal is only available when 7 or fewer days remain in the current period. ${daysRemaining} days remaining.`);
    }
    
    const renewalDetails = await rentalService.initiateRenewalPayment(id);
    
    return reply.code(200).send({ 
      message: 'Rental renewal initiated',
      renewalDetails
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Verify renewal payment
export async function verifyRenewalPayment(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { 
      razorpayPaymentId: string;
      razorpayOrderId: string;
      razorpaySignature: string;
    } 
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = request.body;
    
    const paymentVerified = await rentalService.verifyRenewalPayment(
      id, 
      razorpayPaymentId, 
      razorpayOrderId, 
      razorpaySignature
    );
    
    if (paymentVerified) {
      return reply.code(200).send({ 
        message: 'Renewal payment verified successfully',
        success: true
      });
    } else {
      throw badRequest('Payment verification failed');
    }
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get all payments for a rental
export async function getRentalPayments(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const rental = await rentalService.getRentalById(id);
    
    if (!rental) {
      throw notFound('Rental');
    }
    
    // Check if user has permission to view this rental's payments
    const hasPermission = 
      request.user.role === UserRole.ADMIN || 
      request.user.role === UserRole.FRANCHISE_OWNER || 
      rental.customerId === request.user.userId;
    
    if (!hasPermission) {
      throw forbidden('You do not have permission to view payments for this rental');
    }
    
    const payments = await rentalService.getRentalPayments(id);
    
    return reply.code(200).send({ payments });
  } catch (error) {
    handleError(error, request, reply);
  }
}