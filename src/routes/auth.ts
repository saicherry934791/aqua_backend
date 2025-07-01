import { FastifyInstance } from 'fastify';
import { login, refreshToken, me, logout, changeRole, checkRole, onboardUser } from '../controllers/auth.controller';
import { loginSchema, refreshTokenSchema, meSchema, logoutSchema, changeRoleSchema, checkRoleSchema, onboardUserSchema } from '../schemas/auth.schema';
import { UserRole } from '../types';
import { eq } from 'drizzle-orm';
import { pushSubscriptions } from '../models/schema';

export default async function (fastify: FastifyInstance) {
  // Login or register with Firebase ID token
  fastify.post(
    '/login',
    {
      schema: loginSchema,
    },
    login
  );

  // Onboard user (complete profile after login)
  fastify.post(
    '/onboard',
    {
      schema: onboardUserSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => onboardUser(request as any, reply as any)
  );

  // Refresh token
  fastify.post(
    '/refresh-token',
    {
      schema: refreshTokenSchema,
    },
    refreshToken
  );

  // Get current user
  fastify.get(
    '/me',
    {
      schema: meSchema,
      preHandler: [fastify.authenticate],
    },
    me
  );

  // Logout
  fastify.post(
    '/logout',
    {
      schema: logoutSchema,
      preHandler: [fastify.authenticate],
    },
    logout
  );

  fastify.get(
    "/checkrole",
    {
     schema: checkRoleSchema
    },
    checkRole
  )

  // Change user role (admin only)
  fastify.patch(
    '/:id/role',
    {
      schema: changeRoleSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    (request, reply) => changeRole(request as any, reply as any)
  );

  // Register or update FCM push subscription for the authenticated user
  fastify.post(
    '/push-subscription',
    {
      schema: {
        body: {
          type: 'object',
          required: ['endpoint', 'p256dh', 'auth'],
          properties: {
            endpoint: { type: 'string' },
            p256dh: { type: 'string' },
            auth: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
        tags: ['auth'],
        summary: 'Register or update FCM push subscription',
        description: 'Register or update a device push subscription for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = (request.user as any).userId;
      const { endpoint, p256dh, auth } = request.body as any;
      // Upsert logic: if exists, update; else, insert
      const existing = await fastify.db.query.pushSubscriptions.findFirst({
        where: eq(pushSubscriptions.endpoint, endpoint),
      });
      if (existing) {
        await fastify.db.update(pushSubscriptions).set({ p256dh, auth, updatedAt: new Date().toISOString() }).where(eq(pushSubscriptions.id, existing.id));
      } else {
        await fastify.db.insert(pushSubscriptions).values({
          id: `push_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          userId,
          endpoint,
          p256dh,
          auth,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return reply.code(200).send({ message: 'Push subscription registered' });
    }
  );

  fastify.log.info('Auth routes registered');
}