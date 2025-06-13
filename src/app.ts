import fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dotenv from 'dotenv';
import fp from 'fastify-plugin';

// Import plugins
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import razorpayPlugin from './plugins/razorpay';
import s3Plugin from './plugins/s3';
import notificationPlugin from './plugins/notification';
import firebasePlugin from './plugins/firebase';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import productRoutes from './routes/product';
import orderRoutes from './routes/order';
import rentalRoutes from './routes/rental';
import serviceRequestRoutes from './routes/serviceRequest';
import franchiseRoutes from './routes/franchise';
import notificationRoutes from './routes/notification';

// Load environment variables
dotenv.config();

// Create Fastify instance with TypeBox
export const createApp = async (): Promise<FastifyInstance> => {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-jwt-secret',
  });

  // Register custom plugins
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(firebasePlugin);
  await app.register(razorpayPlugin);
  await app.register(s3Plugin);
  await app.register(notificationPlugin);

  // Register Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'PuriFiler API Documentation',
        description: 'API documentation for the PuriFiler Water Purifier Rental/Sales Management System',
        version: '1.0.0',
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'user', description: 'User management endpoints' },
        { name: 'product', description: 'Product management endpoints' },
        { name: 'order', description: 'Order management endpoints' },
        { name: 'rental', description: 'Rental management endpoints' },
        { name: 'service-request', description: 'Service request endpoints' },
        { name: 'franchise', description: 'Franchise management endpoints' },
        { name: 'notification', description: 'Notification endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(rentalRoutes, { prefix: '/api/rentals' });
  await app.register(serviceRequestRoutes, { prefix: '/api/service-requests' });
  await app.register(franchiseRoutes, { prefix: '/api/franchises' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });

  // Add health check route
  app.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  });

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    
    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
    }
    
    // Handle JWT errors
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No authorization header was found',
      });
    }

    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    }

    // Custom errors
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.error || 'Error',
        message: error.message,
      });
    }

    // Default error
    reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An internal server error occurred',
    });
  });

  return app;
};

export default fp(async (fastify) => {
  const app = await createApp();
  return app;
});