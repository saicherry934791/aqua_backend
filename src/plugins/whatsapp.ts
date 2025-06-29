import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { users } from '../models/schema';
import { eq } from 'drizzle-orm';

// Twilio setup
let twilioClient: any = null;
if (process.env.WHATSAPP_PROVIDER === 'twilio') {
  const twilio = require('twilio');
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Meta Cloud API setup
const META_API_URL = 'https://graph.facebook.com/v18.0';
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_TEMPLATE_NAME = process.env.META_TEMPLATE_NAME || undefined;
const META_TEMPLATE_LANG = process.env.META_TEMPLATE_LANG || 'en_US';

export default fp(async function (fastify: FastifyInstance) {
  fastify.decorate('whatsapp', {
    /**
     * Send a WhatsApp message to a user
     * @param userId string
     * @param message string
     */
    async send(userId: string, message: string) {
      if (!userId) return;
      const user = await fastify.db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user || !user.phone) return;
      const phone = user.phone.startsWith('+') ? user.phone : `+91${user.phone}`;
      const provider = process.env.WHATSAPP_PROVIDER || 'twilio';
      if (provider === 'twilio') {
        // Twilio WhatsApp
        try {
          await twilioClient.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
            to: `whatsapp:${phone}`,
            body: message,
          });
        } catch (err) {
          fastify.log.error('Twilio WhatsApp error', err);
        }
      } else if (provider === 'meta') {
        // Meta Cloud API WhatsApp
        try {
          const payload = {
            messaging_product: 'whatsapp',
            to: phone.replace('+', ''),
            type: META_TEMPLATE_NAME ? 'template' : 'text',
            ...(META_TEMPLATE_NAME
              ? {
                  template: {
                    name: META_TEMPLATE_NAME,
                    language: { code: META_TEMPLATE_LANG },
                    components: [
                      {
                        type: 'body',
                        parameters: [
                          { type: 'text', text: message },
                        ],
                      },
                    ],
                  },
                }
              : {
                  text: { body: message },
                }),
          };
          await fetch(
            `${META_API_URL}/${META_PHONE_NUMBER_ID}/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${META_ACCESS_TOKEN}`,
              },
              body: JSON.stringify(payload),
            }
          );
        } catch (err) {
          fastify.log.error('Meta WhatsApp error', err);
        }
      }
    },
  });
}); 