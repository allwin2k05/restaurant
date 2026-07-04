import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { db, connectDB } from '../lib/db';

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

interface CartScreenProps {
  cart: CartItem[];
  clearCart: () => void;
  onOrderPlaced: (orderId: string) => void;
}

export default function CartScreen({ cart, clearCart, onOrderPlaced }: CartScreenProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [table, setTable] = useState('Table 1'); // Defaults to Table 1
  const [loading, setLoading] = useState(false);

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.item.price * item.quantity, 0);
  };

  const calculateTax = () => {
    return Math.round(calculateSubtotal() * 0.05); // 5% GST
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart first.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Details Missing', 'Please enter your name.');
      return;
    }

    if (!phone.trim() || phone.length < 10) {
      Alert.alert('Details Missing', 'Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    await connectDB();

    try {
      // 1. Create customer record
      console.log('Creating customer record...');
      const [customer] = await db.create('customer', {
        name: name,
        phone: phone,
        address: 'Dine-in Customer'
      });

      // 2. Create order items
      console.log('Creating order items...');
      const itemRecordIds: string[] = [];
      for (const cartItem of cart) {
        const [orderItem] = await db.create('order_item', {
          item: cartItem.item.id,
          price: cartItem.item.price,
          quantity: cartItem.quantity,
          created_at: new Date().toISOString()
        });
        itemRecordIds.push(orderItem.id);
      }

      // 3. Create the main Dine-In Order
      const randomInvoice = Math.floor(1000 + Math.random() * 9000);
      const orderData = {
        customer: customer.id,
        covers: 1,
        tags: ["Mobile Dine-In", "Dine-In"],
        order_type: "order_type:dinein",
        status: "New",
        invoice_number: randomInvoice,
        auto_id: randomInvoice,
        items: itemRecordIds,
        floor: "floor:main",
        table: "floor_table:table1", // Maps to Table 1
        user: "user:customer_9999", // Customer user role
        tax_amount: calculateTax(),
        discount_amount: 0,
        service_charge_amount: 0,
        created_at: new Date().toISOString()
      };

      console.log('Creating main order...');
      const [order] = await db.create('order', orderData);
      
      console.log('Order placed successfully:', order.id);
      Alert.alert('Order Placed!', `Your order has been sent to the kitchen. Invoice: #${randomInvoice}`);
      
      // Notify parent app (which triggers navigation shift & saves order ID)
      onOrderPlaced(order.id);
      
      // Reset cart and fields
      clearCart();
      setName('');
      setPhone('');
    } catch (err: any) {
      console.error('Error placing order:', err);
      Alert.alert('Order Failed', 'Failed to place order: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const total = calculateTotal();

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Your cart is empty.</Text>
        <Text style={styles.emptySubtext}>Go to the Menu tab to add dishes!</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
          <Text style={styles.headerSubtitle}>Verify items and place your order</Text>
        </View>

        {/* Selected Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Items</Text>
          {cart.map((cartItem) => (
            <View key={cartItem.item.id} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{cartItem.quantity}x</Text>
              <Text style={styles.itemName}>{cartItem.item.name}</Text>
              <Text style={styles.itemPrice}>₹{cartItem.item.price * cartItem.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Customer Details Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Full Name"
            placeholderTextColor="#a6a6a6"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number (10 digits)"
            placeholderTextColor="#a6a6a6"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          {/* Simple Table Selector */}
          <Text style={styles.label}>Select Table Number</Text>
          <View style={styles.tableSelector}>
            {['Table 1', 'Table 2', 'Table 3', 'Table 4'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tableButton, table === t && styles.tableButtonActive]}
                onPress={() => setTable(t)}
              >
                <Text style={[styles.tableText, table === t && styles.tableTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Invoice Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₹{subtotal}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>GST (5%)</Text>
            <Text style={styles.summaryValue}>₹{tax}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{total}</Text>
          </View>
        </View>

        {/* Place Order Button */}
        {loading ? (
          <ActivityIndicator size="large" color="#e4c590" style={styles.loader} />
        ) : (
          <TouchableOpacity style={styles.placeOrderButton} onPress={handlePlaceOrder}>
            <Text style={styles.placeOrderButtonText}>PLACE ORDER (₹{total})</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0d0c',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0e0d0c',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#e4c590',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#a6a6a6',
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff1a',
  },
  headerTitle: {
    color: '#e4c590',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'sans-serif-condensed',
  },
  headerSubtitle: {
    color: '#a6a6a6',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    backgroundColor: '#121111',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  sectionTitle: {
    color: '#e4c590',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff1a',
    paddingBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  itemQuantity: {
    color: '#e4c590',
    fontSize: 14,
    fontWeight: 'bold',
    width: 30,
  },
  itemName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  itemPrice: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1b1c1d',
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff1a',
    fontSize: 14,
    marginBottom: 10,
  },
  label: {
    color: '#a6a6a6',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 8,
  },
  tableSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableButton: {
    backgroundColor: '#1b1c1d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  tableButtonActive: {
    borderColor: '#e4c590',
    backgroundColor: '#0e0d0c',
  },
  tableText: {
    color: '#a6a6a6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tableTextActive: {
    color: '#e4c590',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    color: '#a6a6a6',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: {
    color: '#e4c590',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#e4c590',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeOrderButton: {
    backgroundColor: '#e4c590',
    marginHorizontal: 15,
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  placeOrderButtonText: {
    color: '#0e0d0c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 25,
  }
});
