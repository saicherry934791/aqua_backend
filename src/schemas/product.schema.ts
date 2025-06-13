import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ErrorResponseSchema } from './auth.schema';

// Product Feature Schema
export const ProductFeatureSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  value: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Product Schema
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  images: z.array(z.string()),
  rentPrice: z.number(),
  buyPrice: z.number(),
  deposit: z.number(),
  isRentable: z.boolean(),
  isPurchasable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isActive: z.boolean(),
  productFeatures: z.array(ProductFeatureSchema).optional(),
});

// Get All Products Schema
export const GetAllProductsQuerySchema = z.object({
  isActive: z.boolean().optional(),
});

export const GetAllProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
});

export const getAllProductsSchema = {
  querystring: zodToJsonSchema(GetAllProductsQuerySchema),
  response: {
    200: zodToJsonSchema(GetAllProductsResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Get all products",
  description: "Get a list of all products, optionally filtered by active status",
};

// Get Product by ID Schema
export const GetProductByIdParamsSchema = z.object({
  id: z.string(),
});

export const GetProductByIdResponseSchema = z.object({
  product: ProductSchema,
});

export const getProductByIdSchema = {
  params: zodToJsonSchema(GetProductByIdParamsSchema),
  response: {
    200: zodToJsonSchema(GetProductByIdResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Get product by ID",
  description: "Get a product by its ID",
};

// Create Product Schema
export const CreateProductRequestSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long"),
  description: z.string().min(10, "Description must be at least 10 characters long"),
  images: z.array(z.string()).default([]),
  rentPrice: z.number().min(0, "Rent price must be non-negative"),
  buyPrice: z.number().min(0, "Buy price must be non-negative"),
  deposit: z.number().min(0, "Deposit must be non-negative"),
  isRentable: z.boolean().default(true),
  isPurchasable: z.boolean().default(true),
  features: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ).optional(),
});

export const CreateProductResponseSchema = z.object({
  message: z.string(),
  product: ProductSchema,
});

export const createProductSchema = {
  body: zodToJsonSchema(CreateProductRequestSchema),
  response: {
    201: zodToJsonSchema(CreateProductResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Create a new product",
  description: "Create a new product (admin only)",
  security: [{ bearerAuth: [] }],
};

// Update Product Schema
export const UpdateProductParamsSchema = z.object({
  id: z.string(),
});

export const UpdateProductRequestSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long").optional(),
  description: z.string().min(10, "Description must be at least 10 characters long").optional(),
  images: z.array(z.string()).optional(),
  rentPrice: z.number().min(0, "Rent price must be non-negative").optional(),
  buyPrice: z.number().min(0, "Buy price must be non-negative").optional(),
  deposit: z.number().min(0, "Deposit must be non-negative").optional(),
  isRentable: z.boolean().optional(),
  isPurchasable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  features: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ).optional(),
});

export const UpdateProductResponseSchema = z.object({
  message: z.string(),
  product: ProductSchema,
});

export const updateProductSchema = {
  params: zodToJsonSchema(UpdateProductParamsSchema),
  body: zodToJsonSchema(UpdateProductRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateProductResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Update a product",
  description: "Update an existing product (admin only)",
  security: [{ bearerAuth: [] }],
};

// Delete Product Schema
export const DeleteProductParamsSchema = z.object({
  id: z.string(),
});

export const DeleteProductResponseSchema = z.object({
  message: z.string(),
  id: z.string(),
});

export const deleteProductSchema = {
  params: zodToJsonSchema(DeleteProductParamsSchema),
  response: {
    200: zodToJsonSchema(DeleteProductResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Delete a product",
  description: "Soft delete a product by setting isActive to false (admin only)",
  security: [{ bearerAuth: [] }],
};

// Product Features Schema
export const GetProductFeaturesParamsSchema = z.object({
  id: z.string(),
});

export const GetProductFeaturesResponseSchema = z.object({
  features: z.array(ProductFeatureSchema),
});

export const getProductFeaturesSchema = {
  params: zodToJsonSchema(GetProductFeaturesParamsSchema),
  response: {
    200: zodToJsonSchema(GetProductFeaturesResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Get product features",
  description: "Get all features of a specific product",
};

// Add Product Feature Schema
export const AddProductFeatureParamsSchema = z.object({
  id: z.string(),
});

export const AddProductFeatureRequestSchema = z.object({
  name: z.string().min(1, "Feature name is required"),
  value: z.string().min(1, "Feature value is required"),
});

export const AddProductFeatureResponseSchema = z.object({
  message: z.string(),
  feature: ProductFeatureSchema,
});

export const addProductFeatureSchema = {
  params: zodToJsonSchema(AddProductFeatureParamsSchema),
  body: zodToJsonSchema(AddProductFeatureRequestSchema),
  response: {
    201: zodToJsonSchema(AddProductFeatureResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Add product feature",
  description: "Add a new feature to a product (admin only)",
  security: [{ bearerAuth: [] }],
};

// Update Product Feature Schema
export const UpdateProductFeatureParamsSchema = z.object({
  id: z.string(),
  featureId: z.string(),
});

export const UpdateProductFeatureRequestSchema = z.object({
  name: z.string().optional(),
  value: z.string().optional(),
});

export const UpdateProductFeatureResponseSchema = z.object({
  message: z.string(),
  feature: ProductFeatureSchema,
});

export const updateProductFeatureSchema = {
  params: zodToJsonSchema(UpdateProductFeatureParamsSchema),
  body: zodToJsonSchema(UpdateProductFeatureRequestSchema),
  response: {
    200: zodToJsonSchema(UpdateProductFeatureResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Update product feature",
  description: "Update an existing feature of a product (admin only)",
  security: [{ bearerAuth: [] }],
};

// Delete Product Feature Schema
export const DeleteProductFeatureParamsSchema = z.object({
  id: z.string(),
  featureId: z.string(),
});

export const DeleteProductFeatureResponseSchema = z.object({
  message: z.string(),
  id: z.string(),
  featureId: z.string(),
});

export const deleteProductFeatureSchema = {
  params: zodToJsonSchema(DeleteProductFeatureParamsSchema),
  response: {
    200: zodToJsonSchema(DeleteProductFeatureResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Delete product feature",
  description: "Delete a feature from a product (admin only)",
  security: [{ bearerAuth: [] }],
};

// Upload Product Image Schema
export const UploadProductImageParamsSchema = z.object({
  id: z.string(),
});

export const UploadProductImageResponseSchema = z.object({
  message: z.string(),
  imageUrl: z.string(),
});

export const uploadProductImageSchema = {
  params: zodToJsonSchema(UploadProductImageParamsSchema),
  consumes: ["multipart/form-data"],
  response: {
    200: zodToJsonSchema(UploadProductImageResponseSchema),
    400: zodToJsonSchema(ErrorResponseSchema),
    403: zodToJsonSchema(ErrorResponseSchema),
    404: zodToJsonSchema(ErrorResponseSchema),
  },
  tags: ["products"],
  summary: "Upload product image",
  description: "Upload an image for a product (admin only)",
  security: [{ bearerAuth: [] }],
};