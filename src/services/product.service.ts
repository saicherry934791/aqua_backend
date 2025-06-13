import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { products, productFeatures } from '../models/schema';
import { notFound } from '../utils/errors';
import { generateId, parseJsonSafe } from '../utils/helpers';

// Get all products
export async function getAllProducts(includeInactive = false) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  let query = fastify.db.query.products;
  let results;
  
  if (includeInactive) {
    results = await query.findMany({
      with: {
        productFeatures: true
      }
    });
  } else {
    results = await query.findMany({
      where: (product) => eq(product.isActive, true),
      with: {
        productFeatures: true
      }
    });
  }

  return results.map(result => ({
    ...result,
    images: parseJsonSafe<string[]>(result.images, [])
  }));
}

// Get product by ID
export async function getProductById(id: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const result = await fastify.db.query.products.findFirst({
    where: eq(fastify.db.query.products.id, id),
    with: {
      productFeatures: true
    }
  });

  if (!result) {
    return null;
  }

  return {
    ...result,
    images: parseJsonSafe<string[]>(result.images, [])
  };
}

// Create product
export async function createProduct(data: {
  name: string;
  description: string;
  images: string[];
  rentPrice: number;
  buyPrice: number;
  deposit: number;
  isRentable?: boolean;
  isPurchasable?: boolean;
  features?: { name: string; value: string; }[];
}) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const id = generateId('prod');
  
  await fastify.db.insert(products).values({
    id,
    name: data.name,
    description: data.description,
    images: JSON.stringify(data.images || []),
    rentPrice: data.rentPrice,
    buyPrice: data.buyPrice,
    deposit: data.deposit,
    isRentable: data.isRentable ?? true,
    isPurchasable: data.isPurchasable ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  });

  // Add features if provided
  if (data.features && data.features.length > 0) {
    for (const feature of data.features) {
      await addProductFeature(id, feature);
    }
  }

  return getProductById(id);
}

// Update product
export async function updateProduct(id: string, data: {
  name?: string;
  description?: string;
  images?: string[];
  rentPrice?: number;
  buyPrice?: number;
  deposit?: number;
  isRentable?: boolean;
  isPurchasable?: boolean;
  isActive?: boolean;
}) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const product = await getProductById(id);
  if (!product) {
    throw notFound('Product');
  }

  const updateData: any = {
    updatedAt: new Date().toISOString()
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.images !== undefined) updateData.images = JSON.stringify(data.images);
  if (data.rentPrice !== undefined) updateData.rentPrice = data.rentPrice;
  if (data.buyPrice !== undefined) updateData.buyPrice = data.buyPrice;
  if (data.deposit !== undefined) updateData.deposit = data.deposit;
  if (data.isRentable !== undefined) updateData.isRentable = data.isRentable;
  if (data.isPurchasable !== undefined) updateData.isPurchasable = data.isPurchasable;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await fastify.db
    .update(products)
    .set(updateData)
    .where(eq(products.id, id));

  return getProductById(id);
}

// Get product features
export async function getProductFeatures(productId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const results = await fastify.db.query.productFeatures.findMany({
    where: eq(fastify.db.query.productFeatures.productId, productId)
  });

  return results;
}

// Add product feature
export async function addProductFeature(productId: string, data: { name: string; value: string; }) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const product = await getProductById(productId);
  if (!product) {
    throw notFound('Product');
  }

  const id = generateId('feat');
  
  await fastify.db.insert(productFeatures).values({
    id,
    productId,
    name: data.name,
    value: data.value,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const feature = await fastify.db.query.productFeatures.findFirst({
    where: eq(fastify.db.query.productFeatures.id, id)
  });

  return feature;
}

// Update product feature
export async function updateProductFeature(
  productId: string, 
  featureId: string, 
  data: { name?: string; value?: string; }
) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const feature = await fastify.db.query.productFeatures.findFirst({
    where: and(
      eq(fastify.db.query.productFeatures.id, featureId),
      eq(fastify.db.query.productFeatures.productId, productId)
    )
  });

  if (!feature) {
    throw notFound('Product Feature');
  }

  const updateData: any = {
    updatedAt: new Date().toISOString()
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.value !== undefined) updateData.value = data.value;

  await fastify.db
    .update(productFeatures)
    .set(updateData)
    .where(eq(productFeatures.id, featureId));

  return fastify.db.query.productFeatures.findFirst({
    where: eq(fastify.db.query.productFeatures.id, featureId)
  });
}

// Delete product feature
export async function deleteProductFeature(productId: string, featureId: string) {
  const fastify = (global as any).fastify as FastifyInstance;
  
  const feature = await fastify.db.query.productFeatures.findFirst({
    where: and(
      eq(fastify.db.query.productFeatures.id, featureId),
      eq(fastify.db.query.productFeatures.productId, productId)
    )
  });

  if (!feature) {
    throw notFound('Product Feature');
  }

  await fastify.db
    .delete(productFeatures)
    .where(eq(productFeatures.id, featureId));

  return true;
}