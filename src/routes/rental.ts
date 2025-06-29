import { FastifyInstance } from 'fastify';
import {
    getAllRentals,
    getUserRentals,
    getRentalById,
    pauseRental,
    resumeRental,
    terminateRental,
    renewRental,
    verifyRenewalPayment,
    getRentalPayments,
} from '../controllers/rental.controller';
import {
    getAllRentalsSchema,
    getUserRentalsSchema,
    getRentalByIdSchema,
    pauseRentalSchema,
    resumeRentalSchema,
    terminateRentalSchema,
    renewRentalSchema,
    verifyRenewalPaymentSchema,
    getRentalPaymentsSchema,
} from '../schemas/rental.schema';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
    // Get all rentals (admin or franchise owner only)
    fastify.get(
        '/',
        {
            schema: getAllRentalsSchema,
            preHandler: [fastify.authorizeRoles([UserRole.ADMIN, UserRole.FRANCHISE_OWNER])],
        },
        (request, reply) => {
            return getAllRentals(request as any, reply as any);
        }
    );

    // Get rentals for current user
    fastify.get(
        '/my-rentals',
        {
            schema: getUserRentalsSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return getUserRentals(request as any, reply as any);
        }
    );

    // Get rental by ID
    fastify.get(
        '/:id',
        {
            schema: getRentalByIdSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return getRentalById(request as any, reply as any);
        }
    );

    // Pause a rental
    fastify.patch(
        '/:id/pause',
        {
            schema: pauseRentalSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return pauseRental(request as any, reply as any);
        }
    );

    // Resume a rental
    fastify.patch(
        '/:id/resume',
        {
            schema: resumeRentalSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return resumeRental(request as any, reply as any);
        }
    );

    // Terminate a rental
    fastify.patch(
        '/:id/terminate',
        {
            schema: terminateRentalSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return terminateRental(request as any, reply as any);
        }
    );

    // Renew a rental (initiate renewal payment)
    fastify.post(
        '/:id/renew',
        {
            schema: renewRentalSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return renewRental(request as any, reply as any);
        }
    );

    // Verify renewal payment
    fastify.post(
        '/:id/verify-renewal-payment',
        {
            schema: verifyRenewalPaymentSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return verifyRenewalPayment(request as any, reply as any);
        }
    );

    // Get all payments for a rental
    fastify.get(
        '/:id/payments',
        {
            schema: getRentalPaymentsSchema,
            preHandler: [fastify.authenticate],
        },
        (request, reply) => {
            return getRentalPayments(request as any, reply as any);
        }
    );

    fastify.log.info('Rental routes registered');
} 