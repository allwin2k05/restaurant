import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image
} from 'react-native';
import { db, connectDB } from '../lib/db';

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  number: string;
  price: number;
  categories: string[];
}

interface MenuScreenProps {
  cart: { item: MenuItem; quantity: number }[];
  addToCart: (item: MenuItem) => void;
  removeFromCart: (item: MenuItem) => void;
}

// Fallback high-quality food category illustrations
const CATEGORY_IMAGES: Record<string, string> = {
  'category:biryani': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=200&auto=format&fit=crop&q=60', // Biryani
  'category:starter': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200&auto=format&fit=crop&q=60', // Starters / Chicken kebabs
  'category:drinks': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=200&auto=format&fit=crop&q=60',  // Drinks
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=60'
};

export default function MenuScreen({ cart, addToCart, removeFromCart }: MenuScreenProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      await connectDB();
      try {
        const catRes = await db.query<[Category[]]>('SELECT id, name FROM category WHERE show_in_menu = true ORDER BY priority ASC');
        const itemRes = await db.query<[MenuItem[]]>('SELECT id, name, number, price, categories FROM menu_item ORDER BY priority ASC');
        
        const cats = catRes[0] || [];
        const items = itemRes[0] || [];
        
        setCategories(cats);
        setMenuItems(items);
        if (cats.length > 0) {
          setSelectedCategory(cats[0].id);
        }
      } catch (err) {
        console.error('Failed to load menu data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getCartQuantity = (itemId: string) => {
    const cartItem = cart.find(c => c.item.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory ? item.categories.includes(selectedCategory) : true;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e4c590" />
        <Text style={styles.loadingText}>Loading Sai Silver Menu...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sai Silver Biryani</Text>
        <Text style={styles.headerSubtitle}>Authentic Dining & Ordering</Text>
      </View>

      {/* Search Input */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search for biryani, starter, drinks..."
        placeholderTextColor="#a6a6a6"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Category Selectors */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === item.id && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item.id && styles.categoryTextActive
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Menu Items List */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const qty = getCartQuantity(item.id);
          const imageUrl = CATEGORY_IMAGES[selectedCategory || ''] || CATEGORY_IMAGES['default'];
          return (
            <View style={styles.menuItemCard}>
              <Image source={{ uri: imageUrl }} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemNumber}>{item.number}</Text>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
              
              {/* Add/Remove Cart Controls */}
              <View style={styles.controls}>
                {qty > 0 ? (
                  <View style={styles.quantityWrapper}>
                    <TouchableOpacity style={styles.controlButton} onPress={() => removeFromCart(item)}>
                      <Text style={styles.controlButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{qty}</Text>
                    <TouchableOpacity style={styles.controlButton} onPress={() => addToCart(item)}>
                      <Text style={styles.controlButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                    <Text style={styles.addButtonText}>ADD</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.menuList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found matching your search.</Text>
          </View>
        }
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
  searchBar: {
    backgroundColor: '#161718',
    color: '#fff',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff1a',
    fontSize: 14,
  },
  categoriesWrapper: {
    paddingVertical: 12,
  },
  categoriesList: {
    paddingHorizontal: 15,
  },
  categoryButton: {
    backgroundColor: '#1b1c1d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: '#0e0d0c',
    borderColor: '#e4c590',
  },
  categoryText: {
    color: '#a6a6a6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryTextActive: {
    color: '#e4c590',
  },
  menuList: {
    paddingHorizontal: 15,
    paddingBottom: 80,
  },
  menuItemCard: {
    backgroundColor: '#121111',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff1a',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1b1c1d',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemNumber: {
    color: '#e4c590',
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  itemPrice: {
    color: '#a6a6a6',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  controls: {
    marginLeft: 10,
  },
  addButton: {
    backgroundColor: '#e4c590',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: '#0e0d0c',
    fontWeight: 'bold',
    fontSize: 13,
  },
  quantityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1c1d',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e4c590',
  },
  controlButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  controlButtonText: {
    color: '#e4c590',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#a6a6a6',
    fontSize: 14,
  }
});
