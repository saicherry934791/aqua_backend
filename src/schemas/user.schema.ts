import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema, UserSchema } from './auth.schema';
import { UserRole } from '../types';

// Get All Users
export const GetAllUsersQuerySchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.CUSTOMER, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT]).optional(),
  isActive: z.boolean().optional(),
  franchiseAreaId: z.string().optional(),
});
export const GetAllUsersResponseSchema = z.object({
  users: z.array(UserSchema),
});
export const getAllUsersSchema = {
  querystring: zodToJsonSchema(GetAllUsersQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllUsersResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["users"],
  summary: "Get all users",
  description: "Get a list of all users with optional filters",
  security: [{ bearerAuth: [] }],
};

// Get User by ID
export const GetUserByIdParamsSchema = z.object({
  id: z.string(),
});
export const GetUserByIdResponseSchema = z.object({
  user: UserSchema,
});
export const getUserByIdSchema = {
  params: zodToJsonSchema(GetUserByIdParamsSchema),
  response: {
    200: zodToJsonSchema(GetUserByIdResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["users"],
  summary: "Get user by ID",
  description: "Get a user by their ID",
  security: [{ bearerAuth: [] }],
};

// Update User Profile
export const UpdateUserProfileParamsSchema = z.object({
  id: z.string(),
});
export const UpdateUserProfileBodySchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  alternativePhone: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});
export const UpdateUserProfileResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
});
export const updateUserProfileSchema = {
  params: zodToJsonSchema(UpdateUserProfileParamsSchema),
  body: zodToJsonSchema(UpdateUserProfileBodySchema),
  response: {
    200: zodToJsonSchema(UpdateUserProfileResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["users"],
  summary: "Update user profile",
  description: "Update a user's profile information",
  security: [{ bearerAuth: [] }],
};

// Change User Role
export const ChangeUserRoleParamsSchema = z.object({
  id: z.string(),
});
export const ChangeUserRoleBodySchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.CUSTOMER, UserRole.FRANCHISE_OWNER, UserRole.SERVICE_AGENT]),
});
export const ChangeUserRoleResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
});
export const changeUserRoleSchema = {
  params: zodToJsonSchema(ChangeUserRoleParamsSchema),
  body: zodToJsonSchema(ChangeUserRoleBodySchema),
  response: {
    200: zodToJsonSchema(ChangeUserRoleResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["users"],
  summary: "Change user role",
  description: "Change a user's role (admin only)",
  security: [{ bearerAuth: [] }],
};

// Deactivate/Reactivate User
export const SetUserActiveParamsSchema = z.object({
  id: z.string(),
});
export const SetUserActiveBodySchema = z.object({
  isActive: z.boolean(),
});
export const SetUserActiveResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
});
export const setUserActiveSchema = {
  params: zodToJsonSchema(SetUserActiveParamsSchema),
  body: zodToJsonSchema(SetUserActiveBodySchema),
  response: {
    200: zodToJsonSchema(SetUserActiveResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["users"],
  summary: "Deactivate or reactivate user",
  description: "Set a user's active status (admin only)",
  security: [{ bearerAuth: [] }],
}; 