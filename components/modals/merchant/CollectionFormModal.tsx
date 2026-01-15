import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pill } from '@/components/ui/Pill';
import { ProductBadge } from '@/components/ui/ProductBadge';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { BaseModal } from '@/components/ui/BaseModal';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

interface Product {
    id: number;
    branch_id?: number;
    name: string;
    price: number;
    category_id: number;
    image_url?: string;
    is_recommended?: boolean;
    is_new?: boolean;
}

interface Category {
    id: number;
    branch_id?: number;
    name: string;
}

interface Branch {
    id: number;
    name: string;
}

interface CollectionFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    products: Product[];
    categories?: Category[];
    branches?: Branch[];
    initialData?: any;
}

export const CollectionFormModal: React.FC<CollectionFormModalProps> = ({ visible, onClose, onSubmit, products, categories = [], branches = [], initialData }) => {
    const { user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isGlobal, setIsGlobal] = useState(false);

    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

    // Filter State
    const [selectedCatId, setSelectedCatId] = useState<number | 'ALL'>('ALL');
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'ALL'>('ALL');

    const [loading, setLoading] = useState(false);

    // Global Data Cache
    const [globalProducts, setGlobalProducts] = useState<Product[]>([]);
    const [globalCategories, setGlobalCategories] = useState<Category[]>([]);
    const [isFetchingGlobal, setIsFetchingGlobal] = useState(false);

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setName(initialData.name);
                setDescription(initialData.description || '');
                setIsGlobal(initialData.branch_id === null);

                if (initialData.items && Array.isArray(initialData.items)) {
                    setSelectedProductIds(initialData.items.map((p: any) => p.product_id || p.id));
                } else if (initialData.product_ids) {
                    setSelectedProductIds(initialData.product_ids);
                } else {
                    setSelectedProductIds([]);
                }
            } else {
                setName(''); setDescription(''); setIsGlobal(false); setSelectedProductIds([]);
            }
            setSelectedCatId('ALL');
            setSelectedBranchId('ALL');
        }
    }, [visible, initialData]);

    // Fetch Global Data when Global is toggled
    useEffect(() => {
        if (visible && isGlobal && user?.is_main) {

            const promises = [];
            if (globalProducts.length === 0) {
                promises.push(
                    api.get('/menu/products?target_branch_id=ALL')
                        .then((data: Product[]) => setGlobalProducts(data))
                );
            }

            if (globalCategories.length === 0) {
                promises.push(
                    api.get('/menu/categories?target_branch_id=ALL')
                        .then((data: Category[]) => setGlobalCategories(data))
                );
            }

            if (promises.length > 0) {
                setIsFetchingGlobal(true);
                Promise.all(promises)
                    .finally(() => setIsFetchingGlobal(false));
            }
        }
    }, [isGlobal, visible]);

    const toggleProduct = (id: number) => {
        if (selectedProductIds.includes(id)) {
            setSelectedProductIds(prev => prev.filter(pid => pid !== id));
        } else {
            setSelectedProductIds(prev => [...prev, id]);
        }
    };

    const getDisplayProducts = () => {
        if (isGlobal && user?.is_main) {
            return globalProducts.length > 0 ? globalProducts : products;
        }
        return products;
    };

    const getDisplayCategories = () => {
        if (isGlobal && user?.is_main) {
            const all = globalCategories.length > 0 ? globalCategories : categories;
            if (selectedBranchId !== 'ALL') {
                return all.filter(c => c.branch_id === selectedBranchId);
            }
            return all;
        }
        return categories;
    };

    const getFilteredProducts = () => {
        const source = getDisplayProducts();

        return source.filter(p => {
            const matchesCat = selectedCatId === 'ALL' || p.category_id === selectedCatId;
            const matchesBranch = !isGlobal || selectedBranchId === 'ALL' || p.branch_id === selectedBranchId;
            return matchesCat && matchesBranch;
        });
    };

    const handleSubmit = async () => {
        if (!name) return alert('Name is required');

        setLoading(true);
        try {
            await onSubmit({
                name,
                description,
                is_global: isGlobal,
                product_ids: selectedProductIds
            });
        } catch (e) {
        } finally {
            setLoading(false);
        }
    };

    const renderProductItem = (p: Product) => {
        const isSelected = selectedProductIds.includes(p.id);
        const branchName = branches.find(b => b.id === p.branch_id)?.name;
        // Find category name from displayCategories or global list
        const catList = isGlobal ? globalCategories : categories;
        const catName = catList.find(c => c.id === p.category_id)?.name || 'Uncategorized';

        return (
            <TouchableOpacity
                key={p.id}
                style={[
                    styles.gridItem,
                    {
                        backgroundColor: theme.card,
                        borderColor: isSelected ? theme.primary : theme.border,
                        borderWidth: isSelected ? 2 : 1
                    }
                ]}
                onPress={() => toggleProduct(p.id)}
            >
                <View style={[styles.gridImg, { backgroundColor: theme.background }]}>
                    {p.image_url ? (
                        <Image
                            source={{ uri: p.image_url.startsWith('http') ? p.image_url : `${API_URL}${p.image_url}` }}
                            style={styles.img}
                            resizeMode="cover"
                        />
                    ) : (
                        <Ionicons name="fast-food-outline" size={30} color={theme.icon} />
                    )}
                    {isSelected && (
                        <View style={[styles.checkOverlay, { backgroundColor: 'rgba(255,255,255,0.8)' }]}>
                            <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                        </View>
                    )}
                    {p.is_new && <ProductBadge type="new" style={{ top: 4, left: 4 }} />}
                    {p.is_recommended && <ProductBadge type="recommended" style={{ bottom: 4, left: 4 }} />}
                </View>

                <View style={{ padding: 8 }}>
                    <Text numberOfLines={1} style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text numberOfLines={1} style={{ color: theme.icon, fontSize: 10, marginVertical: 2, flex: 1 }}>
                            {catName}
                        </Text>
                        {isGlobal && branchName && (
                            <Text style={{ fontSize: 8, color: theme.text, backgroundColor: theme.border, padding: 2, borderRadius: 4 }}>
                                {branchName}
                            </Text>
                        )}
                    </View>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>RM {p.price.toFixed(2)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const displayCategories = getDisplayCategories();

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={initialData ? 'Edit Collection' : 'New Collection'}
            scrollable={false}
        >
            <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ gap: 16, padding: 24, paddingBottom: 0 }}>
                            <Input label="Collection Name" placeholder="e.g. Hot Deals" value={name} onChangeText={setName} />
                            <Input label="Description" placeholder="Marketing text..." value={description} onChangeText={setDescription} multiline style={{ height: 60 }} />

                            {user?.is_main && (
                                <View style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    <View>
                                        <Text style={[styles.label, { color: theme.text }]}>Global Collection</Text>
                                        <Text style={{ color: theme.icon, fontSize: 12 }}>Visible to all branches</Text>
                                    </View>
                                    <Switch
                                        value={isGlobal}
                                        onValueChange={setIsGlobal}
                                        trackColor={{ true: theme.primary, false: '#767577' }}
                                    />
                                </View>
                            )}
                        </View>

                        {/* Filter Section */}
                        <View style={{ padding: 24, paddingBottom: 10 }}>
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>
                                Select Products ({selectedProductIds.length})
                            </Text>

                            {/* Branch Filter (Only if Global Enabled and HQ) */}
                            {isGlobal && user?.is_main && branches.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                    <Pill
                                        label="All Branches"
                                        selected={selectedBranchId === 'ALL'}
                                        onPress={() => setSelectedBranchId('ALL')}
                                    />
                                    {branches.map(b => (
                                        <Pill
                                            key={b.id}
                                            label={b.name}
                                            selected={selectedBranchId === b.id}
                                            onPress={() => setSelectedBranchId(b.id)}
                                        />
                                    ))}
                                </ScrollView>
                            )}

                            {/* Category Filter */}
                            {displayCategories.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <Pill
                                        label="All Cats"
                                        selected={selectedCatId === 'ALL'}
                                        onPress={() => setSelectedCatId('ALL')}
                                    />
                                    {displayCategories.map(c => (
                                        <Pill
                                            key={c.id}
                                            label={c.name}
                                            selected={selectedCatId === c.id}
                                            onPress={() => setSelectedCatId(c.id)}
                                        />
                                    ))}
                                </ScrollView>
                            )}
                        </View>

                        {/* Scrollable Grid View */}
                        <View style={{ height: 350, marginHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} contentContainerStyle={{ padding: 10 }}>
                                {isFetchingGlobal ? (
                                    <Text style={{ textAlign: 'center', marginTop: 50, color: theme.icon }}>Loading global products...</Text>
                                ) : getFilteredProducts().length === 0 ? (
                                    <Text style={{ color: theme.icon, textAlign: 'center', marginTop: 50 }}>No products found.</Text>
                                ) : (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                                        {getFilteredProducts().map(renderProductItem)}
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>

                    <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
                        <Button
                            title={initialData ? `Update Collection` : `Create Collection`}
                            onPress={handleSubmit}
                            loading={loading}
                        />
                    </View>
                </KeyboardAvoidingView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold' },
    footer: {
        padding: 24,
        paddingBottom: 40,
        borderTopWidth: 1,
    },
    gridItem: {
        width: '48%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 10,
    },
    gridImg: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    img: {
        width: '100%',
        height: '100%'
    },
    checkOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        borderRadius: 12,
    }
});
