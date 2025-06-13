import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import admin from 'firebase-admin';

declare module 'fastify' {
  interface FastifyInstance {
    firebase: admin.app.App;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  // Check if Firebase credentials are available
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    fastify.log.warn('Firebase configuration missing. Firebase plugin not initialized.');
    return;
  }

  try {
    // Initialize Firebase Admin SDK
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    // Decorate Fastify instance with firebase
    fastify.decorate('firebase', app);
    
    fastify.log.info('Firebase plugin registered');

    // Add a hook to close the Firebase connection when the server is shutting down
    fastify.addHook('onClose', async () => {
      await app.delete();
      fastify.log.info('Firebase connection closed');
    });
  } catch (err) {
    fastify.log.error('Error initializing Firebase:', err);
    throw err;
  }
});