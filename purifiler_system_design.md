# PuriFiler System Design

## Implementation approach

Based on the PRD requirements, we'll build a robust backend system using Fastify as the framework with Turso DB as the database. The system will handle multiple stakeholders (customers, admins, franchise owners, and service agents) with different access levels through role-based access control.

### Key Technical Components:

1. **Backend Framework**: Fastify (with TypeScript)
2. **Database**: Turso DB with Drizzle ORM
3. **Authentication**: Firebase for phone OTP verification
4. **File Storage**: AWS S3 for product images
5. **Payment Processing**: Razorpay integration
6. **Notification System**: Email, SMS, WhatsApp, and Push Notifications
7. **API Documentation**: Swagger integration
8. **Validation**: Zod for schema validation

### Project Structure:

```
/purifiler-backend
  /src
    /controllers       # Request handlers
    /models            # Database schema definitions
    /services          # Business logic
    /routes            # Route definitions with Zod schemas
    /schemas           # Zod schema definitions
    /middlewares       # Custom middleware functions
    /utils             # Utility functions
    /config            # Configuration files
    /plugins           # Fastify plugins
    /types             # TypeScript type definitions
    app.ts             # Main application file
    server.ts          # Server initialization
  /migrations         # Database migrations
  /test               # Test files
  package.json
  tsconfig.json
  .env.example
```

### Core Functionality Implementation:

1. **User Authentication and Management**:
   - Firebase integration for phone OTP authentication
   - User registration and profile management
   - Role-based access control (RBAC)

2. **Franchise and Service Area Management**:
   - Geographic polygon mapping for defining service areas
   - Franchise owner assignment and management
   - Mapping users to appropriate service areas

3. **Product Catalog Management**:
   - Product CRUD operations with image handling via S3
   - Product categorization and filtering capabilities
   - Pricing models for both rental and purchase options

4. **Order Processing**:
   - Handling both rental and purchase workflows
   - Integration with Razorpay for payment processing
   - Order status tracking and management

5. **Service Request Management**:
   - Creation and tracking of service requests
   - Assignment to appropriate service agents
   - Status updates and notifications

6. **Notification System**:
   - Multi-channel notification delivery (Email, SMS, WhatsApp, Push)
   - Template-based message generation
   - Scheduled and triggered notifications

### Difficult Points and Solutions:

1. **Geographic Service Area Management**:
   - We'll use GeoJSON for storing polygon data defining service areas
   - Implement point-in-polygon algorithms to determine which service area a customer belongs to

2. **Complex Rental Management**:
   - Design a flexible subscription model that supports pause/resume functionality
   - Implement recurring payment handling for rentals
   - Track rental lifecycle including installation, maintenance, and potential return

3. **Multi-stakeholder Notifications**:
   - Create a unified notification service that supports multiple channels
   - Implement appropriate notification targeting based on user roles and actions
   - Ensure delivery tracking and retry mechanisms

4. **Service Assignment Logic**:
   - Develop an intelligent assignment algorithm considering agent workload, proximity, and skills
   - Implement acceptance/rejection flows for service agents
   - Handle edge cases like reassignment and escalation

5. **Role-Based Access Control**:
   - Implement a granular permission system beyond basic roles
   - Ensure proper access control at both API and service levels
   - Handle franchise-specific access restrictions

## Data structures and interfaces

The database schema will be implemented using Drizzle ORM with Turso DB. Below is the class diagram representing the core entities and their relationships:

