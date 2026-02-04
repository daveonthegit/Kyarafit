import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';

interface ClosetItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  tags: string[];
}

const CATEGORIES = ['All Items', 'Wigs', 'Props', 'Materials'];

export default function ClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All Items');

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetch(`${apiUrl}/closet/items`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const renderItem = ({ item }: { item: ClosetItem }) => (
    <View style={styles.gridItem}>
      <View style={styles.gridImageContainer}>
        <Image source={{ uri: item.imageUrl }} style={styles.gridImage} resizeMode="cover" />
      </View>
      <View style={styles.gridInfo}>
        <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.gridPrice}>$45.00</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.black} />
          </Pressable>
          <Text style={styles.metaLabel}>Builds / Closet</Text>
        </View>
        <View style={styles.headerBottom}>
          <Text style={styles.title}>The Closet</Text>
          <Pressable>
            <Ionicons name="search-outline" size={24} color={colors.black} />
          </Pressable>
        </View>
      </View>

      {/* Category Nav */}
      <View style={styles.categoryNavContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.categoryNavContent}
        >
          {CATEGORIES.map((cat) => (
            <Pressable key={cat} onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.categoryTab, activeCategory === cat && styles.categoryTabActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Grid */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : (
            <Text style={styles.emptyText}>No items yet.</Text>
          )
        }
      />

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push('/add-item')}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 48, 
    paddingBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f9f9f9',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  headerTop: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    marginBottom: 16 
  },
  metaLabel: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.5)' 
  },
  headerBottom: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end' 
  },
  title: { 
    fontFamily: font.serif, 
    fontSize: 28, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -0.5,
  },
  categoryNavContainer: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#f9f9f9',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  categoryNavContent: { 
    paddingHorizontal: 24, 
    paddingVertical: 16, 
    gap: 32 
  },
  categoryTab: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: 'rgba(0,0,0,0.4)' 
  },
  categoryTabActive: { 
    fontWeight: '600', 
    color: colors.black, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.black, 
    paddingBottom: 4 
  },
  gridContent: { padding: 16, paddingBottom: 100 },
  gridRow: { gap: 12 },
  gridItem: { flex: 1, marginBottom: 16 },
  gridImageContainer: { 
    aspectRatio: 1, 
    backgroundColor: '#f9f9f9', 
    marginBottom: 8 
  },
  gridImage: { width: '100%', height: '100%' },
  gridInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  gridName: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    fontWeight: '600', 
    color: colors.black, 
    flex: 1,
    marginRight: 8,
  },
  gridPrice: { fontSize: 9, color: 'rgba(0,0,0,0.4)' },
  emptyText: { 
    fontSize: 12, 
    color: 'rgba(0,0,0,0.5)', 
    textAlign: 'center', 
    padding: 32 
  },
  fab: { 
    position: 'absolute', 
    bottom: 32, 
    right: 24, 
    width: 56, 
    height: 56, 
    backgroundColor: colors.black, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
});
