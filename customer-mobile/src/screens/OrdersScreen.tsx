import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { db, connectDB } from '../lib/db';

interface OrderItemInfo {
  name: string;
  quantity: number;
}

interface OrderInfo {
  id: string;
  invoice_number: number;
  status: string;
  created_at: string;
  tax_amount: number;
  items: any[]; // holds order_item details
  totalAmount: number;
  itemsCount: number;
  itemDetailsText: string;
}

interface OrdersScreenProps {
  placedOrderIds: string[];
}

export default function OrdersScreen({ placedOrderIds }: OrdersScreenProps) {
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrdersStatus = async () => {
    if (placedOrderIds.length === 0) {
      setOrders([]);
      return;
    }

    await connectDB();
    try {
      // Fetch details for all placed orders
      // In SurrealDB, we can query by ID directly:
      const queryStr = `SELECT * FROM order WHERE id IN $ids ORDER BY created_at DESC;`;
      const res = await db.query<[any[]]>(queryStr, { ids: placedOrderIds });
      const ordersData = res[0] || [];

      const resolvedOrders: OrderInfo[] = [];

      for (const order of ordersData) {
        // Fetch detailed items in the order
        // Fetch order_item details linked
        const itemIds = order.items || [];
        let itemsText = 'Loading items...';
        let total = 0;
        let qty = 0;

        if (itemIds.length > 0) {
          const itemRes = await db.query<[any[]]>(`SELECT price, quantity, item.name as name FROM order_item WHERE id IN $item_ids`, { item_ids: itemIds });
          const itemsList = itemRes[0] || [];
          
          total = itemsList.reduce((sum, it) => sum + (it.price * it.quantity), 0) + (order.tax_amount || 0);
          qty = itemsList.reduce((sum, it) => sum + it.quantity, 0);
          itemsText = itemsList.map(it => `${it.quantity}x ${it.name || 'Dish'}`).join(', ');
        }

        resolvedOrders.push({
          id: order.id,
          invoice_number: order.invoice_number || 0,
          status: order.status || 'Pending',
          created_at: order.created_at,
          tax_amount: order.tax_amount || 0,
          items: order.items || [],
          totalAmount: total,
          itemsCount: qty,
          itemDetailsText: itemsText
        });
      }

      setOrders(resolvedOrders);
    } catch (err) {
      console.error('Failed to fetch orders status:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchOrdersStatus().finally(() => setLoading(false));
  }, [placedOrderIds]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrdersStatus();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
      case 'pending':
        return '#a6a6a6'; // grey
      case 'in progress':
      case 'cooking':
        return '#e4c590'; // gold/amber
      case 'ready':
      case 'completed':
      case 'paid':
        return '#4caf50'; // green
      case 'cancelled':
        return '#f44336'; // red
      default:
        return '#e4c590';
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  if (placedOrderIds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No orders tracked yet.</Text>
        <Text style={styles.emptySubtext}>Any orders you place from this device will show up here.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e4c590" />
        <Text style={styles.loadingText}>Fetching order status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSubtitle}>Real-time status from the kitchen</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchOrdersStatus}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e4c590"
            title="Checking status..."
            titleColor="#e4c590"
          />
        }
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.invoiceNumber}>Order #{item.invoice_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '22', borderColor: getStatusColor(item.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            
            <Text style={styles.itemDetails}>{item.itemDetailsText}</Text>
            
            <View style={styles.cardFooter}>
              <Text style={styles.timeText}>Placed at {formatTime(item.created_at)}</Text>
              <Text style={styles.amountText}>Total: ₹{item.totalAmount}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0d0c',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0e0d0c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#e4c590',
    marginTop: 15,
    fontSize: 16,
    fontWeight: 'bold',
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
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff1a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  refreshButton: {
    backgroundColor: '#1b1c1d',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  refreshButtonText: {
    color: '#e4c590',
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 80,
  },
  orderCard: {
    backgroundColor: '#121111',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff1a',
    paddingBottom: 8,
  },
  invoiceNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemDetails: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: '#a6a6a6',
    fontSize: 12,
  },
  amountText: {
    color: '#e4c590',
    fontSize: 15,
    fontWeight: 'bold',
  }
});
