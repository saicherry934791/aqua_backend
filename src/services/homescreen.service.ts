import { FastifyInstance } from 'fastify';
import { eq, desc, and, sql } from 'drizzle-orm';
import { products, orders, users, coupons } from '../models/schema';
import { OrderStatus } from '../types';
import { getFastifyInstance } from '../shared/fastify-instance';

export async function getHomescreenData(userId?: string) {
  const fastify = getFastifyInstance();
  
  // Get popular products (top 5 by order count)
  const popularProducts = await getPopularProducts();
  
  // Get recent orders for the user (if authenticated)
  const recentOrders = userId ? await getRecentOrders(userId) : [];
  
  // Get active coupons and promotions
  const couponsAndPromotions = await getActiveCoupons();
  
  return {
    popularProducts,
    recentOrders,
    couponsAndPromotions
  };
}

async function getPopularProducts() {
  const fastify = getFastifyInstance();
  
  // Get products with order counts
  const popularProductsQuery = await fastify.db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.rentPrice, // Using rent price as default display price
      image: products.images,
      orderCount: sql<number>`COUNT(${orders.id})`
    })
    .from(products)
    .leftJoin(orders, eq(orders.productId, products.id))
    .where(eq(products.isActive, true))
    .groupBy(products.id)
    .orderBy(desc(sql`COUNT(${orders.id})`))
    .limit(5);
  
  return popularProductsQuery.map(product => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    image: JSON.parse(product.image)[0] || 'https://images.pexels.com/photos/416528/pexels-photo-416528.jpeg'
  }));
}

async function getRecentOrders(userId: string) {
  const fastify = getFastifyInstance();
  
  const recentOrdersQuery = await fastify.db.query.orders.findMany({
    where: eq(orders.customerId, userId),
    with: {
      product: true
    },
    orderBy: [desc(orders.createdAt)],
    limit: 5
  });
  
  return recentOrdersQuery.map(order => ({
    id: order.id,
    items: [{
      productId: order.product.id,
      name: order.product.name,
      price: order.totalAmount,
      quantity: 1, // Assuming 1 quantity per order for water purifiers
      image: JSON.parse(order.product.images)[0] || 'https://images.pexels.com/photos/416528/pexels-photo-416528.jpeg'
    }],
    total: order.totalAmount,
    status: order.status.toLowerCase(),
    orderDate: order.createdAt.split('T')[0],
    deliveryDate: order.installationDate ? order.installationDate.split('T')[0] : null
  }));
}

async function getActiveCoupons() {
  // Since we don't have a coupons table in the current schema,
  // we'll return mock data for now. In a real implementation,
  // you would query from a coupons/promotions table
  return [
    {
      id: "coupon_1",
      title: "Save 20% on Your Next Filter",
      description: "Use code: FRESH20 at checkout for 20% off on filter replacement",
      code: "FRESH20",
      type: "discount"
    },
    {
      id: "coupon_2", 
      title: "Free Installation Service",
      description: "Get free installation service on your first water purifier rental",
      code: "FREEINSTALL",
      type: "free_service"
    },
    {
      id: "coupon_3",
      title: "Monthly Rental Discount",
      description: "Get 15% off on monthly rental for the first 3 months",
      code: "RENTAL15",
      type: "discount"
    }
  ];
}