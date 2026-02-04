import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';
import type { ClosetItem } from '@kyarafit/design-system/types';
import { listItems } from '../src/storage/closetRepo';
import { getSyncPendingCount } from '../src/services/sync';

const CATEGORIES = ['All Items', 'Wig', 'Prop', 'Armor', 'Garment', 'Shoe', 'Material', 'Other'];

export default function ClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [syncPending, setSyncPending] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, pending] = await Promise.all([listItems(), getSyncPendingCount()]);
    setItems(list);
    setSyncPending(pending);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered =
    activeCategory === 'All Items'
      ? items
      : items.filter((i) => i.category.toLowerCase() === activeCategory.toLowerCase());

  const renderItem = ({ item }: { item: ClosetItem }) => (
    <View style={styles.gridItem}>
      <View style={styles.gridImageContainer}>
        {item.imageLocalUri || item.imageUrl ? (
          <Image
            source={{ uri: item.imageLocalUri || item.imageUrl || undefined }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={32} color="rgba(0,0,0,0.2)" />
          </View>
        )}
      </View>
      <View style={styles.gridInfo}>
        <Text style={styles.gridName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.gridMeta}>{item.category}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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
        {syncPending > 0 && (
          <Text style={styles.syncLabel}>SYNC PENDING — WILL SYNC WHEN ONLINE</Text>
        )}
      </View>

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

      <FlatList
        data={filtered}
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
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: 'rgba(0,0,0,0.5)',
  },
  headerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: font.family.serifDisplay,
    fontSize: 28,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: colors.black,
    letterSpacing: -0.5,
  },
  syncLabel: {
    marginTop: 8,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: 'rgba(0,0,0,0.5)',
  },
  categoryNavContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  categoryNavContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 32,
  },
  categoryTab: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(0,0,0,0.4)',
  },
  categoryTabActive: {
    fontWeight: '600',
    color: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
    paddingBottom: 4,
  },
  gridContent: { padding: 16, paddingBottom: 100 },
  gridRow: { gap: 12 },
  gridItem: { flex: 1, marginBottom: 16 },
  gridImageContainer: {
    aspectRatio: 1,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  gridMeta: {
    fontSize: 9,
    color: 'rgba(0,0,0,0.4)',
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    textAlign: 'center',
    padding: 32,
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
