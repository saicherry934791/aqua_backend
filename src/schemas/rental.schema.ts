import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema } from './auth.schema';
import { RentalStatus } from '../types';
import { ProductSchema } from './product.schema';
import { PaymentSchema } from './order.schema';

// Rental Schema
export const RentalSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  customerId: z.string(),
  productId: z.string(),
  status: z.enum(Object.values(RentalStatus) as [RentalStatus, ...RentalStatus[]]),
  startDate: z.string(),
  pausedAt: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  currentPeriodStartDate: z.string(),
  currentPeriodEndDate: z.string(),
  monthlyAmount: z.number(),
  depositAmount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  product: ProductSchema.optional(),
});

// Get All Rentals
export const GetAllRentalsQuerySchema = z.object({
  status: z.enum(Object.values(RentalStatus) as [RentalStatus, ...RentalStatus[]]).optional(),
});
export const GetAllRentalsResponseSchema = z.object({
  rentals: z.array(RentalSchema),
});
export const getAllRentalsSchema = {
  querystring: zodToJsonSchema(GetAllRentalsQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllRentalsResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Get all rentals",
  description: "Get a list of all rentals (admin or franchise owner only)",
  security: [{ bearerAuth: [] }],
};

// Get User Rentals
export const GetUserRentalsQuerySchema = z.object({
  status: z.enum(Object.values(RentalStatus) as [RentalStatus, ...RentalStatus[]]).optional(),
});
export const GetUserRentalsResponseSchema = z.object({
  rentals: z.array(RentalSchema),
});
export const getUserRentalsSchema = {
  querystring: zodToJsonSchema(GetUserRentalsQuerySchema),
  response: {
    200: zodToJsonSchema(GetUserRentalsResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Get current user's rentals",
  description: "Get a list of rentals for the authenticated user",
  security: [{ bearerAuth: [] }],
};

// Get Rental by ID
export const GetRentalByIdParamsSchema = z.object({
  id: z.string(),
});
export const GetRentalByIdResponseSchema = z.object({
  rental: RentalSchema,
});
export const getRentalByIdSchema = {
  params: zodToJsonSchema(GetRentalByIdParamsSchema),
  response: {
    200: zodToJsonSchema(GetRentalByIdResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Get rental by ID",
  description: "Get a rental by its ID (only visible to the customer, admin, or franchise owner)",
  security: [{ bearerAuth: [] }],
};

// Pause/Resume Rental
export const PauseResumeRentalParamsSchema = z.object({
  id: z.string(),
});
export const PauseResumeRentalResponseSchema = z.object({
  message: z.string(),
  rental: RentalSchema,
});
export const pauseRentalSchema = {
  params: zodToJsonSchema(PauseResumeRentalParamsSchema),
  response: {
    200: zodToJsonSchema(PauseResumeRentalResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Pause a rental",
  description: "Pause an active rental (customer or admin only)",
  security: [{ bearerAuth: [] }],
};
export const resumeRentalSchema = {
  params: zodToJsonSchema(PauseResumeRentalParamsSchema),
  response: {
    200: zodToJsonSchema(PauseResumeRentalResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Resume a paused rental",
  description: "Resume a paused rental (customer or admin only)",
  security: [{ bearerAuth: [] }],
};

// Terminate Rental
export const TerminateRentalParamsSchema = z.object({
  id: z.string(),
});
export const TerminateRentalRequestSchema = z.object({
  terminationReason: z.string().optional(),
});
export const TerminateRentalResponseSchema = z.object({
  message: z.string(),
  rental: RentalSchema,
});
export const terminateRentalSchema = {
  params: zodToJsonSchema(TerminateRentalParamsSchema),
  body: zodToJsonSchema(TerminateRentalRequestSchema),
  response: {
    200: zodToJsonSchema(TerminateRentalResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Terminate a rental",
  description: "Terminate an active or paused rental (customer or admin only)",
  security: [{ bearerAuth: [] }],
};

// Renew Rental
export const RenewRentalParamsSchema = z.object({
  id: z.string(),
});
export const RenewRentalResponseSchema = z.object({
  message: z.string(),
  renewalDetails: z.object({
    rentalId: z.string(),
    paymentId: z.string(),
    razorpayOrderId: z.string(),
    amount: z.number(),
    currency: z.string(),
    productName: z.string(),
  }),
});
export const renewRentalSchema = {
  params: zodToJsonSchema(RenewRentalParamsSchema),
  response: {
    200: zodToJsonSchema(RenewRentalResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Renew a rental",
  description: "Initiate renewal payment for a rental (customer or admin only)",
  security: [{ bearerAuth: [] }],
};

// Verify Renewal Payment
export const VerifyRenewalPaymentParamsSchema = z.object({
  id: z.string(),
});
export const VerifyRenewalPaymentRequestSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});
export const VerifyRenewalPaymentResponseSchema = z.object({
  message: z.string(),
  success: z.boolean(),
});
export const verifyRenewalPaymentSchema = {
  params: zodToJsonSchema(VerifyRenewalPaymentParamsSchema),
  body: zodToJsonSchema(VerifyRenewalPaymentRequestSchema),
  response: {
    200: zodToJsonSchema(VerifyRenewalPaymentResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Verify renewal payment",
  description: "Verify Razorpay payment for rental renewal",
  security: [{ bearerAuth: [] }],
};

// Get Rental Payments
export const GetRentalPaymentsParamsSchema = z.object({
  id: z.string(),
});
export const GetRentalPaymentsResponseSchema = z.object({
  payments: z.array(PaymentSchema),
});
export const getRentalPaymentsSchema = {
  params: zodToJsonSchema(GetRentalPaymentsParamsSchema),
  response: {
    200: zodToJsonSchema(GetRentalPaymentsResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["rentals"],
  summary: "Get all payments for a rental",
  description: "Get all payment records for a rental (admin, franchise owner, or customer)",
  security: [{ bearerAuth: [] }],
};
