# PuriFiler Backend - Water Purifier Management System

## Overview

PuriFiler is a comprehensive water purifier rental and sales management system with multiple stakeholders: customers, admins, franchise owners, and service agents.

## New Architecture & Flow

### User Journey

1. **Authentication**: Phone/OTP login with Firebase
2. **Onboarding**: New users provide name, alternative number, and city
3. **Product Discovery**: Browse products with images, names, prices
4. **Installation Requests**: Submit requests with location mapping
5. **Connect ID System**: Access purifier-specific dashboard after installation
6. **Service Management**: Create and track service requests with image uploads
7. **Subscription Management**: Automated payments via Razorpay autopay

### Key Features

- **Connect ID Dashboard**: Separate dashboard for each purifier connection
- **Enhanced Service Requests**: Before/after images, payment handling
- **Subscription Automation**: Razorpay autopay integration
- **Comprehensive Reporting**: Franchise performance and subscription reports
- **Real-time Notifications**: Multi-channel notifications (Push, Email, WhatsApp)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with Firebase ID token
- `POST /api/auth/onboard` - Complete user onboarding
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/me` - Get current user details

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (Admin only)

### Installation Requests
- `POST /api/installation-requests` - Create installation request
- `GET /api/installation-requests/my-requests` - Get user's requests
- `GET /api/installation-requests` - Get all requests (Admin/Franchise)
- `POST /api/installation-requests/:id/approve` - Approve request

### Purifier Dashboard (Connect ID)
- `POST /api/purifier-dashboard/connect-login` - Login with Connect ID
- `GET /api/purifier-dashboard/:connectId` - Get dashboard data
- `GET /api/purifier-dashboard/:connectId/plan` - Get plan details
- `GET /api/purifier-dashboard/:connectId/payment-info` - Get payment info
- `POST /api/purifier-dashboard/:connectId/service-requests` - Create service request

### Service Requests
- `GET /api/service-requests` - Get service requests (role-based)
- `POST /api/service-requests` - Create service request
- `POST /api/service-requests/:id/accept` - Accept request (Agent)
- `POST /api/service-requests/:id/complete` - Complete with images (Agent)

### Subscriptions
- `POST /api/subscriptions/:connectId/autopay` - Enable autopay
- `POST /api/subscriptions/:connectId/manual-payment` - Process manual payment
- `GET /api/subscriptions/:connectId` - Get subscription details

### Reports
- `GET /api/reports/franchise/:franchiseAreaId` - Franchise performance report
- `GET /api/reports/subscriptions` - Subscription report
- `GET /api/reports/services` - Service report

### Franchise Management
- `GET /api/franchises` - Get all franchise areas
- `POST /api/franchises` - Create franchise area
- `POST /api/franchises/:id/assign-owner` - Assign franchise owner

## Database Schema

### Core Tables
- `users` - User management with roles
- `franchise_areas` - Geographic franchise mapping
- `products` - Product catalog
- `installation_requests` - Installation request workflow
- `purifier_connections` - Active purifier connections with Connect IDs
- `service_requests` - Enhanced service management
- `subscription_payments` - Payment tracking
- `notifications` - Multi-channel notifications

## State Machine Design

The system implements 7 state machines:

1. **User Authentication & Onboarding**
2. **Product Discovery & Installation Request**
3. **Installation Request Management**
4. **Purifier Dashboard (Connect ID Access)**
5. **Service Request Lifecycle**
6. **Payment & Subscription Management**
7. **Agent Service Management**

## Technology Stack

- **Backend**: Fastify with TypeScript
- **Database**: Turso DB with Drizzle ORM
- **Authentication**: Firebase Auth
- **Payments**: Razorpay with autopay
- **Storage**: AWS S3
- **Notifications**: Email (SES), WhatsApp, Push (FCM)

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
TURSO_DB_URL=your-turso-url
TURSO_AUTH_TOKEN=your-auth-token

# Firebase
GOOGLE_SERVICE_ACCOUNT_JSON=base64-encoded-service-account

# Razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret

# AWS
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name

# JWT
JWT_SECRET=your-jwt-secret
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Fill in your environment variables
```

3. Run database migrations:
```bash
npm run migrate
```

4. Start development server:
```bash
npm run dev
```

5. Access API documentation:
```
http://localhost:3000/documentation
```

## Key Improvements Made

### ✅ Implemented
- Complete Connect ID system for purifier-specific access
- Enhanced service request workflow with image handling
- Subscription management with Razorpay autopay
- Comprehensive reporting system
- Cleaned up unnecessary order/rental complexity
- Improved state machine design

### 🔄 Simplified Architecture
- Removed complex order/rental system
- Streamlined to installation requests → purifier connections
- Direct service request management
- Simplified payment flow with autopay

### 📊 Enhanced Features
- Real-time agent notifications
- Before/after service images
- Payment proof handling
- Franchise performance reports
- Subscription analytics

The system now provides a clean, efficient flow from product discovery to ongoing service management with proper state transitions and comprehensive reporting capabilities.