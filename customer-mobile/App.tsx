import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import MenuScreen from './src/screens/MenuScreen';
import CartScreen from './src/screens/CartScreen';
import OrdersScreen from './src/screens/OrdersScreen';

interface MenuItem {
  id: string;
  name: string;
  number: string;
  price: number;
  categories: string[];
}

interface CartItem {
  item: MenuItem;
  quantity: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'orders'>('menu');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [placedOrderIds, setPlacedOrderIds] = useState<string[]>([]);

  const addToCart = (item: MenuItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((c) => c.item.id === item.id);
      if (existingItem) {
        return prevCart.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prevCart, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (item: MenuItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((c) => c.item.id === item.id);
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prevCart.filter((c) => c.item.id !== item.id);
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleOrderPlaced = (orderId: string) => {
    setPlacedOrderIds((prevIds) => [orderId, ...prevIds]);
    setActiveTab('orders'); // Auto-navigate to orders tab to track status
  };

  const getCartItemsCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'menu':
        return (
          <MenuScreen
            cart={cart}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
          />
        );
      case 'cart':
        return (
          <CartScreen
            cart={cart}
            clearCart={clearCart}
            onOrderPlaced={handleOrderPlaced}
          />
        );
      case 'orders':
        return <OrdersScreen placedOrderIds={placedOrderIds} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0d0c" />
      <View style={styles.container}>
        
        {/* Main Screen Content */}
        <View style={styles.content}>
          {renderActiveScreen()}
        </View>

        {/* Bottom Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'menu' && styles.tabItemActive]}
            onPress={() => setActiveTab('menu')}
          >
            <Text style={[styles.tabIcon, activeTab === 'menu' && styles.tabIconActive]}>📖</Text>
            <Text style={[styles.tabLabel, activeTab === 'menu' && styles.tabLabelActive]}>Menu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'cart' && styles.tabItemActive]}
            onPress={() => setActiveTab('cart')}
          >
            <View style={styles.cartIconWrapper}>
              <Text style={[styles.tabIcon, activeTab === 'cart' && styles.tabIconActive]}>🛒</Text>
              {getCartItemsCount() > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{getCartItemsCount()}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, activeTab === 'cart' && styles.tabLabelActive]}>Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'orders' && styles.tabItemActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Text style={[styles.tabIcon, activeTab === 'orders' && styles.tabIconActive]}>⏳</Text>
            <Text style={[styles.tabLabel, activeTab === 'orders' && styles.tabLabelActive]}>Tracking</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e0d0c',
  },
  container: {
    flex: 1,
    backgroundColor: '#0e0d0c',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: '#121111',
    borderTopWidth: 1,
    borderTopColor: '#ffffff1a',
    alignItems: 'center',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  tabItemActive: {
    backgroundColor: '#1b1c1d',
  },
  tabIcon: {
    fontSize: 20,
    color: '#a6a6a6',
  },
  tabIconActive: {
    color: '#e4c590',
  },
  tabLabel: {
    fontSize: 11,
    color: '#a6a6a6',
    marginTop: 4,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#e4c590',
  },
  cartIconWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#e4c590',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#0e0d0c',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
