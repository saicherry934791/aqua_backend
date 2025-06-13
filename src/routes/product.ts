import { FastifyInstance } from 'fastify';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFeatures,
  addProductFeature,
  updateProductFeature,
  deleteProductFeature,
  uploadProductImage,
} from '../controllers/product.controller';
import {
  getAllProductsSchema,
  getProductByIdSchema,
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  getProductFeaturesSchema,
  addProductFeatureSchema,
  updateProductFeatureSchema,
  deleteProductFeatureSchema,
  uploadProductImageSchema,
} from '../schemas/product.schema';
import { UserRole } from '../types';

export default async function (fastify: FastifyInstance) {
  // Public routes - no authentication required
  fastify.get('/', { schema: getAllProductsSchema }, getAllProducts);
  fastify.get('/:id', { schema: getProductByIdSchema }, getProductById);
  fastify.get('/:id/features', { schema: getProductFeaturesSchema }, getProductFeatures);

  // Admin only routes
  fastify.post(
    '/',
    {
      schema: createProductSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    createProduct
  );

  fastify.put(
    '/:id',
    {
      schema: updateProductSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    updateProduct
  );

  fastify.delete(
    '/:id',
    {
      schema: deleteProductSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    deleteProduct
  );

  // Product features routes - admin only
  fastify.post(
    '/:id/features',
    {
      schema: addProductFeatureSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    addProductFeature
  );

  fastify.put(
    '/:id/features/:featureId',
    {
      schema: updateProductFeatureSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    updateProductFeature
  );

  fastify.delete(
    '/:id/features/:featureId',
    {
      schema: deleteProductFeatureSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    deleteProductFeature
  );

  // Product image upload - admin only
  fastify.post(
    '/:id/images',
    {
      schema: uploadProductImageSchema,
      preHandler: [fastify.authorizeRoles([UserRole.ADMIN])],
    },
    uploadProductImage
  );

  fastify.log.info('Product routes registered');
}