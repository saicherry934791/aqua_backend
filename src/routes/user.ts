import { FastifyInstance } from 'fastify';
import {
  getAllUsers,
  getUserById,
  updateUserProfile,
  changeUserRole,
  setUserActive,
} from '../controllers/user.controller';
import {
  getAllUsersSchema,
  getUserByIdSchema,
  updateUserProfileSchema,
  changeUserRoleSchema,
  setUserActiveSchema,
} from '../schemas/user.schema';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Get all users (admin only)
  fastify.get(
    '/',
    {
      schema: getAllUsersSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    (request, reply) => getAllUsers(request as any, reply as any)
  );

  // Get user by ID (admin or self)
  fastify.get(
    '/:id',
    {
      schema: getUserByIdSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => getUserById(request as any, reply as any)
  );

  // Update user profile (admin or self)
  fastify.patch(
    '/:id',
    {
      schema: updateUserProfileSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => updateUserProfile(request as any, reply as any)
  );

  // Change user role (admin only)
  fastify.patch(
    '/:id/role',
    {
      schema: changeUserRoleSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    (request, reply) => changeUserRole(request as any, reply as any)
  );

  // Set user active status (admin only)
  fastify.patch(
    '/:id/active',
    {
      schema: setUserActiveSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    (request, reply) => setUserActive(request as any, reply as any)
  );

  fastify.log.info('User routes registered');
} 