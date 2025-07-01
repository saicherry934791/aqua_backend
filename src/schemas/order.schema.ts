import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema } from './auth.schema';
import { OrderStatus, OrderType, PaymentStatus } from '../types';
import { ProductSchema } from './product.schema';

// User Schema (simplified for order relationships)
export const UserInOrderSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  alternativePhone: z.string().nullable().optional(),
  role: z.string(),
  franchiseAreaId: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Payment Schema
export const PaymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  amount: z.number(),
  type: z.string(),
  status: z.string(),
  razorpayPaymentId: z.string().optional().nullable(),
  razorpayOrderId: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Order Schema
export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  productId: z.string(),
  type: z.enum([OrderType.PURCHASE, OrderType.RENTAL]),
  status: z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]),
  totalAmount: z.number(),
  paymentStatus: z.enum(Object.values(PaymentStatus) as [PaymentStatus, ...PaymentStatus[]]),
  serviceAgentId: z.string().optional().nullable(),
  installationDate: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  customer: UserInOrderSchema.optional().nullable(),
  serviceAgent: UserInOrderSchema.optional().nullable(),
  product: ProductSchema.optional().nullable(),
  payments: z.array(PaymentSchema).optional(),
});

// Available Service Agent Schema
export const AvailableServiceAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional().nullable(),
  franchiseAreaId: z.string().optional().nullable(),
  franchiseAreaName: z.string(),
  isGlobalAgent: z.boolean(),
  createdAt: z.string(),
  activeOrdersCount: z.number(),
  completedOrdersCount: z.number(),
});

// User Details Schema for checkout
export const UserDetailsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email().optional(),
  address: z.string().min(5, 'Address must be at least 5 characters').optional(),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits').optional(),
  alternativePhone: z.string().regex(/^\d{10}$/, 'Alternative phone must be 10 digits').optional(),
  latitude: z.number().min(-90).max(90, 'Invalid latitude').optional(),
  longitude: z.number().min(-180).max(180, 'Invalid longitude').optional(),
});

// Get All Orders Schema
export const GetAllOrdersQuerySchema = z.object({
  status: z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]).optional(),
  type: z.enum([OrderType.PURCHASE, OrderType.RENTAL]).optional(),
});

export const GetAllOrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
});

export const getAllOrdersSchema = {
  querystring: zodToJsonSchema(GetAllOrdersQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllOrdersResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Get all orders",
  description: "Get a list of all orders with optional filters (admin or franchise owner only)",
  security: [{ bearerAuth: [] }],
};

// Get User Orders Schema
export const GetUserOrdersQuerySchema = z.object({
  status: z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]).optional(),
  type: z.enum([OrderType.PURCHASE, OrderType.RENTAL]).optional(),
});

export const GetUserOrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
});

