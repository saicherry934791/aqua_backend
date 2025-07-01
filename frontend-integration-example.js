// Frontend Integration Example for Updated Payment Flow
// This shows how to integrate with the updated backend APIs

const API_BASE_URL = 'https://your-backend-url.com/api';

class OrderService {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

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

// Updated handlePayment function for your frontend
const handlePayment = async () => {
  if (!validateForm()) return;

  console.log('Shipping info with coordinates:', shippingInfo);

  setLoading(true);
  try {
    // Initialize order service with your access token
    const orderService = new OrderService(yourAccessToken);

    // Extract product information from your items array
    // Assuming items[0] contains the product you want to order
    const product = items[0];
    const productId = product.id; // or product.productId
    const orderType = product.type || 'purchase'; // 'purchase' or 'rental'

    // Prepare userDetails for the backend (from shippingInfo)
    const userDetails = {
      name: shippingInfo.fullName,
      email: user?.email, // Use actual user email from your auth context
      address: shippingInfo.address,
      phone: shippingInfo.phone.replace(/^\+91/, ''), // Remove +91 prefix if present
      latitude: shippingInfo.latitude,
      longitude: shippingInfo.longitude,
    };

    // 1. Create the order on the backend
    const createOrderPayload = {
      productId: productId,
      type: orderType,
      userDetails: userDetails,
      // installationDate: 'YYYY-MM-DDTHH:MM:SSZ', // Optional: if you have a selected installation date
    };

    console.log('Creating order with payload:', createOrderPayload);

    const { order: createdOrder } = await orderService.createOrder(createOrderPayload);
    const orderId = createdOrder.id;

    console.log('Order created successfully:', createdOrder);

    // 2. Initiate payment for the created order
    const { paymentInfo } = await orderService.initiatePayment(orderId);

    console.log('Payment initiated:', paymentInfo);

    // 3. Prepare Razorpay options using paymentInfo from backend
    const options = {
      description: 'AquaHome Purchase',
      image: 'https://your-logo-url.com/logo.png', // Replace with your actual logo URL
      currency: paymentInfo.currency,
      key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_your_key_here',
      amount: paymentInfo.amount, // Already in paise from backend
      name: 'AquaHome',
      order_id: paymentInfo.razorpayOrderId,
      prefill: {
        email: paymentInfo.customerEmail || 'customer@example.com',
        contact: paymentInfo.customerPhone,
        name: paymentInfo.customerName,
      },
      theme: {
        color: '#4fa3c4',
      },
      notes: {
        address: userDetails.address,
        latitude: userDetails.latitude?.toString() || '',
        longitude: userDetails.longitude?.toString() || '',
      },
    };

    // 4. Open Razorpay checkout
    const paymentResult = await razorpayService.openCheckout(options);

    // 5. Verify payment
    if (paymentResult.razorpay_payment_id) {
      const verifyPaymentPayload = {
        razorpayPaymentId: paymentResult.razorpay_payment_id,
        razorpayOrderId: paymentResult.razorpay_order_id || '',
        razorpaySignature: paymentResult.razorpay_signature || '',
      };

      console.log('Verifying payment:', verifyPaymentPayload);

      const { success: isVerified } = await orderService.verifyPayment(orderId, verifyPaymentPayload);

      if (isVerified) {
        // Navigate to success page
        router.replace({
          pathname: '/order-confirmation',
          params: {
            paymentId: paymentResult.razorpay_payment_id,
            orderId: paymentResult.razorpay_order_id,
            amount: (paymentInfo.amount / 100).toString(), // Convert back to rupees for display
            shippingInfo: JSON.stringify(userDetails),
          },
        });
      } else {
        Alert.alert('Error', 'Payment verification failed. Please contact support.');
      }
    }
  } catch (error) {
    console.error('Payment error:', error);
    Alert.alert('Payment Failed', error.message || 'There was an error processing your payment. Please try again.');
  } finally {
    setLoading(false);
  }
};

// Example of how to handle multiple products (if needed in the future)
const handleMultipleProductsPayment = async () => {
  // If you need to support multiple products in a single order,
  // you would need to either:
  // 1. Create multiple orders (one for each product)
  // 2. Extend the backend to support multi-item orders

  // Option 1: Create multiple orders
  const orders = [];
  for (const item of items) {
    const orderData = {
      productId: item.id,
      type: item.type,
      userDetails: userDetails,
    };
    
    const { order } = await orderService.createOrder(orderData);
    orders.push(order);
  }

  // Then handle payment for each order separately
  // This approach gives you more flexibility but requires more API calls
};

// Export for use in your React Native component
export { handlePayment, OrderService };