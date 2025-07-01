// Frontend Integration Example for Single Checkout Screen Payment Flow
// This shows the complete flow for your checkout screen

const API_BASE_URL = 'https://your-backend-url.com/api';

class OrderService {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  // Create order with product and user details
  async createOrder(orderData) {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create order');
    }

    return await response.json();
  }

  // Initiate payment for the order
  async initiatePayment(orderId) {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to initiate payment');
    }

    return await response.json();
  }

  // Verify payment after Razorpay callback
  async verifyPayment(orderId, paymentData) {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Payment verification failed');
    }

    return await response.json();
  }
}

// Complete payment handler for your single checkout screen
const handlePayment = async () => {
  if (!validateForm()) return;

  console.log('Starting payment process with shipping info:', shippingInfo);

  setLoading(true);
  try {
    // Initialize order service
    const orderService = new OrderService(yourAccessToken);

    // Extract product information from your items
    const product = items[0]; // Assuming single product checkout
    const productId = product.id;
    const orderType = product.type || 'purchase'; // 'purchase' or 'rental'

    // Prepare user details from shipping form
    const userDetails = {
      name: shippingInfo.fullName,
      email: user?.email,
      address: shippingInfo.address,
      phone: shippingInfo.phone.replace(/^\+91/, ''), // Remove +91 prefix
      latitude: shippingInfo.latitude,
      longitude: shippingInfo.longitude,
    };

    // Step 1: Create order on backend
    console.log('Creating order...');
    const createOrderPayload = {
      productId: productId,
      type: orderType,
      userDetails: userDetails,
    };

    const { order: createdOrder } = await orderService.createOrder(createOrderPayload);
    const orderId = createdOrder.id;
    console.log('Order created:', orderId);

    // Step 2: Initiate payment
    console.log('Initiating payment...');
    const { paymentInfo } = await orderService.initiatePayment(orderId);
    console.log('Payment initiated:', paymentInfo);

    // Step 3: Open Razorpay checkout with backend data
    const razorpayOptions = {
      description: 'AquaHome Purchase',
      image: 'https://your-logo-url.com/logo.png',
      currency: paymentInfo.currency,
      key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
      amount: paymentInfo.amount, // Already in paise from backend
      name: 'AquaHome',
      order_id: paymentInfo.razorpayOrderId,
      prefill: {
        email: paymentInfo.customerEmail,
        contact: paymentInfo.customerPhone,
        name: paymentInfo.customerName,
      },
      theme: {
        color: '#4fa3c4',
      },
      notes: {
        orderId: orderId,
        productId: productId,
        orderType: orderType,
      },
    };

    // Step 4: Process Razorpay payment
    console.log('Opening Razorpay checkout...');
    const paymentResult = await razorpayService.openCheckout(razorpayOptions);

    // Step 5: Verify payment if successful
    if (paymentResult.razorpay_payment_id) {
      console.log('Payment completed, verifying...');
      
      const verifyPaymentData = {
        razorpayPaymentId: paymentResult.razorpay_payment_id,
        razorpayOrderId: paymentResult.razorpay_order_id,
        razorpaySignature: paymentResult.razorpay_signature,
      };

      const { success: isVerified } = await orderService.verifyPayment(orderId, verifyPaymentData);

      if (isVerified) {
        console.log('Payment verified successfully');
        
        // Navigate to success screen
        router.replace({
          pathname: '/order-confirmation',
          params: {
            orderId: orderId,
            paymentId: paymentResult.razorpay_payment_id,
            amount: (paymentInfo.amount / 100).toString(),
            productName: paymentInfo.productName,
            orderType: orderType,
          },
        });
      } else {
        Alert.alert('Error', 'Payment verification failed. Please contact support.');
      }
    } else {
      Alert.alert('Payment Cancelled', 'Payment was cancelled or failed.');
    }

  } catch (error) {
    console.error('Payment process error:', error);
    Alert.alert(
      'Payment Failed', 
      error.message || 'There was an error processing your payment. Please try again.'
    );
  } finally {
    setLoading(false);
  }
};

// Alternative simplified version if you want even less steps
const handlePaymentSimplified = async () => {
  if (!validateForm()) return;

  setLoading(true);
  try {
    const orderService = new OrderService(yourAccessToken);
    
    // Single API call that creates order and initiates payment
    const orderData = {
      productId: items[0].id,
      type: items[0].type || 'purchase',
      userDetails: {
        name: shippingInfo.fullName,
        email: user?.email,
        address: shippingInfo.address,
        phone: shippingInfo.phone.replace(/^\+91/, ''),
        latitude: shippingInfo.latitude,
        longitude: shippingInfo.longitude,
      },
    };

    // Create order and get payment info in one call
    const { order, paymentInfo } = await orderService.createOrder(orderData);

    // Directly open Razorpay with the response
    const paymentResult = await razorpayService.openCheckout({
      key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
      amount: paymentInfo.amount,
      order_id: paymentInfo.razorpayOrderId,
      name: 'AquaHome',
      description: `${paymentInfo.productName} - ${order.type}`,
      prefill: {
        name: paymentInfo.customerName,
        email: paymentInfo.customerEmail,
        contact: paymentInfo.customerPhone,
      },
      theme: { color: '#4fa3c4' },
    });

    // Verify payment
    if (paymentResult.razorpay_payment_id) {
      const { success } = await orderService.verifyPayment(order.id, {
        razorpayPaymentId: paymentResult.razorpay_payment_id,
        razorpayOrderId: paymentResult.razorpay_order_id,
        razorpaySignature: paymentResult.razorpay_signature,
      });

      if (success) {
        router.replace({
          pathname: '/order-confirmation',
          params: {
            orderId: order.id,
            paymentId: paymentResult.razorpay_payment_id,
          },
        });
      }
    }

  } catch (error) {
    console.error('Payment error:', error);
    Alert.alert('Payment Failed', error.message);
  } finally {
    setLoading(false);
  }
};

// Export the functions for use in your checkout screen
export { handlePayment, handlePaymentSimplified, OrderService };