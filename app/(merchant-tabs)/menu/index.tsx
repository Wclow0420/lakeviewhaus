import { CategoryManagerModal } from '@/components/modals/merchant/CategoryManagerModal';
import { CollectionFormModal } from '@/components/modals/merchant/CollectionFormModal';
import { CreateCategoryModal } from '@/components/modals/merchant/CreateCategoryModal';
import { ProductFormModal } from '@/components/modals/merchant/ProductFormModal';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { ProductBadge } from '@/components/ui/ProductBadge';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

// Interfaces (Matches Backend)
interface Branch { id: number; name: string; is_main: boolean; }
interface Category { id: number; name: string; }
interface Product {
    id: number;
    name: string;
    price: number;
    category_id: number;
    image_url?: string;
    is_active: boolean;
    is_recommended?: boolean;
    is_new?: boolean;
    options?: any[];
}

export default function MerchantMenuScreen() {
    const { user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // State
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

    // View State
    const [activeTab, setActiveTab] = useState<'items' | 'collections'>('items');

    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');

    const [products, setProducts] = useState<Product[]>([]);
    const [collections, setCollections] = useState<any[]>([]);

    // Edit State
    const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [editingCollection, setEditingCollection] = useState<any | undefined>(undefined);

    // Modal States
    const [showCatModal, setShowCatModal] = useState(false);
    const [showCatManagerModal, setShowCatManagerModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCollectionModal, setShowCollectionModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedBranchId) {
            fetchMenuData(selectedBranchId);
        }
    }, [selectedBranchId]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            if (user?.is_main) {
                const branchData = await api.merchant.getBranches();
                setBranches(branchData);
                const self = branchData.find((b: Branch) => b.is_main);
                setSelectedBranchId(self ? self.id : branchData[0].id);
            } else {
                fetchMenuData();
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!user?.is_main) setLoading(false);
        }
    };

    const fetchMenuData = async (branchId?: number) => {
        if (!refreshing) setLoading(true);
        try {
            const [cats, prods, colls] = await Promise.all([
                api.menu.getCategories(branchId),
                api.menu.getProducts(branchId),
                api.menu.getCollections(branchId)
            ]);
            setCategories(cats);
            setProducts(prods);
            setCollections(colls);
        } catch (error) {
            Alert.alert("Error", "Failed to load menu data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchMenuData(selectedBranchId || undefined);
    };

    const handleCreateCategory = async (data: { name: string; image_url?: string }) => {
        setActionLoading(true);
        try {
            const body: any = { ...data, sort_order: categories.length };
            if (user?.is_main && selectedBranchId) {
                body.branch_id = selectedBranchId;
            }

            const newCat = await api.menu.createCategory(body);
            setCategories([...categories, newCat]);
            setShowCatModal(false);
            // Reopen manager modal after brief delay
            setTimeout(() => setShowCatManagerModal(true), 300);
        } catch (error) {
            Alert.alert("Error", "Failed to create category");
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateCategory = async (id: number, data: { name: string; image_url?: string }) => {
        setActionLoading(true);
        try {
            const updatedCat = await api.menu.updateCategory(id, data);
            setCategories(prev => prev.map(c => c.id === id ? updatedCat : c));
            setShowCatModal(false);
            setEditingCategory(undefined);
            // Reopen manager modal after brief delay
            setTimeout(() => setShowCatManagerModal(true), 300);
        } catch (error) {
            Alert.alert("Error", "Failed to update category");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteCategory = async (id: number) => {
        setActionLoading(true);
        try {
            await api.menu.deleteCategory(id);
            setCategories(prev => prev.filter(c => c.id !== id));
            setShowCatModal(false);
            setEditingCategory(undefined);
            if (selectedCategory !== 'ALL' && selectedCategory.id === id) {
                setSelectedCategory('ALL');
            }
            // Keep manager modal open after delete
        } catch (error: any) {
            Alert.alert("Error", error.error || "Failed to delete category");
        } finally {
            setActionLoading(false);
        }
    };

    // Product Submit Handler (Create or Edit)
    const handleProductSubmit = async (data: any) => {
        if (user?.is_main && selectedBranchId) {
            data.branch_id = selectedBranchId;
        }

        try {
            if (editingProduct) {
                // Edit
                await api.menu.updateProduct(editingProduct.id, data);
            } else {
                // Create
                await api.menu.createProduct(data);
            }
            // Refresh logic to ensure Shared Options are synced across all products
            fetchMenuData(selectedBranchId || undefined);

            setShowProductModal(false);
            setEditingProduct(undefined);
        } catch (error) {
            Alert.alert("Error", "Failed to save product");
        }
    };

    // Collection Submit Handler (Create or Edit)
    const handleCollectionSubmit = async (data: any) => {
        const payload: any = {
            name: data.name,
            description: data.description,
            product_ids: data.product_ids
        };

        if (user?.is_main) {
            if (data.is_global) {
                payload.branch_id = null;
            } else if (selectedBranchId) {
                payload.branch_id = selectedBranchId;
            }
        }

        try {
            if (editingCollection) {
                await api.menu.updateCollection(editingCollection.id, payload);
            } else {
                await api.menu.createCollection(payload);
            }
            // Refresh as collections logic is complex locally
            fetchMenuData(selectedBranchId || undefined);
            setShowCollectionModal(false);
            setEditingCollection(undefined);
        } catch (error) {
            Alert.alert("Error", "Failed to save collection");
        }
    };

    const handleToggleProduct = async (id: number, currentStatus: boolean) => {
        // Haptic feedback on toggle
        Haptics.selectionAsync();

        setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
        try {
            await api.menu.updateProduct(id, { is_active: !currentStatus });
            // Light success haptic on successful update
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Update failed");
            fetchMenuData(selectedBranchId || undefined);
        }
    };

    const getFilteredProducts = () => {
        let filtered = products;
        if (selectedCategory !== 'ALL') {
            filtered = products.filter(p => p.category_id === selectedCategory.id);
        }

        // Sort: Promoted (New/Rec) first, then Alphabetical
        return [...filtered].sort((a, b) => {
            const aPromoted = (a.is_new || a.is_recommended) ? 1 : 0;
            const bPromoted = (b.is_new || b.is_recommended) ? 1 : 0;

            if (aPromoted !== bPromoted) return bPromoted - aPromoted;

            return a.name.localeCompare(b.name);
        });
    };

    // --- Actions ---
    const openCreateProduct = () => {
        setEditingProduct(undefined);
        setShowProductModal(true);
    };

    const openEditProduct = (prod: Product) => {
        setEditingProduct(prod);
        setShowProductModal(true);
    };

    const openCreateCollection = () => {
        setEditingCollection(undefined);
        setShowCollectionModal(true);
    };

    const openEditCollection = (coll: any) => {
        setEditingCollection(coll);
        setShowCollectionModal(true);
    };

    const renderHeader = () => (
        <View>
            <View style={styles.header}>
                <Text style={[styles.pageTitle, { color: theme.text }]}>Menu</Text>
                <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: theme.primary }]}
                    onPress={() => activeTab === 'items' ? openCreateProduct() : openCreateCollection()}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 4 }}>
                        {activeTab === 'items' ? 'Add Item' : 'Add Set'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Branch Selector (HQ Only) */}
            {user?.is_main && branches.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchScroll} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {branches.map(b => (
                        <Pill
                            key={b.id}
                            label={`${b.name}${b.is_main ? ' (HQ)' : ''}`}
                            selected={selectedBranchId === b.id}
                            onPress={() => setSelectedBranchId(b.id)}
                            activeColor={theme.primary}
                        />
                    ))}
                </ScrollView>
            )}

            {/* Tabs */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 }}>
                <TouchableOpacity
                    onPress={() => setActiveTab('items')}
                    style={[styles.tab, activeTab === 'items' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'items' ? theme.primary : theme.text }]}>Items</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('collections')}
                    style={[styles.tab, activeTab === 'collections' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'collections' ? theme.primary : theme.text }]}>Collections / Promos</Text>
                </TouchableOpacity>
            </View>

            {/* Category Filter */}
            {activeTab === 'items' && (
                <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 }}>
                        <Text style={{ color: theme.icon, fontSize: 12, fontWeight: '600' }}>CATEGORIES</Text>
                        <TouchableOpacity
                            onPress={() => setShowCatManagerModal(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="settings-outline" size={16} color={theme.primary} />
                            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Manage</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: 20 }}>
                        <Pill
                            label="All"
                            selected={selectedCategory === 'ALL'}
                            onPress={() => setSelectedCategory('ALL')}
                        />

                        {categories.map(c => (
                            <Pill
                                key={c.id}
                                label={c.name}
                                selected={selectedCategory !== 'ALL' && selectedCategory.id === c.id}
                                onPress={() => setSelectedCategory(c)}
                            />
                        ))}

                        <TouchableOpacity
                            style={[styles.addPill, { borderColor: theme.icon }]}
                            onPress={() => {
                                setEditingCategory(undefined);
                                setShowCatModal(true);
                            }}
                        >
                            <Ionicons name="add" size={16} color={theme.icon} />
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}
        </View>
    );

    const renderProduct = ({ item }: { item: Product }) => (
        <View style={[styles.prodCard, { backgroundColor: theme.card }]}>
            <View style={{ flexDirection: 'row', flex: 1, gap: 12 }}>
                <View style={[styles.prodImg, { backgroundColor: theme.border, overflow: 'visible' }]}>
                    {item.image_url ? (
                        <Image
                            source={{ uri: item.image_url.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}` }}
                            style={{ width: '100%', height: '100%', borderRadius: 8 }}
                        />
                    ) : (
                        <Ionicons name="fast-food-outline" size={24} color={theme.icon} />
                    )}
                    {item.is_new && <ProductBadge type="new" style={{ top: -6, left: -6 }} />}
                    {item.is_recommended && <ProductBadge type="recommended" style={{ bottom: -6, right: -6 }} />}
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={[styles.prodName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.prodPrice, { color: theme.primary }]}>RM {item.price ? item.price.toFixed(2) : "0.00"}</Text>
                </View>
            </View>

            <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: 10 }}>
                <Switch
                    value={item.is_active}
                    onValueChange={() => handleToggleProduct(item.id, item.is_active)}
                    trackColor={{ true: theme.primary, false: '#767577' }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                <TouchableOpacity onPress={() => openEditProduct(item)}>
                    <Ionicons name="pencil" size={20} color={theme.icon} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderCollection = ({ item }: { item: any }) => (
        <View style={[styles.prodCard, { backgroundColor: theme.card }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.prodName, { color: theme.text }]}>{item.name}</Text>
                <Text style={{ color: theme.icon, fontSize: 12 }}>{item.items?.length || 0} items included</Text>
                {item.description && <Text style={{ color: theme.text, marginTop: 4 }}>{item.description}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => openEditCollection(item)}>
                    <Ionicons name="settings-outline" size={20} color={theme.icon} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                {loading && (products.length === 0 && collections.length === 0) ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
                ) : (
                    <FlatList
                        data={activeTab === 'items' ? getFilteredProducts() : collections}
                        keyExtractor={item => item.id.toString()}
                        renderItem={activeTab === 'items' ? renderProduct : renderCollection}
                        ListHeaderComponent={renderHeader}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                        }
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 50 }}>
                                <Text style={{ color: theme.icon }}>
                                    {activeTab === 'items' ? "No items found." : "No collections found."}
                                </Text>
                                <Button
                                    title={activeTab === 'items' ? "Add First Item" : "Create Collection"}
                                    onPress={() => activeTab === 'items' ? openCreateProduct() : openCreateCollection()}
                                    style={{ marginTop: 10 }}
                                />
                            </View>
                        }
                    />
                )}
            </View>

            {/* Category Manager Modal */}
            <CategoryManagerModal
                visible={showCatManagerModal}
                onClose={() => setShowCatManagerModal(false)}
                categories={categories}
                onEdit={(cat) => {
                    // Close manager modal first to avoid modal-in-modal
                    setShowCatManagerModal(false);
                    // Small delay to ensure smooth transition
                    setTimeout(() => {
                        setEditingCategory(cat);
                        setShowCatModal(true);
                    }, 300);
                }}
                onDelete={handleDeleteCategory}
                onAdd={() => {
                    // Close manager modal first to avoid modal-in-modal
                    setShowCatManagerModal(false);
                    setTimeout(() => {
                        setEditingCategory(undefined);
                        setShowCatModal(true);
                    }, 300);
                }}
            />

            <CreateCategoryModal
                visible={showCatModal}
                onClose={() => {
                    setShowCatModal(false);
                    setEditingCategory(undefined);
                }}
                onSubmit={handleCreateCategory}
                onUpdate={handleUpdateCategory}
                onDelete={handleDeleteCategory}
                loading={actionLoading}
                initialData={editingCategory}
            />

            <ProductFormModal
                visible={showProductModal}
                onClose={() => setShowProductModal(false)}
                onSubmit={handleProductSubmit}
                categories={categories}
                initialData={editingProduct}
            />

            <CollectionFormModal
                visible={showCollectionModal}
                onClose={() => setShowCollectionModal(false)}
                onSubmit={handleCollectionSubmit}
                categories={categories}
                branches={user?.is_main ? branches : undefined}
                products={products}
                initialData={editingCollection}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    branchScroll: {
        marginBottom: 15,
        maxHeight: 40,
    },
    catScroll: {
        marginBottom: 10,
        maxHeight: 40,
    },
    addPill: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(150,150,150,0.1)',
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1
    },
    prodCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    prodImg: {
        width: 60,
        height: 60,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    prodName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    prodPrice: {
        fontSize: 14,
        fontWeight: '700',
    },
    tab: {
        marginRight: 20,
        paddingBottom: 5,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    }
});
