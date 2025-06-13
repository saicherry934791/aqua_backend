import { FastifyRequest, FastifyReply } from 'fastify';
import * as productService from '../services/product.service';
import { handleError, notFound, badRequest } from '../utils/errors';
import { UserRole } from '../types';

// Get all products
export async function getAllProducts(
  request: FastifyRequest<{ Querystring: { isActive?: boolean } }>,
  reply: FastifyReply
) {
  try {
    const { isActive } = request.query;
    const products = await productService.getAllProducts(isActive !== undefined ? isActive === true : true);
    return reply.code(200).send({ products });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get product by ID
export async function getProductById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const product = await productService.getProductById(id);
    
    if (!product) {
      throw notFound('Product');
    }
    
    return reply.code(200).send({ product });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Create product
export async function createProduct(
  request: FastifyRequest<{ 
    Body: { 
      name: string;
      description: string;
      images: string[];
      rentPrice: number;
      buyPrice: number;
      deposit: number;
      isRentable?: boolean;
      isPurchasable?: boolean;
      features?: { name: string; value: string; }[];
    } 
  }>,
  reply: FastifyReply
) {
  try {
    // Only admins can create products
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to create products');
    }

    const productData = request.body;
    const product = await productService.createProduct(productData);
    
    return reply.code(201).send({ 
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update product
export async function updateProduct(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { 
      name?: string;
      description?: string;
      images?: string[];
      rentPrice?: number;
      buyPrice?: number;
      deposit?: number;
      isRentable?: boolean;
      isPurchasable?: boolean;
      isActive?: boolean;
      features?: { name: string; value: string; }[];
    } 
  }>,
  reply: FastifyReply
) {
  try {
    // Only admins can update products
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to update products');
    }

    const { id } = request.params;
    const productData = request.body;
    const product = await productService.updateProduct(id, productData);
    
    return reply.code(200).send({ 
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Delete product (soft delete by setting isActive to false)
export async function deleteProduct(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    // Only admins can delete products
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to delete products');
    }

    const { id } = request.params;
    await productService.updateProduct(id, { isActive: false });
    
    return reply.code(200).send({ 
      message: 'Product deleted successfully',
      id
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Upload product image
export async function uploadProductImage(
  request: FastifyRequest<{ 
    Params: { id: string }
  }>,
  reply: FastifyReply
) {
  try {
    // Only admins can upload product images
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to upload product images');
    }

    const { id } = request.params;
    
    // Get the file from the request
    const file = await request.file();
    if (!file) {
      throw badRequest('No file uploaded');
    }

    // Check file type
    const { mimetype } = file;
    if (!mimetype.includes('image')) {
      throw badRequest('Only image files are allowed');
    }

    // Upload to S3
    const buffer = await file.toBuffer();
    const filename = `products/${id}/${Date.now()}_${file.filename}`;
    const imageUrl = await request.server.uploadToS3(buffer, filename, mimetype);

    // Add the image to the product
    const product = await productService.getProductById(id);
    if (!product) {
      throw notFound('Product');
    }

    const images = product.images || [];
    images.push(imageUrl);

    await productService.updateProduct(id, { images });

    return reply.code(200).send({ 
      message: 'Product image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Get product features
export async function getProductFeatures(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const features = await productService.getProductFeatures(id);
    
    return reply.code(200).send({ features });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Add product feature
export async function addProductFeature(
  request: FastifyRequest<{ 
    Params: { id: string },
    Body: { name: string; value: string; } 
  }>,
  reply: FastifyReply
) {
  try {
    // Only admins can add product features
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to add product features');
    }

    const { id } = request.params;
    const featureData = request.body;
    const feature = await productService.addProductFeature(id, featureData);
    
    return reply.code(201).send({ 
      message: 'Product feature added successfully',
      feature
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Update product feature
export async function updateProductFeature(
  request: FastifyRequest<{ 
    Params: { id: string; featureId: string },
    Body: { name?: string; value?: string; } 
  }>,
  reply: FastifyReply
) {
  try {
    // Only admins can update product features
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to update product features');
    }

    const { id, featureId } = request.params;
    const featureData = request.body;
    const feature = await productService.updateProductFeature(id, featureId, featureData);
    
    return reply.code(200).send({ 
      message: 'Product feature updated successfully',
      feature
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}

// Delete product feature
export async function deleteProductFeature(
  request: FastifyRequest<{ Params: { id: string; featureId: string } }>,
  reply: FastifyReply
) {
  try {
    // Only admins can delete product features
    if (request.user.role !== UserRole.ADMIN) {
      throw badRequest('Not authorized to delete product features');
    }

    const { id, featureId } = request.params;
    await productService.deleteProductFeature(id, featureId);
    
    return reply.code(200).send({ 
      message: 'Product feature deleted successfully',
      id,
      featureId
    });
  } catch (error) {
    handleError(error, request, reply);
  }
}