```mermaid
classDiagram
    class User {
        +id: string
        +phone: string
        +name: string
        +email: string
        +address: string
        +alternativePhone: string
        +role: UserRole
        +location: GeoLocation
        +franchiseAreaId: string
        +createdAt: Date
        +updatedAt: Date
        +isActive: boolean
    }

    class UserRole {
        <<enum>>
        CUSTOMER
        ADMIN
        FRANCHISE_OWNER
        SERVICE_AGENT
    }

    class GeoLocation {
        +latitude: number
        +longitude: number
    }

    class FranchiseArea {
        +id: string
        +name: string
        +description: string
        +geoPolygon: GeoJSON
        +ownerId: string
        +isCompanyManaged: boolean
        +createdAt: Date
        +updatedAt: Date
        +isActive: boolean
    }

    class Product {
        +id: string
        +name: string
        +description: string
        +images: string[]
        +rentPrice: number
        +buyPrice: number
        +deposit: number
        +isRentable: boolean
        +isPurchasable: boolean
        +createdAt: Date
        +updatedAt: Date
        +isActive: boolean
    }

    class ProductFeature {
        +id: string
        +productId: string
        +name: string
        +value: string
        +createdAt: Date
        +updatedAt: Date
    }

    class Order {
        +id: string
        +customerId: string
        +productId: string
        +type: OrderType
        +status: OrderStatus
        +totalAmount: number
        +paymentStatus: PaymentStatus
        +serviceAgentId: string
        +installationDate: Date
        +createdAt: Date
        +updatedAt: Date
    }

    class OrderType {
        <<enum>>
        PURCHASE
        RENTAL
    }

    class OrderStatus {
        <<enum>>
        CREATED
        PAYMENT_PENDING
        PAYMENT_COMPLETED
        ASSIGNED
        INSTALLATION_PENDING
        INSTALLED
        CANCELLED
        COMPLETED
    }

    class PaymentStatus {
        <<enum>>
        PENDING
        COMPLETED
        FAILED
        REFUNDED
    }

    class Payment {
        +id: string
        +orderId: string
        +amount: number
        +type: PaymentType
        +status: PaymentStatus
        +razorpayPaymentId: string
        +razorpayOrderId: string
        +createdAt: Date
        +updatedAt: Date
    }

    class PaymentType {
        <<enum>>
        DEPOSIT
        PURCHASE
        RENTAL
        REFUND
    }

    class Rental {
        +id: string
        +orderId: string
        +customerId: string
        +productId: string
        +status: RentalStatus
        +startDate: Date
        +pausedAt: Date
        +endDate: Date
        +currentPeriodStartDate: Date
        +currentPeriodEndDate: Date
        +monthlyAmount: number
        +depositAmount: number
        +createdAt: Date
        +updatedAt: Date
    }

    class RentalStatus {
        <<enum>>
        ACTIVE
        PAUSED
        TERMINATED
        EXPIRED
    }

    class ServiceRequest {
        +id: string
        +customerId: string
        +productId: string
        +orderId: string
        +type: ServiceRequestType
        +description: string
        +status: ServiceRequestStatus
        +assignedToId: string
        +franchiseAreaId: string
        +scheduledDate: Date
        +completedDate: Date
        +createdAt: Date
        +updatedAt: Date
    }

    class ServiceRequestType {
        <<enum>>
        INSTALLATION
        REPAIR
        MAINTENANCE
        UNINSTALLATION
        OTHER
    }

    class ServiceRequestStatus {
        <<enum>>
        CREATED
        ASSIGNED
        IN_PROGRESS
        COMPLETED
        CANCELLED
    }

    class Notification {
        +id: string
        +userId: string
        +title: string
        +message: string
        +type: NotificationType
        +referenceId: string
        +referenceType: string
        +channels: NotificationChannel[]
        +status: NotificationStatus
        +createdAt: Date
        +updatedAt: Date
        +scheduledAt: Date
    }

    class NotificationType {
        <<enum>>
        ORDER_CONFIRMATION
        PAYMENT_SUCCESS
        PAYMENT_FAILURE
        SERVICE_REQUEST
        ASSIGNMENT_NOTIFICATION
        STATUS_UPDATE
        RENTAL_REMINDER
    }

    class NotificationChannel {
        <<enum>>
        EMAIL
        SMS
        PUSH
        WHATSAPP
    }

    class NotificationStatus {
        <<enum>>
        PENDING
        SENT
        FAILED
        READ
    }

    User "1" -- "*" Order: places
    User "1" -- "*" Rental: has
    User "1" -- "*" ServiceRequest: creates
    User "1" -- "*" ServiceRequest: assigned to
    User "1" -- "*" Notification: receives
    User "*" -- "1" FranchiseArea: belongs to
    User "1" -- "*" FranchiseArea: owns

    Product "1" -- "*" ProductFeature: has
    Product "1" -- "*" Order: ordered in
    Product "1" -- "*" Rental: rented in
    Product "1" -- "*" ServiceRequest: serviced in

    Order "1" -- "*" Payment: has
    Order "1" -- "1" Rental: creates

    FranchiseArea "1" -- "*" ServiceRequest: handles
```

