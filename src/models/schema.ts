// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { sqliteTable, text, integer, real, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { InferSelectModel, sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  UserRole,
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  RentalStatus,
  ServiceRequestType,
  ServiceRequestStatus,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  InstallationRequestStatus,
  PurifierConnectionStatus,
  SubscriptionStatus,
  ServicePaymentStatus,
} from "../types";

/* FranchiseAreas must be declared first due to reference in users */
export const franchiseAreas = sqliteTable("franchise_areas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  geoPolygon: text("geo_polygon", { mode: 'json' }).notNull(),
  ownerId: text("owner_id"),
  isCompanyManaged: integer("is_company_managed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true)
});

/* Users */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // ✅ make 'id' the primary key

    phone: text("phone").notNull(),
    role: text("role", { enum: Object.values(UserRole) }).notNull().default(UserRole.CUSTOMER),

    name: text("name"),
    email: text("email"),
    address: text("address"),
    alternativePhone: text("alternative_phone"),
    locationLatitude: real("location_latitude"),
    locationLongitude: real("location_longitude"),
    franchiseAreaId: text("franchise_area_id").references(() => franchiseAreas.id),
    firebaseUid: text("firebase_uid"),
    hasOnboarded: integer("has_onboarded", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (users) => ({
    uniquePhoneRole: uniqueIndex("unique_phone_role").on(users.phone, users.role),
  })
);


/* Products */
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  images: text("images").notNull(), // JSON string array
  rentPrice: integer("rent_price").notNull(),
  buyPrice: integer("buy_price").notNull(),
  deposit: integer("deposit").notNull(),
  isRentable: integer("is_rentable", { mode: "boolean" }).notNull().default(true),
  isPurchasable: integer("is_purchasable", { mode: "boolean" }).notNull().default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Product Features */