export const getUserOrdersSchema = {
  querystring: zodToJsonSchema(GetUserOrdersQuerySchema),
  response: {
    200: zodToJsonSchema(GetUserOrdersResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Get current user's orders",
  description: "Get a list of orders for the authenticated user with optional filters",
  security: [{ bearerAuth: [] }],
};

// Get Order by ID Schema
export const GetOrderByIdParamsSchema = z.object({
  id: z.string(),
});

export const GetOrderByIdResponseSchema = z.object({
  order: OrderSchema,
});

export const getOrderByIdSchema = {
  params: zodToJsonSchema(GetOrderByIdParamsSchema),
  response: {
    200: zodToJsonSchema(GetOrderByIdResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Get order by ID",
  description: "Get an order by its ID (only visible to the customer, assigned service agent, admin, or franchise owner)",
  security: [{ bearerAuth: [] }],
};

// Get Available Service Agents Schema
export const GetAvailableServiceAgentsParamsSchema = z.object({
  id: z.string(),
});

export const GetAvailableServiceAgentsResponseSchema = z.object({
  availableAgents: z.array(AvailableServiceAgentSchema),
  message: z.string(),
});

export const getAvailableServiceAgentsSchema = {
  params: zodToJsonSchema(GetAvailableServiceAgentsParamsSchema),
  response: {
    200: zodToJsonSchema(GetAvailableServiceAgentsResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Get available service agents for order assignment",
  description: "Get a list of service agents available for assignment to an order (franchise-specific + global agents)",
  security: [{ bearerAuth: [] }],
};

// Create Order Schema
export const CreateOrderRequestSchema = z.object({
  productId: z.string(),
  type: z.enum([OrderType.PURCHASE, OrderType.RENTAL]),
  installationDate: z.string().optional(),
  userDetails: UserDetailsSchema.optional(),
});

export const CreateOrderResponseSchema = z.object({
  message: z.string(),
  order: OrderSchema,
});

export const createOrderSchema = {
  body: zodToJsonSchema(CreateOrderRequestSchema),
  response: {
    201: zodToJsonSchema(CreateOrderResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Create a new order",
  description: "Create a new purchase or rental order with optional user details update",
  security: [{ bearerAuth: [] }],
};

// Update Order Status Schema
export const UpdateOrderStatusParamsSchema = z.object({
  id: z.string(),
});

export const UpdateOrderStatusRequestSchema = z.object({
  status: z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]),
});

export const UpdateOrderStatusResponseSchema = z.object({
  message: z.string(),
  order: OrderSchema,
});

export const updateOrderStatusSchema = {
  params: zodToJsonSchema(UpdateOrderStatusParamsSchema),
  body: zodToJsonSchema(UpdateOrderStatusRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateOrderStatusResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Update order status",
  description: "Update the status of an order (admin, franchise owner or assigned service agent only)",
  security: [{ bearerAuth: [] }],
};

// Assign Service Agent Schema - NEW SCHEMA
export const AssignServiceAgentParamsSchema = z.object({
  id: z.string(),
});

export const AssignServiceAgentRequestSchema = z.object({
  serviceAgentId: z.string(),
});

export const AssignServiceAgentResponseSchema = z.object({
  message: z.string(),
  order: OrderSchema,
});

export const assignServiceAgentSchema = {
  params: zodToJsonSchema(AssignServiceAgentParamsSchema),
  body: zodToJsonSchema(AssignServiceAgentRequestSchema),
  response: {
    200: zodToJsonSchema(AssignServiceAgentResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Assign service agent to order",
  description: "Assign a service agent to an order and update status to ASSIGNED (admin or franchise owner only)",
  security: [{ bearerAuth: [] }],
};

// Update Installation Date Schema
export const UpdateInstallationDateParamsSchema = z.object({
  id: z.string(),
});

export const UpdateInstallationDateRequestSchema = z.object({
  installationDate: z.string(),
});

export const UpdateInstallationDateResponseSchema = z.object({
  message: z.string(),
  order: OrderSchema,
});

export const updateInstallationDateSchema = {
  params: zodToJsonSchema(UpdateInstallationDateParamsSchema),
  body: zodToJsonSchema(UpdateInstallationDateRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateInstallationDateResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Update installation date",
  description: "Update the installation date for an order (admin, franchise owner or assigned service agent only)",
  security: [{ bearerAuth: [] }],
};

// Cancel Order Schema
export const CancelOrderParamsSchema = z.object({
  id: z.string(),
});

export const CancelOrderResponseSchema = z.object({
  message: z.string(),
  order: OrderSchema,
});

export const cancelOrderSchema = {
  params: zodToJsonSchema(CancelOrderParamsSchema),
  response: {
    200: zodToJsonSchema(CancelOrderResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Cancel an order",
  description: "Cancel an order (only available for customer if order is in CREATED or PAYMENT_PENDING status, or for admin)",
  security: [{ bearerAuth: [] }],
};

// Initiate Payment Schema
export const InitiatePaymentParamsSchema = z.object({
  id: z.string(),
});

export const InitiatePaymentRequestSchema = z.object({
  paymentType: z.string().optional(),
});

export const InitiatePaymentResponseSchema = z.object({
  message: z.string(),
  paymentInfo: z.object({
    orderId: z.string(),
    paymentId: z.string(),
    razorpayOrderId: z.string(),
    amount: z.number(),
    currency: z.string(),
    productName: z.string(),
    customerName: z.string(),
    customerEmail: z.string().optional(),
    customerPhone: z.string(),
  }),
});

export const initiatePaymentSchema = {
  params: zodToJsonSchema(InitiatePaymentParamsSchema),
  body: zodToJsonSchema(InitiatePaymentRequestSchema),
  response: {
    200: zodToJsonSchema(InitiatePaymentResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Initiate payment for an order",
  description: "Initiate the payment process for an order (customer or admin only)",
  security: [{ bearerAuth: [] }],
};

// Verify Payment Schema
export const VerifyPaymentParamsSchema = z.object({
  id: z.string(),
});

export const VerifyPaymentRequestSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

export const VerifyPaymentResponseSchema = z.object({
  message: z.string(),
  success: z.boolean(),
});

export const verifyPaymentSchema = {
  params: zodToJsonSchema(VerifyPaymentParamsSchema),
  body: zodToJsonSchema(VerifyPaymentRequestSchema),
  response: {
    200: zodToJsonSchema(VerifyPaymentResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["orders"],
  summary: "Verify payment",
  description: "Verify a payment for an order after Razorpay callback",
  security: [{ bearerAuth: [] }],
};