## Program call flow

The sequence diagrams below illustrate the key flows in the PuriFiler system:

### User Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant Firebase
    participant UserService
    participant DB

    Client->>AuthController: Request OTP (phone)
    AuthController->>AuthService: initiateOtp(phone)
    AuthService->>Firebase: sendOtpToPhone(phone)
    Firebase-->>AuthService: otpSent confirmation
    AuthService-->>AuthController: otpInitiated response
    AuthController-->>Client: OTP sent response

    Client->>AuthController: Verify OTP (phone, code)
    AuthController->>AuthService: verifyOtp(phone, code)
    AuthService->>Firebase: verifyPhoneOtp(phone, code)
    Firebase-->>AuthService: verification result with UID
    
    alt First-time user
        AuthService->>UserService: checkUserExists(phone)
        UserService->>DB: findUserByPhone(phone)
        DB-->>UserService: user not found
        AuthService-->>AuthController: registrationRequired response
        AuthController-->>Client: Redirect to registration
        
        Client->>AuthController: Register (userData)
        AuthController->>UserService: createUser(userData)
        UserService->>DB: insertUser(userData)
        DB-->>UserService: user created
        UserService-->>AuthController: user data
        AuthController->>AuthService: generateTokens(userData)
        AuthService-->>AuthController: access and refresh tokens
        AuthController-->>Client: Registration successful with tokens
    else Existing user
        UserService->>DB: findUserByPhone(phone)
        DB-->>UserService: user data
        UserService-->>AuthService: user data
        AuthService->>AuthService: generateTokens(userData)
        AuthService-->>AuthController: access and refresh tokens
        AuthController-->>Client: Login successful with tokens
    end
```

### Product Browsing and Ordering Flow

```mermaid
sequenceDiagram
    participant Client
    participant ProductController
    participant ProductService
    participant OrderController
    participant OrderService
    participant PaymentService
    participant RazorpayAPI
    participant NotificationService
    participant DB

    Client->>ProductController: Get Products (filters)
    ProductController->>ProductService: getProducts(filters)
    ProductService->>DB: queryProducts(filters)
    DB-->>ProductService: product list
    ProductService-->>ProductController: formatted product list
    ProductController-->>Client: Products response

    Client->>ProductController: Get Product Details (id)
    ProductController->>ProductService: getProductById(id)
    ProductService->>DB: queryProductWithFeatures(id)
    DB-->>ProductService: product with features
    ProductService-->>ProductController: formatted product details
    ProductController-->>Client: Product details response

    Client->>OrderController: Create Order (productId, type, userId)
    OrderController->>OrderService: createOrder(orderData)
    OrderService->>DB: insertOrder(orderData)
    DB-->>OrderService: order created
    OrderService->>PaymentService: initiatePayment(orderId, amount)
    PaymentService->>RazorpayAPI: createPaymentOrder(amount)
    RazorpayAPI-->>PaymentService: razorpay order details
    PaymentService->>DB: updateOrderWithPaymentInfo(orderId, paymentInfo)
    DB-->>PaymentService: updated order
    PaymentService-->>OrderService: payment initiation details
    OrderService-->>OrderController: order with payment details
    OrderController-->>Client: Order created with payment info

    Client->>OrderController: Confirm Payment (orderId, paymentId)
    OrderController->>PaymentService: verifyPayment(orderId, paymentId)
    PaymentService->>RazorpayAPI: verifyPaymentSignature(paymentData)
    RazorpayAPI-->>PaymentService: verification result
    PaymentService->>DB: updatePaymentStatus(orderId, status)
    DB-->>PaymentService: updated payment

    alt Rental order
        PaymentService->>OrderService: handleRentalOrderPayment(orderId)
        OrderService->>DB: createRental(orderId)
        DB-->>OrderService: rental created
    else Purchase order
        PaymentService->>OrderService: handlePurchaseOrderPayment(orderId)
        OrderService->>DB: updateOrderStatus(orderId, PAYMENT_COMPLETED)
        DB-->>OrderService: updated order
    end

    OrderService->>NotificationService: sendOrderConfirmation(orderId)
    NotificationService->>DB: createNotification(notification)
    DB-->>NotificationService: notification created
    OrderService-->>OrderController: payment verification result
    OrderController-->>Client: Payment confirmation

    OrderService->>OrderService: assignServiceAgent(orderId)
    OrderService->>DB: createServiceRequest(orderId, INSTALLATION)
    DB-->>OrderService: service request created
    OrderService->>NotificationService: notifyServiceAgent(serviceRequestId)
    NotificationService->>DB: createNotification(notification)
    DB-->>NotificationService: notification created