export const productFeatures = sqliteTable("product_features", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Coupons */
export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // discount, free_service, etc.
  discountPercentage: integer("discount_percentage"),
  discountAmount: integer("discount_amount"),
  minOrderAmount: integer("min_order_amount"),
  maxDiscountAmount: integer("max_discount_amount"),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to").notNull(),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Orders */
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  type: text("type", { enum: Object.values(OrderType) }).notNull(),
  status: text("status", { enum: Object.values(OrderStatus) }).notNull().default(OrderStatus.CREATED),
  totalAmount: integer("total_amount").notNull(),
  paymentStatus: text("payment_status", { enum: Object.values(PaymentStatus) }).notNull().default(PaymentStatus.PENDING),
  serviceAgentId: text("service_agent_id").references(() => users.id),
  installationDate: text("installation_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Payments */
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  amount: integer("amount").notNull(),
  type: text("type", { enum: Object.values(PaymentType) }).notNull(),
  status: text("status", { enum: Object.values(PaymentStatus) }).notNull().default(PaymentStatus.PENDING),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayOrderId: text("razorpay_order_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Rentals */
export const rentals = sqliteTable("rentals", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  customerId: text("customer_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  status: text("status", { enum: Object.values(RentalStatus) }).notNull().default(RentalStatus.ACTIVE),
  startDate: text("start_date").notNull(),
  pausedAt: text("paused_at"),
  endDate: text("end_date"),
  currentPeriodStartDate: text("current_period_start_date").notNull(),
  currentPeriodEndDate: text("current_period_end_date").notNull(),
  monthlyAmount: integer("monthly_amount").notNull(),
  depositAmount: integer("deposit_amount").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Installation Requests */
export const installationRequests = sqliteTable("installation_requests", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  city: text("city").notNull(),
  franchiseAreaId: text("franchise_area_id").notNull().references(() => franchiseAreas.id),
  installationAddress: text("installation_address").notNull(),
  locationLatitude: real("location_latitude").notNull(),
  locationLongitude: real("location_longitude").notNull(),
  status: text("status", { enum: Object.values(InstallationRequestStatus) }).notNull().default(InstallationRequestStatus.CREATED),
  notes: text("notes"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  connectId: text("connect_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Purifier Connections */
export const purifierConnections = sqliteTable("purifier_connections", {
  id: text("id").primaryKey(),
  connectId: text("connect_id").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  installationRequestId: text("installation_request_id").notNull().references(() => installationRequests.id),
  franchiseAreaId: text("franchise_area_id").notNull().references(() => franchiseAreas.id),
  status: text("status", { enum: Object.values(PurifierConnectionStatus) }).notNull().default(PurifierConnectionStatus.ACTIVE),
  planName: text("plan_name").notNull(),
  planType: text("plan_type", { enum: ["rental", "purchase"] }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  nextPaymentDate: text("next_payment_date"),
  monthlyAmount: integer("monthly_amount"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Service Requests - Updated to include images field */
export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  orderId: text("order_id").references(() => orders.id),
  purifierConnectionId: text("purifier_connection_id").references(() => purifierConnections.id),
  type: text("type", { enum: Object.values(ServiceRequestType) }).notNull(),
  description: text("description").notNull(),
  images: text("images"), // JSON string array for uploaded images
  beforeImages: text("before_images"), // JSON string array for before service images
  afterImages: text("after_images"), // JSON string array for after service images
  status: text("status", { enum: Object.values(ServiceRequestStatus) }).notNull().default(ServiceRequestStatus.CREATED),
  assignedToId: text("assigned_to_id").references(() => users.id),
  franchiseAreaId: text("franchise_area_id").notNull().references(() => franchiseAreas.id),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  paymentRequired: integer("payment_required", { mode: "boolean" }).notNull().default(false),
  paymentAmount: integer("payment_amount"),
  paymentProofImage: text("payment_proof_image"),
  paymentStatus: text("payment_status", { enum: Object.values(ServicePaymentStatus) }).notNull().default(ServicePaymentStatus.NOT_REQUIRED),
  serviceNotes: text("service_notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Subscription Payments */
export const subscriptionPayments = sqliteTable("subscription_payments", {
  id: text("id").primaryKey(),
  purifierConnectionId: text("purifier_connection_id").notNull().references(() => purifierConnections.id),
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(),
  paidDate: text("paid_date"),
  status: text("status", { enum: Object.values(PaymentStatus) }).notNull().default(PaymentStatus.PENDING),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayOrderId: text("razorpay_order_id"),
  paymentMethod: text("payment_method"), // 'autopay', 'manual', 'offline'
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Notifications */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { enum: Object.values(NotificationType) }).notNull(),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  channels: text("channels").notNull(), // JSON array string
  status: text("status", { enum: Object.values(NotificationStatus) }).notNull().default(NotificationStatus.PENDING),
  scheduledAt: text("scheduled_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

/* Push Subscriptions */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Define relations properly
export const productRelations = relations(products, ({ many }) => ({
  features: many(productFeatures),
  orders: many(orders),
  rentals: many(rentals),
  serviceRequests: many(serviceRequests),
}));

export const productFeatureRelations = relations(productFeatures, ({ one }) => ({
  product: one(products, {
    fields: [productFeatures.productId],
    references: [products.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  franchiseArea: one(franchiseAreas, {
    fields: [users.franchiseAreaId],
    references: [franchiseAreas.id],
  }),
  orders: many(orders, { relationName: "customerOrders" }),
  assignedOrders: many(orders, { relationName: "agentOrders" }),
  rentals: many(rentals),
  serviceRequests: many(serviceRequests, { relationName: "customerServiceRequests" }),
  assignedServiceRequests: many(serviceRequests, { relationName: "agentServiceRequests" }),
  installationRequests: many(installationRequests),
  purifierConnections: many(purifierConnections),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
}));

export const installationRequestRelations = relations(installationRequests, ({ one }) => ({
  customer: one(users, {
    fields: [installationRequests.customerId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [installationRequests.productId],
    references: [products.id],
  }),
  franchiseArea: one(franchiseAreas, {
    fields: [installationRequests.franchiseAreaId],
    references: [franchiseAreas.id],
  }),
  reviewedByUser: one(users, {
    fields: [installationRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const purifierConnectionRelations = relations(purifierConnections, ({ one, many }) => ({
  customer: one(users, {
    fields: [purifierConnections.customerId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [purifierConnections.productId],
    references: [products.id],
  }),
  installationRequest: one(installationRequests, {
    fields: [purifierConnections.installationRequestId],
    references: [installationRequests.id],
  }),
  franchiseArea: one(franchiseAreas, {
    fields: [purifierConnections.franchiseAreaId],
    references: [franchiseAreas.id],
  }),
  serviceRequests: many(serviceRequests),
  subscriptionPayments: many(subscriptionPayments),
}));

export const franchiseAreaRelations = relations(franchiseAreas, ({ many, one }) => ({
  users: many(users),
  serviceRequests: many(serviceRequests),
  owner: one(users, {
    fields: [franchiseAreas.ownerId],
    references: [users.id],
  }),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
    relationName: "customerOrders",
  }),
  serviceAgent: one(users, {
    fields: [orders.serviceAgentId],
    references: [users.id],
    relationName: "agentOrders",
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  payments: many(payments),
  rental: one(rentals),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const rentalRelations = relations(rentals, ({ one }) => ({
  order: one(orders, {
    fields: [rentals.orderId],
    references: [orders.id],
  }),
  customer: one(users, {
    fields: [rentals.customerId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [rentals.productId],
    references: [products.id],
  }),
}));

export const serviceRequestRelations = relations(serviceRequests, ({ one }) => ({
  customer: one(users, {
    fields: [serviceRequests.customerId],
    references: [users.id],
    relationName: "customerServiceRequests",
  }),
  assignedTo: one(users, {
    fields: [serviceRequests.assignedToId],
    references: [users.id],
    relationName: "agentServiceRequests",
  }),
  product: one(products, {
    fields: [serviceRequests.productId],
    references: [products.id],
  }),
  order: one(orders, {
    fields: [serviceRequests.orderId],
    references: [orders.id],
  }),
  purifierConnection: one(purifierConnections, {
    fields: [serviceRequests.purifierConnectionId],
    references: [purifierConnections.id],
  }),
  franchiseArea: one(franchiseAreas, {
    fields: [serviceRequests.franchiseAreaId],
    references: [franchiseAreas.id],
  }),
}));

export const subscriptionPaymentRelations = relations(subscriptionPayments, ({ one }) => ({
  purifierConnection: one(purifierConnections, {
    fields: [subscriptionPayments.purifierConnectionId],
    references: [purifierConnections.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export type franchiseArea = InferSelectModel<typeof franchiseAreas>;
export type User = InferSelectModel<typeof users>;
export type InstallationRequest = InferSelectModel<typeof installationRequests>;
export type PurifierConnection = InferSelectModel<typeof purifierConnections>;
export type SubscriptionPayment = InferSelectModel<typeof subscriptionPayments>;