import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UserRole } from '../types';

// Common error response schema
export const ErrorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

// Request OTP Schema
export const RequestOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
});

export const RequestOtpResponseSchema = z.object({
  message: z.string(),
  phone: z.string(),
});

export const requestOtpSchema = {
  body: zodToJsonSchema(RequestOtpSchema),
  response: {
    200: zodToJsonSchema(RequestOtpResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Request OTP for phone number verification",
};

// Login Schema
export const LoginRequestSchema = z.object({
  idToken: z.string(),
  role: z.enum([
    UserRole.ADMIN,
    UserRole.CUSTOMER,
    UserRole.FRANCHISE_OWNER,
    UserRole.SERVICE_AGENT
  ]),
});

export const UserSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  alternativePhone: z.string().nullable().optional(),
  role: z.enum([
    UserRole.ADMIN,
    UserRole.CUSTOMER,
    UserRole.FRANCHISE_OWNER,
    UserRole.SERVICE_AGENT
  ]),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).nullable().optional(),
  franchiseAreaId: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
});

export const LoginRegistrationRequiredSchema = z.object({
  message: z.string(),
  phone: z.string(),
  firebaseUid: z.string(),
});

export const loginSchema = {
  body: zodToJsonSchema(LoginRequestSchema),
  response: {
    200: zodToJsonSchema(LoginResponseSchema),
    202: zodToJsonSchema(LoginRegistrationRequiredSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Login or register with Firebase ID token and role",
  description: "Login or register a user using a Firebase ID token from the frontend with specific role.",
};

// Registration Schema
export const RegisterRequestSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  name: z.string().min(3),
  email: z.string().email().optional(),
  address: z.string().optional(),
  alternativePhone: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  firebaseUid: z.string(),
});

export const RegisterResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const registerSchema = {
  body: zodToJsonSchema(RegisterRequestSchema),
  response: {
    201: zodToJsonSchema(RegisterResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Register a new user",
};

// Refresh Token Schema
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const RefreshTokenResponseSchema = z.object({
  accessToken: z.string(),
});

export const refreshTokenSchema = {
  body: zodToJsonSchema(RefreshTokenRequestSchema),
  response: {
    200: zodToJsonSchema(RefreshTokenResponseSchema),
    401: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Refresh access token using refresh token",
};

// Me Schema
export const MeResponseSchema = z.object({
  user: UserSchema,
});

export const meSchema = {
  response: {
    200: zodToJsonSchema(MeResponseSchema),
    401: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Get current authenticated user details",
};

// Logout Schema
export const LogoutResponseSchema = z.object({
  message: z.string(),
});

export const logoutSchema = {
  response: {
    200: zodToJsonSchema(LogoutResponseSchema),
  },
  tags: ["auth"],
  summary: "Logout current user",
};

// Change Role Schema
export const ChangeRoleRequestSchema = z.object({
  role: z.enum([
    UserRole.ADMIN,
    UserRole.CUSTOMER,
    UserRole.FRANCHISE_OWNER,
    UserRole.SERVICE_AGENT
  ]),
});

export const ChangeRoleResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
});

export const changeRoleSchema = {
  params: zodToJsonSchema(z.object({
    id: z.string(),
  })),
  body: zodToJsonSchema(ChangeRoleRequestSchema),
  response: {
    200: zodToJsonSchema(ChangeRoleResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["auth"],
  summary: "Change user role (admin only)",
};

export const checkRoleSchema = {
  querystring: zodToJsonSchema(z.object({
    phoneNumber: z.string(),
    role: z.enum([
      UserRole.ADMIN,
      UserRole.CUSTOMER,
      UserRole.FRANCHISE_OWNER,
      UserRole.SERVICE_AGENT
    ])
  })),

  response: {
    200: zodToJsonSchema(z.object({
      exists: z.boolean(),
      role: z.string().nullable(),
      userId: z.string().nullable()
    })),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),

  },
  tags: ["auth"],
  summary: "Check if user exists with specific phone and role combination",
}