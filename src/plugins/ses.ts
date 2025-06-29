import fp from 'fastify-plugin';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { FastifyInstance } from 'fastify';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';

const ses = new SESClient({
  region: process.env.AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const SENDER_EMAIL = process.env.SES_SENDER_EMAIL!;

export default fp(async function (fastify: FastifyInstance) {
  fastify.decorate('email', {
    /**
     * Send an email to a user
     * @param userId string
     * @param subject string
     * @param body string
     */
    async send(userId: string, subject: string, body: string) {
      if (!userId) return;
      const user = await fastify.db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user || !user.email) return;
      const params = {
        Source: SENDER_EMAIL,
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: subject },
          Body: { Text: { Data: body } },
        },
      };
      try {
        await ses.send(new SendEmailCommand(params));
      } catch (err) {
        fastify.log.error('SES email error', err);
      }
    },
  });
}); 