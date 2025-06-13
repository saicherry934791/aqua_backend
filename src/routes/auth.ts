import { FastifyInstance } from 'fastify';
import {
  requestOtp,
  login,
  register,
  refreshToken,
  verifyToken,
  logout,
  changeRole,
} from '../controllers/auth.controller';
import {
  requestOtpSchema,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  meSchema,
  logoutSchema,
  changeRoleSchema,
} from '../schemas/auth.schema';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Public routes - no authentication required
  fastify.post('/request-otp', { schema: requestOtpSchema }, requestOtp);
  fastify.post('/login', { schema: loginSchema }, login);
  fastify.post('/register', { schema: registerSchema }, register);
  fastify.post('/refresh-token', { schema: refreshTokenSchema }, refreshToken);

  // Protected routes - authentication required
  fastify.get(
    '/me',
    {
      schema: meSchema,
      preHandler: [fastify.authenticate],
    },
    verifyToken
  );

  fastify.post(
    '/logout',
    {
      schema: logoutSchema,
      preHandler: [fastify.authenticate],
    },
    logout
  );

  // Admin only routes
  fastify.patch(
    '/users/:id/role',
    {
      schema: changeRoleSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    changeRole
  );

  fastify.log.info('Auth routes registered');
}