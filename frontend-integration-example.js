// Complete Frontend Integration for Single Checkout Screen
// This replaces your existing razorpayService calls with the new backend API flow

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

// Complete Checkout Component with Fixed Payment Flow and Map Integration
import React, { useState, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { CreditCard, MapPin, User, Phone, Navigation, Check } from 'lucide-react-native';
import BackArrowIcon from '@/components/icons/BackArrowIcon';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api'; // Your API service

interface ShippingInfo {
  fullName: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  image: string;
  type: 'product' | 'subscription';
  quantity: number;
}

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { directCheckout, checkoutData, locationData } = useLocalSearchParams();
  const { user, accessToken } = useAuth(); // Make sure to get accessToken from auth context

  console.log('user checkout is', user);
  
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [total, setTotal] = useState(0);
  const [locationSelected, setLocationSelected] = useState(false);

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    fullName: user?.name || '',
    phone: user?.phone?.split('+91')[1] || '',
    address: user?.address || '',
    latitude: user?.latitude,
    longitude: user?.longitude,
  });

  // Check if user already has location coordinates
  React.useEffect(() => {
    if (user?.latitude && user?.longitude && user?.address) {
      setShippingInfo(prev => ({
        ...prev,
        address: user.address,
        latitude: user.latitude,
        longitude: user.longitude,
      }));
      setLocationSelected(true);
    }
  }, [user]);

  // Initialize checkout data
  React.useEffect(() => {
    if (directCheckout === 'true' && checkoutData) {
      try {
        const data = JSON.parse(checkoutData as string);
        setItems(data.items);
        setTotal(data.total);
      } catch (error) {
        console.error('Error parsing checkout data:', error);
        Alert.alert('Error', 'Invalid checkout data');
        router.back();
      }
    }
  }, [directCheckout, checkoutData]);

  // Handle location data from map picker - FIXED
  React.useEffect(() => {
    if (locationData) {
      try {
        const data = JSON.parse(locationData as string);
        console.log('Received location data:', data);
        
        setShippingInfo(prev => ({
          ...prev,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
        }));
        setLocationSelected(true);
      } catch (error) {
        console.error('Error parsing location data:', error);
        Alert.alert('Error', 'Failed to parse location data');
      }
    }
  }, [locationData]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Text style={{ fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', color: '#121516' }}>
          CHECKOUT
        </Text>
      ),
      headerTitleAlign: 'center',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackArrowIcon />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const validateForm = () => {
    if (!shippingInfo.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(shippingInfo.phone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return false;
    }

    if (!shippingInfo.address.trim()) {
      Alert.alert('Error', 'Please enter your delivery address');
      return false;
    }

    if (!locationSelected || !shippingInfo.latitude || !shippingInfo.longitude) {
      Alert.alert('Error', 'Please select your delivery address from the map to ensure accurate delivery');
      return false;
    }

    return true;
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);

      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              console.log('Current location:', { latitude, longitude });
              await reverseGeocode(latitude, longitude);
              setLocationLoading(false);
              Alert.alert('Success', 'Current location detected!');
            },
            (error) => {
              console.error('Geolocation error:', error);
              setLocationLoading(false);
              Alert.alert('Location Error', 'Failed to get current location. Please use map picker instead.');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        } else {
          setLocationLoading(false);
          Alert.alert('Error', 'Geolocation is not supported by this browser. Please use map picker.');
        }
      } else {
        // For React Native, you would use expo-location or react-native-geolocation-service
        Alert.alert('Info', 'Please use the map picker to select your location.');
        setLocationLoading(false);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location. Please use map picker.');
      setLocationLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyDBFyJk1ZsnnqxLC43WT_-OSCFZaG0OaNM`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        console.log('Reverse geocoded address:', address);
        
        setShippingInfo(prev => ({
          ...prev,
          address,
          latitude,
          longitude,
        }));
        setLocationSelected(true);
      } else {
        throw new Error('No address found for the coordinates');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      Alert.alert('Error', 'Failed to get address for the selected location');
    }
  };

  const openMapPicker = () => {
    router.push({
      pathname: '/map-picker',
      params: {
        returnTo: '/checkout',
        currentLatitude: shippingInfo.latitude?.toString() || '',
        currentLongitude: shippingInfo.longitude?.toString() || '',
        currentAddress: shippingInfo.address || '',
      },
    });
  };

  // NEW PAYMENT HANDLER USING BACKEND API
  const handlePayment = async () => {
    if (!validateForm()) return;

    console.log('Starting payment process with shipping info:', shippingInfo);

    setLoading(true);
    try {
      // Extract product information from your items
      const product = items[0]; // Assuming single product checkout for now
      const productId = product.id;
      const orderType = product.type === 'subscription' ? 'rental' : 'purchase';

      // Prepare user details from shipping form
      const userDetails = {
        name: shippingInfo.fullName,
        email: user?.email,
        address: shippingInfo.address,
        phone: shippingInfo.phone, // Clean number without +91
        latitude: shippingInfo.latitude,
        longitude: shippingInfo.longitude,
      };

      // Step 1: Create order on backend using apiService
      console.log('Creating order...');
      const createOrderPayload = {
        productId: productId,
        type: orderType,
        userDetails: userDetails,
      };

      const { order: createdOrder } = await apiService.post('orders', createOrderPayload);
      const orderId = createdOrder.id;
      console.log('Order created:', orderId);

      // Step 2: Initiate payment
      console.log('Initiating payment...');
      const { paymentInfo } = await apiService.post(`orders/${orderId}/payment`, {});
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
          email: paymentInfo.customerEmail || user?.email || 'customer@example.com',
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

      // Step 4: Process Razorpay payment (you'll need to implement this)
      console.log('Opening Razorpay checkout...');
      const paymentResult = await openRazorpayCheckout(razorpayOptions);

      // Step 5: Verify payment if successful
      if (paymentResult.razorpay_payment_id) {
        console.log('Payment completed, verifying...');
        
        const verifyPaymentData = {
          razorpayPaymentId: paymentResult.razorpay_payment_id,
          razorpayOrderId: paymentResult.razorpay_order_id,
          razorpaySignature: paymentResult.razorpay_signature,
        };

        const { success: isVerified } = await apiService.post(`orders/${orderId}/verify-payment`, verifyPaymentData);

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
              shippingInfo: JSON.stringify({
                fullName: shippingInfo.fullName,
                phone: `+91${shippingInfo.phone}`,
                address: shippingInfo.address,
              }),
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

  // Helper function to open Razorpay (you'll need to implement this based on your setup)
  const openRazorpayCheckout = async (options) => {
    // This should return a promise that resolves with payment result
    // Implementation depends on your Razorpay integration
    return new Promise((resolve, reject) => {
      // Your Razorpay implementation here
      // For now, returning mock data
      resolve({
        razorpay_payment_id: 'pay_mock_123',
        razorpay_order_id: options.order_id,
        razorpay_signature: 'mock_signature'
      });
    });
  };

  const deliveryFee = total > 500 ? 0 : 50;
  const finalTotal = total + deliveryFee;

  // Check if form is valid and location is selected
  const isFormValid = () => {
    return (
      shippingInfo.fullName.trim() &&
      /^[6-9]\d{9}$/.test(shippingInfo.phone) &&
      shippingInfo.address.trim() &&
      locationSelected &&
      shippingInfo.latitude &&
      shippingInfo.longitude
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Order Summary Card */}
          <View style={{
            margin: 16,
            backgroundColor: '#f8f9fa',
            borderRadius: 16,
            padding: 20,
          }}>
            <Text style={{
              fontSize: 20,
              fontFamily: 'SpaceGrotesk_700Bold',
              color: '#121516',
              marginBottom: 16,
            }}>
              Order Summary
            </Text>

            {items.map((item) => (
              <View key={item.id} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 16,
                    fontFamily: 'SpaceGrotesk_600SemiBold',
                    color: '#121516',
                  }}>
                    {item.name}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    fontFamily: 'SpaceGrotesk_400Regular',
                    color: '#687b82',
                    marginTop: 2,
                  }}>
                    {item.type === 'subscription' ? 'Monthly Rental' : 'One-time Purchase'} • Qty: {item.quantity}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 18,
                  fontFamily: 'SpaceGrotesk_700Bold',
                  color: '#121516',
                }}>
                  ₹{(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}

            <View style={{
              borderTopWidth: 1,
              borderTopColor: '#e1e5e7',
              marginTop: 16,
              paddingTop: 16,
            }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'SpaceGrotesk_400Regular',
                  color: '#687b82',
                }}>
                  Subtotal
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  color: '#121516',
                }}>
                  ₹{total.toLocaleString()}
                </Text>
              </View>

              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'SpaceGrotesk_400Regular',
                  color: '#687b82',
                }}>
                  Delivery Fee {total > 500 && '(Free above ₹500)'}
                </Text>
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  color: deliveryFee === 0 ? '#4fa3c4' : '#121516',
                }}>
                  {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
                </Text>
              </View>

              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#e1e5e7',
              }}>
                <Text style={{
                  fontSize: 20,
                  fontFamily: 'SpaceGrotesk_700Bold',
                  color: '#121516',
                }}>
                  Total
                </Text>
                <Text style={{
                  fontSize: 20,
                  fontFamily: 'SpaceGrotesk_700Bold',
                  color: '#4fa3c4',
                }}>
                  ₹{finalTotal.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Delivery Information */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={{
              fontSize: 20,
              fontFamily: 'SpaceGrotesk_700Bold',
              color: '#121516',
              marginBottom: 20,
            }}>
              Delivery Information
            </Text>

            {/* Full Name */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{
                fontSize: 14,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                color: '#121516',
                marginBottom: 6,
              }}>
                Full Name
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f8f9fa',
                borderRadius: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: '#e1e5e7',
                height: 40,
              }}>
                <User size={16} color="#687b82" />
                <TextInput
                  value={shippingInfo.fullName}
                  onChangeText={(text) => setShippingInfo(prev => ({ ...prev, fullName: text }))}
                  placeholder="Enter your full name"
                  placeholderTextColor="#687b82"
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    fontSize: 14,
                    fontFamily: 'SpaceGrotesk_400Regular',
                    color: '#121516',
                  }}
                />
              </View>
            </View>

            {/* Phone Number */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{
                fontSize: 14,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                color: '#121516',
                marginBottom: 6,
              }}>
                Phone Number
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f8f9fa',
                borderRadius: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: '#e1e5e7',
                height: 40,
              }}>
                <Phone size={16} color="#687b82" />
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  color: '#121516',
                  marginLeft: 8,
                  marginRight: 4,
                }}>
                  +91
                </Text>
                <TextInput
                  value={shippingInfo.phone}
                  onChangeText={(text) => setShippingInfo(prev => ({ ...prev, phone: text }))}
                  placeholder="Enter phone number"
                  placeholderTextColor="#687b82"
                  keyboardType="numeric"
                  maxLength={10}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontFamily: 'SpaceGrotesk_400Regular',
                    color: '#121516',
                  }}
                />
              </View>
            </View>

            {/* Address - Map Selection Required */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{
                fontSize: 14,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                color: '#121516',
                marginBottom: 6,
              }}>
                Delivery Address *
              </Text>

              <View style={{
                backgroundColor: '#f8f9fa',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: locationSelected ? '#4fa3c4' : '#ff6b6b',
                overflow: 'hidden',
              }}>
                {/* Address Display */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  minHeight: 50,
                }}>
                  <MapPin size={16} color="#687b82" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    {shippingInfo.address ? (
                      <>
                        <Text style={{
                          fontSize: 14,
                          fontFamily: 'SpaceGrotesk_400Regular',
                          color: '#121516',
                          lineHeight: 18,
                        }}>
                          {shippingInfo.address}
                        </Text>
                        {shippingInfo.latitude && shippingInfo.longitude && (
                          <Text style={{
                            fontSize: 11,
                            fontFamily: 'SpaceGrotesk_400Regular',
                            color: '#687b82',
                            marginTop: 4,
                          }}>
                            📍 {shippingInfo.latitude.toFixed(6)}, {shippingInfo.longitude.toFixed(6)}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text style={{
                        fontSize: 14,
                        fontFamily: 'SpaceGrotesk_400Regular',
                        color: '#ff6b6b',
                        fontStyle: 'italic',
                      }}>
                        Please select your delivery address on the map
                      </Text>
                    )}
                  </View>
                  {locationSelected && (
                    <View style={{
                      backgroundColor: '#e8f4f8',
                      borderRadius: 4,
                      padding: 2,
                      marginLeft: 6,
                      marginTop: 1,
                    }}>
                      <Check size={12} color="#4fa3c4" />
                    </View>
                  )}
                </View>

                {/* Location Action Buttons */}
                <View style={{
                  flexDirection: 'row',
                  borderTopWidth: 1,
                  borderTopColor: '#e1e5e7',
                }}>
                  <TouchableOpacity
                    onPress={getCurrentLocation}
                    disabled={locationLoading}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      backgroundColor: '#e8f4f8',
                    }}
                  >
                    {locationLoading ? (
                      <ActivityIndicator size="small" color="#4fa3c4" />
                    ) : (
                      <>
                        <Navigation size={14} color="#4fa3c4" />
                        <Text style={{
                          fontSize: 12,
                          fontFamily: 'SpaceGrotesk_600SemiBold',
                          color: '#4fa3c4',
                          marginLeft: 4,
                        }}>
                          Current Location
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={openMapPicker}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      backgroundColor: '#fff3e0',
                      borderLeftWidth: 1,
                      borderLeftColor: '#e1e5e7',
                    }}
                  >
                    <MapPin size={14} color="#ff9800" />
                    <Text style={{
                      fontSize: 12,
                      fontFamily: 'SpaceGrotesk_600SemiBold',
                      color: '#ff9800',
                      marginLeft: 4,
                    }}>
                      Select on Map
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Helper Text */}
              <Text style={{
                fontSize: 11,
                fontFamily: 'SpaceGrotesk_400Regular',
                color: locationSelected ? '#4fa3c4' : '#ff6b6b',
                marginTop: 6,
                textAlign: 'center',
              }}>
                {locationSelected 
                  ? '✅ Location confirmed for accurate delivery' 
                  : '⚠️ Map selection required for precise delivery location'
                }
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Payment Button */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#f1f3f4',
          paddingHorizontal: 16,
          paddingVertical: 16,
          paddingBottom: Platform.OS === 'ios' ? 34 : 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading || !isFormValid()}
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: loading || !isFormValid() ? '#e1e5e7' : '#4fa3c4',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#4fa3c4',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: loading || !isFormValid() ? 0 : 0.3,
              shadowRadius: 8,
              elevation: loading || !isFormValid() ? 0 : 8,
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator color="white" size="small" />
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'SpaceGrotesk_700Bold',
                  color: 'white',
                  marginLeft: 8,
                }}>
                  Processing...
                </Text>
              </>
            ) : (
              <>
                <CreditCard size={20} color="white" />
                <Text style={{
                  fontSize: 16,
                  fontFamily: 'SpaceGrotesk_700Bold',
                  color: 'white',
                  marginLeft: 8,
                }}>
                  {isFormValid() ? `Pay ₹${finalTotal.toLocaleString()}` : 'Complete Form First'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{
            fontSize: 10,
            fontFamily: 'SpaceGrotesk_400Regular',
            color: '#687b82',
            textAlign: 'center',
            marginTop: 4,
          }}>
            🔒 Secure payment powered by Razorpay
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Updated Map Picker Component with proper data passing
import React, { useState, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import BackArrowIcon from '@/components/icons/BackArrowIcon';

// For web compatibility, we'll create a simple map placeholder
const MapView = Platform.OS === 'web' ? 
  ({ children, onPress, style }: any) => (
    <View 
      style={[style, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}
      onTouchEnd={onPress}
    >
      <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', padding: 20 }}>
        Interactive Map{'\n'}Tap anywhere to select location
      </Text>
      {children}
    </View>
  ) : 
  require('react-native-maps').default;

const Marker = Platform.OS === 'web' ? 
  ({ coordinate }: any) => (
    <View style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -12 }, { translateY: -24 }],
      width: 24,
      height: 24,
      backgroundColor: '#ff0000',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'white',
    }} />
  ) : 
  require('react-native-maps').Marker;

export function MapPickerScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { returnTo, currentLatitude, currentLongitude, currentAddress } = useLocalSearchParams();
  
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number; longitude: number} | null>(
    currentLatitude && currentLongitude ? {
      latitude: parseFloat(currentLatitude as string),
      longitude: parseFloat(currentLongitude as string)
    } : null
  );
  const [address, setAddress] = useState(currentAddress as string || '');
  
  // Default map region (Bangalore)
  const [mapRegion, setMapRegion] = useState({
    latitude: currentLatitude ? parseFloat(currentLatitude as string) : 12.9716,
    longitude: currentLongitude ? parseFloat(currentLongitude as string) : 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Text style={{ fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', color: '#121516' }}>
          SELECT LOCATION
        </Text>
      ),
      headerTitleAlign: 'center',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <BackArrowIcon />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleMapPress = async (event: any) => {
    let latitude, longitude;
    
    if (Platform.OS === 'web') {
      // For web, simulate coordinates based on click position
      latitude = mapRegion.latitude + (Math.random() - 0.5) * 0.01;
      longitude = mapRegion.longitude + (Math.random() - 0.5) * 0.01;
    } else {
      const coords = event.nativeEvent.coordinate;
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
    
    setSelectedLocation({ latitude, longitude });
    
    // Reverse geocode to get address
    await reverseGeocode(latitude, longitude);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyDBFyJk1ZsnnqxLC43WT_-OSCFZaG0OaNM`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        setAddress(data.results[0].formatted_address);
      } else {
        setAddress(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setAddress(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    }
  };

  const confirmLocation = () => {
    if (selectedLocation && address) {
      // Pass location data back to checkout screen
      const locationData = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: address
      };
      
      // Navigate back with location data
      router.push({
        pathname: returnTo as string || '/checkout',
        params: {
          locationData: JSON.stringify(locationData)
        }
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Instructions */}
      <View style={{
        backgroundColor: '#e8f4f8',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e1e5e7',
      }}>
        <Text style={{
          fontSize: 16,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          color: '#4fa3c4',
          textAlign: 'center',
        }}>
          Tap on the map to select your delivery location
        </Text>
      </View>

      {/* Map */}
      <MapView
        style={{ flex: 1 }}
        region={mapRegion}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            pinColor="#ff0000"
          />
        )}
      </MapView>

      {/* Selected Location Info */}
      {selectedLocation && address && (
        <View style={{
          position: 'absolute',
          bottom: 100,
          left: 16,
          right: 16,
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 5,
        }}>
          <Text style={{
            fontSize: 16,
            fontFamily: 'SpaceGrotesk_700Bold',
            color: '#121516',
            marginBottom: 4,
          }}>
            📍 Selected Location
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: 'SpaceGrotesk_400Regular',
            color: '#687b82',
            lineHeight: 20,
          }}>
            {address}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={{
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#f1f3f4',
        paddingHorizontal: 16,
        paddingVertical: 20,
        flexDirection: 'row',
        gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            flex: 1,
            height: 48,
            backgroundColor: '#f1f3f4',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} color="#687b82" />
          <Text style={{
            fontSize: 16,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            color: '#687b82',
            marginLeft: 6,
          }}>
            Cancel
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={confirmLocation}
          disabled={!selectedLocation}
          style={{
            flex: 1,
            height: 48,
            backgroundColor: selectedLocation ? '#4fa3c4' : '#e1e5e7',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={20} color="white" />
          <Text style={{
            fontSize: 16,
            fontFamily: 'SpaceGrotesk_600SemiBold',
            color: 'white',
            marginLeft: 6,
          }}>
            Confirm
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Export the components
export { CheckoutScreen as default, MapPickerScreen };