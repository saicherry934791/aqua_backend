import { FastifyInstance } from 'fastify';
import { getHomescreenData } from '../controllers/homescreen.controller';
import { homescreenSchema } from '../schemas/homescreen.schema';

export default async function (fastify: FastifyInstance) {
  // Get homescreen data
  fastify.get(
    '/',
    {
      schema: homescreenSchema,
      preHandler: [fastify.authenticate],
    },
    (request, reply) => getHomescreenData(request as any, reply as any)
  );

  fastify.log.info('Homescreen routes registered');
}