```

### Service Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant ServiceRequestController
    participant ServiceRequestService
    participant UserService
    participant NotificationService
    participant DB

    Client->>ServiceRequestController: Create Service Request (data)
    ServiceRequestController->>ServiceRequestService: createServiceRequest(data)
    ServiceRequestService->>DB: insertServiceRequest(data)
    DB-->>ServiceRequestService: service request created

    ServiceRequestService->>UserService: findAvailableServiceAgents(franchiseAreaId)
    UserService->>DB: queryServiceAgents(franchiseAreaId)
    DB-->>UserService: available service agents
    UserService-->>ServiceRequestService: service agent list

    ServiceRequestService->>ServiceRequestService: assignServiceAgent(serviceRequestId, agentId)
    ServiceRequestService->>DB: updateServiceRequestAssignee(serviceRequestId, agentId)
    DB-->>ServiceRequestService: updated service request

    ServiceRequestService->>NotificationService: notifyServiceAgent(serviceRequestId, agentId)
    NotificationService->>DB: createNotification(agentNotification)
    DB-->>NotificationService: notification created
    
    ServiceRequestService->>NotificationService: notifyCustomer(serviceRequestId, customerId)
    NotificationService->>DB: createNotification(customerNotification)
    DB-->>NotificationService: notification created

    ServiceRequestService-->>ServiceRequestController: service request details
    ServiceRequestController-->>Client: Service request created response

    Client->>ServiceRequestController: Accept Service Request (serviceRequestId, agentId)
    ServiceRequestController->>ServiceRequestService: acceptServiceRequest(serviceRequestId, agentId)
    ServiceRequestService->>DB: updateServiceRequestStatus(serviceRequestId, IN_PROGRESS)
    DB-->>ServiceRequestService: updated service request

    ServiceRequestService->>NotificationService: notifyCustomerOfAcceptance(serviceRequestId)
    NotificationService->>DB: createNotification(notification)
    DB-->>NotificationService: notification created

    ServiceRequestService-->>ServiceRequestController: acceptance result
    ServiceRequestController-->>Client: Service request accepted response

    Client->>ServiceRequestController: Complete Service Request (serviceRequestId, notes)
    ServiceRequestController->>ServiceRequestService: completeServiceRequest(serviceRequestId, notes)
    ServiceRequestService->>DB: updateServiceRequestStatus(serviceRequestId, COMPLETED)
    DB-->>ServiceRequestService: updated service request

    ServiceRequestService->>NotificationService: notifyCustomerOfCompletion(serviceRequestId)
    NotificationService->>DB: createNotification(notification)
    DB-->>NotificationService: notification created

    ServiceRequestService-->>ServiceRequestController: completion result
    ServiceRequestController-->>Client: Service request completed response
```

### Rental Management Flow

```mermaid
sequenceDiagram
    participant Client
    participant RentalController
    participant RentalService
    participant PaymentService
    participant NotificationService
    participant DB

    Client->>RentalController: Pause Rental (rentalId)
    RentalController->>RentalService: pauseRental(rentalId)
    RentalService->>DB: updateRentalStatus(rentalId, PAUSED)
    RentalService->>DB: updateRentalPausedAt(rentalId, currentDate)
    DB-->>RentalService: updated rental
    RentalService-->>RentalController: pause result
    RentalController-->>Client: Rental paused response

    Client->>RentalController: Resume Rental (rentalId)
    RentalController->>RentalService: resumeRental(rentalId)
    RentalService->>DB: calculateNewPeriodDates(rentalId)
    DB-->>RentalService: period calculations
    RentalService->>DB: updateRentalStatus(rentalId, ACTIVE)
    RentalService->>DB: updateRentalPeriodDates(rentalId, newDates)
    DB-->>RentalService: updated rental
    RentalService-->>RentalController: resume result
    RentalController-->>Client: Rental resumed response

    Client->>RentalController: Terminate Rental (rentalId)
    RentalController->>RentalService: terminateRental(rentalId)
    RentalService->>DB: updateRentalStatus(rentalId, TERMINATED)
    RentalService->>DB: updateRentalEndDate(rentalId, currentDate)
    DB-->>RentalService: updated rental
    
    RentalService->>ServiceRequestService: createServiceRequest(UNINSTALLATION)
    ServiceRequestService->>DB: insertServiceRequest(serviceData)
    DB-->>ServiceRequestService: service request created
    ServiceRequestService-->>RentalService: service request created
    
    RentalService->>NotificationService: notifyUninstallation(rentalId)
    NotificationService->>DB: createNotification(notification)
    DB-->>NotificationService: notification created
    
    RentalService-->>RentalController: termination result
    RentalController-->>Client: Rental terminated response
```

