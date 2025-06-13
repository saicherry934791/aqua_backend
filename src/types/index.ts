export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  FRANCHISE_OWNER = 'franchise_owner',
  SERVICE_AGENT = 'service_agent',
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface GeoPolygon {
  type: string;
  coordinates: number[][][];
}

export enum OrderType {
  PURCHASE = 'purchase',
  RENTAL = 'rental',
}

export enum OrderStatus {
  CREATED = 'created',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_COMPLETED = 'payment_completed',
  ASSIGNED = 'assigned',
  INSTALLATION_PENDING = 'installation_pending',
  INSTALLED = 'installed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentType {
  DEPOSIT = 'deposit',
  PURCHASE = 'purchase',
  RENTAL = 'rental',
  REFUND = 'refund',
}

export enum RentalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  TERMINATED = 'terminated',
  EXPIRED = 'expired',
}

export enum ServiceRequestType {
  INSTALLATION = 'installation',
  REPAIR = 'repair',
  MAINTENANCE = 'maintenance',
  UNINSTALLATION = 'uninstallation',
  OTHER = 'other',
}

export enum ServiceRequestStatus {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum NotificationType {
  ORDER_CONFIRMATION = 'order_confirmation',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILURE = 'payment_failure',
  SERVICE_REQUEST = 'service_request',
  ASSIGNMENT_NOTIFICATION = 'assignment_notification',
  STATUS_UPDATE = 'status_update',
  RENTAL_REMINDER = 'rental_reminder',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  address?: string;
  alternativePhone?: string;
  role: UserRole;
  location?: GeoLocation;
  franchiseAreaId?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  firebaseUid?: string;
}

export interface FranchiseArea {
  id: string;
  name: string;
  description?: string;
  geoPolygon: GeoPolygon;
  ownerId?: string;
  isCompanyManaged: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  rentPrice: number;
  buyPrice: number;
  deposit: number;
  isRentable: boolean;
  isPurchasable: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ProductFeature {
  id: string;
  productId: string;
  name: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  customerId: string;
  productId: string;
  type: OrderType;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  serviceAgentId?: string;
  installationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Rental {
  id: string;
  orderId: string;
  customerId: string;
  productId: string;
  status: RentalStatus;
  startDate: Date;
  pausedAt?: Date;
  endDate?: Date;
  currentPeriodStartDate: Date;
  currentPeriodEndDate: Date;
  monthlyAmount: number;
  depositAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  productId: string;
  orderId?: string;
  type: ServiceRequestType;
  description: string;
  status: ServiceRequestStatus;
  assignedToId?: string;
  franchiseAreaId: string;
  scheduledDate?: Date;
  completedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string;
  referenceType?: string;
  channels: NotificationChannel[];
  status: NotificationStatus;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  franchiseAreaId?: string;
  iat?: number;
  exp?: number;
}

export interface ApiError extends Error {
  statusCode: number;
  error: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  phone: string;
  otpCode: string;
}

export interface RegisterUserRequest {
  phone: string;
  name: string;
  email?: string;
  address?: string;
  alternativePhone?: string;
  location?: GeoLocation;
}

export interface FirebaseUser {
  uid: string;
  phone_number: string;
}