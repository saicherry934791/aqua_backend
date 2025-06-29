import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema } from './auth.schema';

// Popular Product Schema
export const PopularProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  image: z.string(),
});

// Recent Order Item Schema
export const RecentOrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  image: z.string(),
});

// Recent Order Schema
export const RecentOrderSchema = z.object({
  id: z.string(),
  items: z.array(RecentOrderItemSchema),
  total: z.number(),
  status: z.string(),
  orderDate: z.string(),
  deliveryDate: z.string().nullable(),
});

// Coupon/Promotion Schema
export const CouponPromotionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  code: z.string(),
  type: z.string(),
});

// Homescreen Data Schema
export const HomescreenDataSchema = z.object({
  popularProducts: z.array(PopularProductSchema),
  recentOrders: z.array(RecentOrderSchema),
  couponsAndPromotions: z.array(CouponPromotionSchema),
});

// Homescreen Response Schema
export const HomescreenResponseSchema = z.object({
  success: z.boolean(),
  data: HomescreenDataSchema,
  message: z.string(),
});

export const homescreenSchema = {
  response: {
    200: zodToJsonSchema(HomescreenResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    401: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["homescreen"],
  summary: "Get homescreen data",
  description: "Retrieve all data required for the homescreen including popular products, recent orders, and coupons/promotions",
  security: [{ bearerAuth: [] }],
};