### Franchise Area Management Flow

```mermaid
sequenceDiagram
    participant AdminClient
    participant FranchiseController
    participant FranchiseService
    participant UserService
    participant DB

    AdminClient->>FranchiseController: Create Franchise Area (areaData)
    FranchiseController->>FranchiseService: createFranchiseArea(areaData)
    FranchiseService->>DB: insertFranchiseArea(areaData)
    DB-->>FranchiseService: franchise area created
    FranchiseService-->>FranchiseController: franchise area details
    FranchiseController-->>AdminClient: Franchise area created response

    AdminClient->>FranchiseController: Assign Franchise Owner (areaId, userId)
    FranchiseController->>FranchiseService: assignFranchiseOwner(areaId, userId)
    FranchiseService->>UserService: checkUserRole(userId)
    UserService->>DB: getUserById(userId)
    DB-->>UserService: user data
    UserService-->>FranchiseService: user data

    alt User is not a franchise owner
        FranchiseService->>UserService: updateUserRole(userId, FRANCHISE_OWNER)
        UserService->>DB: updateUser(userId, role)
        DB-->>UserService: updated user
        UserService-->>FranchiseService: updated user data
    end

    FranchiseService->>DB: updateFranchiseOwner(areaId, userId)
    DB-->>FranchiseService: updated franchise area
    FranchiseService-->>FranchiseController: assignment result
    FranchiseController-->>AdminClient: Owner assigned response

    AdminClient->>FranchiseController: Get Service Agents (areaId)
    FranchiseController->>UserService: getServiceAgentsByArea(areaId)
    UserService->>DB: queryUsersByRoleAndArea(SERVICE_AGENT, areaId)
    DB-->>UserService: service agents list
    UserService-->>FranchiseController: service agents data
    FranchiseController-->>AdminClient: Service agents response

    AdminClient->>FranchiseController: Add Service Agent (userData, areaId)
    FranchiseController->>UserService: createServiceAgent(userData, areaId)
    UserService->>DB: insertUser(userData with SERVICE_AGENT role)
    DB-->>UserService: service agent created
    UserService-->>FranchiseController: service agent data
    FranchiseController-->>AdminClient: Service agent added response
```

## Anything UNCLEAR

1. **Payment Scheduling for Rentals**: The PRD doesn't specify how recurring payments for rentals would be handled. Would the system automatically charge customers monthly, or would it send payment reminders? We've designed for both scenarios but would need clarification for the final implementation.

2. **Multiple Franchise Area Handling**: It's unclear if a user (especially service agents) can belong to multiple franchise areas. The current design assumes a user belongs to only one franchise area, but this could be extended if needed.

3. **Service Level Agreements (SLAs)**: The PRD doesn't specify specific SLAs for service request resolution times. This would be important for implementing proper notification and escalation workflows.

4. **Inventory Management**: While the PRD focuses on the rental and service management aspects, it doesn't detail if there should be inventory tracking for purifier units. We've designed the system to track products at a catalog level, but physical inventory tracking would require additional components.

5. **Offline Functionality**: For service agents who might work in areas with limited connectivity, the PRD doesn't specify if offline functionality is required. If needed, this would involve additional complexity in the mobile app design.

6. **Data Analytics Requirements**: While basic reporting is mentioned, specific analytics or business intelligence requirements are not detailed. The system could be extended with analytics capabilities if needed.