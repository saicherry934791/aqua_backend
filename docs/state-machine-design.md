# PuriFiler State Machine Design

## 1. User Authentication & Onboarding States

```mermaid
stateDiagram-v2
    [*] --> PhoneLogin
    PhoneLogin --> OTPVerification
    OTPVerification --> CheckUserExists
    CheckUserExists --> NewUserOnboarding: New User
    CheckUserExists --> ExistingUserDashboard: Existing User
    NewUserOnboarding --> CollectBasicInfo
    CollectBasicInfo --> ProductExploration
    ExistingUserDashboard --> ProductExploration
    ExistingUserDashboard --> ConnectIDLogin: Has Connect ID
    ConnectIDLogin --> PurifierDashboard
```

## 2. Product Discovery & Installation Request States

```mermaid
stateDiagram-v2
    [*] --> ProductListing
    ProductListing --> ProductDetails
    ProductDetails --> InstallationRequestForm
    InstallationRequestForm --> CollectUserDetails
    CollectUserDetails --> SelectFranchiseCity
    SelectFranchiseCity --> MapLocationSelection
    MapLocationSelection --> SubmitInstallationRequest
    SubmitInstallationRequest --> RequestPending
    RequestPending --> RequestApproved: Franchise Owner Approves
    RequestPending --> RequestRejected: Franchise Owner Rejects
    RequestApproved --> ConnectIDGenerated
    ConnectIDGenerated --> InstallationScheduled
    InstallationScheduled --> InstallationCompleted
    InstallationCompleted --> ActiveSubscription
```

## 3. Installation Request Management States

```mermaid
stateDiagram-v2
    [*] --> RequestCreated
    RequestCreated --> UnderReview
    UnderReview --> ContactingCustomer: Franchise Owner Reviews
    ContactingCustomer --> OfflineDiscussion
    OfflineDiscussion --> ApprovalDecision
    ApprovalDecision --> Approved: Continue Next Step
    ApprovalDecision --> Rejected: Decline Request
    Approved --> ConnectIDIssued
    ConnectIDIssued --> InstallationScheduled
    InstallationScheduled --> InstallationInProgress
    InstallationInProgress --> InstallationCompleted
    InstallationCompleted --> ActiveService
```

## 4. Purifier Dashboard States (Connect ID Access)

```mermaid
stateDiagram-v2
    [*] --> ConnectIDAuth
    ConnectIDAuth --> PurifierDashboard
    PurifierDashboard --> PlanDetails
    PurifierDashboard --> PaymentDue
    PurifierDashboard --> RecentServices
    PurifierDashboard --> ServiceManagement
    ServiceManagement --> CreateServiceRequest
    ServiceManagement --> ViewServiceHistory
    CreateServiceRequest --> ServiceRequestPending
    ServiceRequestPending --> ServiceRequestAssigned
    ServiceRequestAssigned --> ServiceInProgress
    ServiceInProgress --> ServiceCompleted
```

## 5. Service Request Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> ServiceRequestCreated
    ServiceRequestCreated --> NotifyingAgents
    NotifyingAgents --> AgentAcceptance: Agent Accepts
    NotifyingAgents --> FranchiseAssignment: Franchise Owner Assigns
    AgentAcceptance --> ServiceScheduled
    FranchiseAssignment --> ServiceScheduled
    ServiceScheduled --> ServiceInProgress
    ServiceInProgress --> ServiceCompleted
    ServiceCompleted --> PaymentRequired: If Payment Needed
    ServiceCompleted --> ServiceClosed: No Payment
    PaymentRequired --> PaymentCompleted
    PaymentCompleted --> ServiceClosed
```

## 6. Payment & Subscription States

```mermaid
stateDiagram-v2
    [*] --> SubscriptionActive
    SubscriptionActive --> PaymentDue
    PaymentDue --> AutoPayAttempt: Razorpay Autopay
    PaymentDue --> ManualPayment: User Initiated
    AutoPayAttempt --> PaymentSuccess
    AutoPayAttempt --> PaymentFailed
    ManualPayment --> PaymentSuccess
    ManualPayment --> PaymentFailed
    PaymentSuccess --> SubscriptionActive
    PaymentFailed --> PaymentRetry
    PaymentRetry --> PaymentSuccess
    PaymentRetry --> SubscriptionSuspended: Max Retries
    SubscriptionSuspended --> SubscriptionActive: Payment Resolved
```

## 7. Agent Service Management States

```mermaid
stateDiagram-v2
    [*] --> ServiceNotification
    ServiceNotification --> AcceptService: Agent Accepts
    ServiceNotification --> ServiceTimeout: No Response
    AcceptService --> ServiceScheduled
    ServiceScheduled --> TravelingToLocation
    TravelingToLocation --> ServiceStarted
    ServiceStarted --> UploadBeforeImages
    UploadBeforeImages --> PerformService
    PerformService --> UploadAfterImages
    UploadAfterImages --> PaymentCheck
    PaymentCheck --> CollectPayment: Payment Required
    PaymentCheck --> ServiceCompleted: No Payment
    CollectPayment --> UploadPaymentProof
    UploadPaymentProof --> ServiceCompleted
    ServiceCompleted --> [*]
```

## Implementation Strategy

### Database Schema Updates Needed:

1. **Connect ID System**
   - `purifier_connections` table
   - Connect ID generation and validation

2. **Enhanced Service Requests**
   - Before/after image storage
   - Payment proof uploads
   - Service completion workflow

3. **Installation Requests**
   - Separate from orders
   - Approval workflow
   - Location mapping

4. **Subscription Management**
   - Razorpay autopay integration
   - Payment scheduling
   - Subscription lifecycle

### API Endpoints to Add/Modify:

1. **Installation Requests**
   - `POST /api/installation-requests`
   - `GET /api/installation-requests/my-requests`
   - `PATCH /api/installation-requests/:id/approve`

2. **Connect ID System**
   - `POST /api/auth/connect-login`
   - `GET /api/purifier-dashboard/:connectId`

3. **Enhanced Service Management**
   - Image upload endpoints
   - Payment proof handling
   - Service completion workflow

4. **Subscription Management**
   - Autopay setup
   - Payment scheduling
   - Subscription status management