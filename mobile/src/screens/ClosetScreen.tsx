import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../lib/auth/client';
import { piecesAPI, Piece } from '../lib/api/pieces';
import AddPieceScreen from './AddPieceScreen';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

// Piece interface is now imported from the API module

export default function ClosetScreen() {
  const { data: session } = useSession();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [filteredPieces, setFilteredPieces] = useState<Piece[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [showPieceModal, setShowPieceModal] = useState(false);
  const [showAddPiece, setShowAddPiece] = useState(false);

  const categories = [
    { id: 'all', name: 'All', icon: 'grid-outline' },
    { id: 'wig', name: 'Wig', icon: 'person-outline' },
    { id: 'dress', name: 'Dress', icon: 'shirt-outline' },
    { id: 'prop', name: 'Prop', icon: 'star-outline' },
    { id: 'shoes', name: 'Shoes', icon: 'walk-outline' },
    { id: 'accessory', name: 'Accessory', icon: 'diamond-outline' },
    { id: 'makeup', name: 'Makeup', icon: 'color-palette-outline' },
    { id: 'other', name: 'Other', icon: 'ellipsis-horizontal-outline' },
  ];

  // Mock data for now - replace with actual API call
  const mockPieces: Piece[] = [
    {
      id: '1',
      name: 'Pink Anime Wig',
      description: 'Beautiful long pink wig for anime cosplay',
      image_url: 'https://via.placeholder.com/300x300/f8b4d1/ffffff?text=Pink+Wig',
      category: 'wig',
      tags: ['anime', 'pink', 'long'],
      price: 45.99,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      name: 'School Uniform Dress',
      description: 'Classic Japanese school uniform',
      image_url: 'https://via.placeholder.com/300x300/fce7f3/ec4899?text=School+Dress',
      category: 'dress',
      tags: ['school', 'uniform', 'blue'],
      price: 89.99,
      created_at: '2024-01-14T15:20:00Z',
      updated_at: '2024-01-14T15:20:00Z',
    },
    {
      id: '3',
      name: 'Magic Wand Prop',
      description: 'Sparkly magic wand for magical girl cosplay',
      image_url: 'https://via.placeholder.com/300x300/e0e7ff/8b5cf6?text=Magic+Wand',
      category: 'prop',
      tags: ['magic', 'sparkly', 'wand'],
      price: 25.50,
      created_at: '2024-01-13T09:15:00Z',
      updated_at: '2024-01-13T09:15:00Z',
    },
  ];

  const loadPieces = useCallback(async () => {
    if (!session?.token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Use actual API call
      const response = await piecesAPI.getPieces(session.token, {
        limit: 50,
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
      });
      
      setPieces(response.pieces);
      setFilteredPieces(response.pieces);
    } catch (error) {
      console.error('Error loading pieces:', error);
      // Fallback to mock data for development
      setPieces(mockPieces);
      setFilteredPieces(mockPieces);
    } finally {
      setLoading(false);
    }
  }, [session, searchQuery, selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPieces();
    setRefreshing(false);
  }, [loadPieces]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  // Filtering is now handled by the API, so we just set filtered pieces to pieces
  useEffect(() => {
    setFilteredPieces(pieces);
  }, [pieces]);

  const handlePiecePress = (piece: Piece) => {
    setSelectedPiece(piece);
    setShowPieceModal(true);
  };

  const handleAddPiece = () => {
    setShowAddPiece(true);
  };

  const handlePieceAdded = (newPiece: Piece) => {
    setPieces(prev => [newPiece, ...prev]);
    setFilteredPieces(prev => [newPiece, ...prev]);
  };

  const renderPieceCard = ({ item }: { item: Piece }) => (
    <TouchableOpacity
      style={styles.pieceCard}
      onPress={() => handlePiecePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.pieceImageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.pieceImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="shirt-outline" size={32} color="#f8b4d1" />
          </View>
        )}
        {item.price && (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>${item.price.toFixed(2)}</Text>
          </View>
        )}
      </View>
      <View style={styles.pieceInfo}>
        <Text style={styles.pieceName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.tags.length > 2 && (
              <Text style={styles.moreTagsText}>+{item.tags.length - 2}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="shirt-outline" size={64} color="#f8b4d1" />
      </View>
      <Text style={styles.emptyTitle}>No items yet</Text>
      <Text style={styles.emptySubtitle}>
        Start building your cosplay wardrobe by adding your first costume piece
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={handleAddPiece}>
        <Ionicons name="add" size={20} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.primaryButtonText}>Add First Item</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>My Closet</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPiece}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your closet..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter" size={20} color="#ec4899" />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(category.id === 'all' ? null : category.id)}
            >
              <Ionicons
                name={category.icon as any}
                size={16}
                color={selectedCategory === category.id ? '#fff' : '#ec4899'}
              />
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === category.id && styles.categoryButtonTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={styles.loadingText}>Loading your closet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {filteredPieces.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredPieces}
          renderItem={renderPieceCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#ec4899']}
              tintColor="#ec4899"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Piece Detail Modal */}
      <Modal
        visible={showPieceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPieceModal(false)}
      >
        {selectedPiece && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPieceModal(false)}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {selectedPiece.image_url && (
                <Image source={{ uri: selectedPiece.image_url }} style={styles.modalImage} />
              )}
              
              <View style={styles.modalInfo}>
                <Text style={styles.modalTitle}>{selectedPiece.name}</Text>
                
                {selectedPiece.description && (
                  <Text style={styles.modalDescription}>{selectedPiece.description}</Text>
                )}
                
                <View style={styles.modalDetails}>
                  {selectedPiece.category && (
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Category</Text>
                      <Text style={styles.modalDetailValue}>{selectedPiece.category}</Text>
                    </View>
                  )}
                  
                  {selectedPiece.price && (
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Price</Text>
                      <Text style={styles.modalDetailValue}>${selectedPiece.price.toFixed(2)}</Text>
                    </View>
                  )}
                  
                  {selectedPiece.tags && selectedPiece.tags.length > 0 && (
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Tags</Text>
                      <View style={styles.modalTagsContainer}>
                        {selectedPiece.tags.map((tag, index) => (
                          <View key={index} style={styles.modalTag}>
                            <Text style={styles.modalTagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Add Piece Modal */}
      <Modal
        visible={showAddPiece}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddPiece(false)}
      >
        <AddPieceScreen
          onClose={() => setShowAddPiece(false)}
          onPieceAdded={handlePieceAdded}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fefefe', // Sakura bg-primary
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fefefe',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ffffff', // Sakura bg-secondary
    borderBottomWidth: 1,
    borderBottomColor: '#fce7f3', // Sakura border-light
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d1b2e', // Sakura text-primary
  },
  addButton: {
    backgroundColor: '#ec4899', // Sakura deep-pink
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8', // Sakura bg-tertiary
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#f8b4d1', // Sakura border-medium
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2d1b2e',
    paddingVertical: 4,
  },
  filterButton: {
    backgroundColor: '#fdf2f8',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f8b4d1',
  },
  categoriesContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  categoriesContent: {
    paddingRight: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f8b4d1',
  },
  categoryButtonActive: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  categoryButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#ec4899',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pieceCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  pieceImageContainer: {
    position: 'relative',
    height: CARD_WIDTH * 0.8,
  },
  pieceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fdf2f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ec4899',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  pieceInfo: {
    padding: 12,
  },
  pieceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d1b2e',
    marginBottom: 8,
    lineHeight: 20,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8b4d1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#fce7f3',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#ec4899',
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fdf2f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d1b2e',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#ec4899',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fce7f3',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  modalInfo: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d1b2e',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalDetails: {
    gap: 16,
  },
  modalDetailItem: {
    marginBottom: 16,
  },
  modalDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalDetailValue: {
    fontSize: 16,
    color: '#2d1b2e',
  },
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTag: {
    backgroundColor: '#f8b4d1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalTagText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
});
