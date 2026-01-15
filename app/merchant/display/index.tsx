import { ProductPickerModal } from '@/components/modals/merchant/ProductPickerModal';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api, API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

interface Banner {
    id: number;
    image_url: string;
    title?: string;
    sort_order: number;
}

interface TopPick {
    id: number;
    product_id: number;
    sort_order: number;
    product: {
        id: number;
        name: string;
        price: number;
        image_url?: string;
    };
}

export default function DisplayManagementScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [loading, setLoading] = useState(true);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [topPicks, setTopPicks] = useState<TopPick[]>([]);
    const [isProductPickerVisible, setProductPickerVisible] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [bRes, tRes] = await Promise.all([
                api.marketing.getBanners(),
                api.marketing.getTopPicks()
            ]);
            setBanners(bRes);
            setTopPicks(tRes);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load display data');
        } finally {
            setLoading(false);
        }
    };

    // --- Banner Logic ---

    const handleAddBanner = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, // Maybe banner specific aspect ratio? 16:9?
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadBanner(result.assets[0].uri);
        }
    };

    const uploadBanner = async (uri: string) => {
        try {
            // 1. Upload
            const formData = new FormData();
            formData.append('file', {
                uri,
                name: 'banner.jpg',
                type: 'image/jpeg',
            } as any);

            const uploadRes = await api.post('/upload', formData);
            if (uploadRes.url) {
                // 2. Create Banner Record
                await api.marketing.createBanner({
                    image_url: uploadRes.url,
                    sort_order: banners.length // Append to end
                });
                loadData(); // Refresh
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to upload banner');
        }
    };

    const handleDeleteBanner = (id: number) => {
        Alert.alert('Delete Banner', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.marketing.deleteBanner(id);
                        loadData();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete');
                    }
                }
            }
        ]);
    };

    // --- Top Pick Logic ---

    const handleAddTopPick = (productId: number) => {
        api.marketing.addTopPick({ product_id: productId, sort_order: topPicks.length })
            .then(() => loadData())
            .catch(err => {
                if (err.error) Alert.alert('Error', err.error);
                else Alert.alert('Error', 'Failed to add product');
            });
    };

    const handleDeleteTopPick = (id: number) => {
        Alert.alert('Remove Product', 'Remove from Top Picks?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await api.marketing.removeTopPick(id);
                        loadData();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to remove');
                    }
                }
            }
        ]);
    };

    // --- Reordering Logic ---

    const moveBanner = async (index: number, direction: 'left' | 'right') => {
        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= banners.length) return;

        const newBanners = [...banners];
        // Swap
        [newBanners[index], newBanners[newIndex]] = [newBanners[newIndex], newBanners[index]];

        setBanners(newBanners); // Optimistic

        // Persist
        try {
            await api.marketing.reorderBanners(newBanners.map(b => b.id));
        } catch (e) {
            console.error('Failed to reorder', e);
            Alert.alert('Error', 'Saved failed');
            loadData(); // Revert
        }
    };

    const moveTopPick = async (index: number, direction: 'left' | 'right') => {
        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= topPicks.length) return;

        const newPicks = [...topPicks];
        // Swap
        [newPicks[index], newPicks[newIndex]] = [newPicks[newIndex], newPicks[index]];

        setTopPicks(newPicks); // Optimistic

        // Persist
        try {
            await api.marketing.reorderTopPicks(newPicks.map(p => p.id));
        } catch (e) {
            console.error('Failed to reorder', e);
            Alert.alert('Error', 'Saved failed');
            loadData(); // Revert
        }
    };


    if (loading && banners.length === 0) {
        return <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    return (
        <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Display Management</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Slideshow Section */}
                <View style={styles.slideshowContainer}>
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                        {banners.map((slide, index) => (
                            <View key={slide.id} style={{ width, height: 380, position: 'relative' }}>
                                <Image
                                    source={{
                                        uri: slide.image_url.startsWith('http')
                                            ? slide.image_url
                                            : `${API_URL}${slide.image_url.startsWith('/') ? '' : '/'}${slide.image_url}`
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                                {/* Delete Button Overlay */}
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteBanner(slide.id)}
                                >
                                    <Ionicons name="trash" size={20} color="#fff" />
                                </TouchableOpacity>

                                {/* Move Left */}
                                {index > 0 && (
                                    <TouchableOpacity
                                        style={[styles.moveButton, { left: 16 }]}
                                        onPress={() => moveBanner(index, 'left')}
                                    >
                                        <Ionicons name="chevron-back" size={24} color="#fff" />
                                    </TouchableOpacity>
                                )}

                                {/* Move Right */}
                                {index < banners.length - 1 && (
                                    <TouchableOpacity
                                        style={[styles.moveButton, { right: 60 }]} // Offset from delete
                                        onPress={() => moveBanner(index, 'right')}
                                    >
                                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        {/* ADD Item Slide */}
                        <TouchableOpacity
                            style={[{ width, height: 380, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' }]}
                            onPress={handleAddBanner}
                        >
                            <View style={styles.addCircle}>
                                <Ionicons name="add" size={40} color="#fff" />
                            </View>
                            <Text style={{ marginTop: 12, color: '#666', fontWeight: '600' }}>Add Slide Image</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Pagination Dots */}
                    <View style={styles.pagination}>
                        {banners.map((_, index) => (
                            <View key={index} style={[styles.dot, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                        ))}
                        <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                    </View>
                </View>

                {/* Content Container (Curved) */}
                <View style={[styles.contentContainer, { backgroundColor: theme.background }]}>

                    {/* Placeholder for Floating Card */}
                    <View style={[styles.floatingCard, { borderColor: '#E0E0E0', backgroundColor: '#FAFAFA' }]}>
                        <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
                            <Ionicons name="card-outline" size={40} color="#ccc" />
                            <Text style={{ color: '#aaa', marginTop: 8 }}>Member Card (Preview)</Text>
                        </View>
                    </View>

                    {/* Action Banners Placeholder */}
                    <View style={styles.bannerRow}>
                        <View style={[styles.mainBanner, { backgroundColor: '#F5F5F5' }]}>
                            <Ionicons name="fast-food-outline" size={30} color="#ccc" />
                        </View>
                        <View style={[styles.mainBanner, { backgroundColor: '#F5F5F5' }]}>
                            <Ionicons name="gift-outline" size={30} color="#ccc" />
                        </View>
                    </View>

                    {/* Top Picks Header */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Picks</Text>
                        <Text style={{ color: '#999', fontSize: 12 }}>Manage the list below</Text>
                    </View>

                    {/* Product Grid */}
                    <View style={styles.productGrid}>
                        {topPicks.map((item, index) => (
                            <View
                                key={item.id}
                                style={[styles.productCard, { backgroundColor: theme.card }]}
                            >
                                <View style={styles.productImageWrapper}>
                                    {item.product?.image_url && (
                                        <Image
                                            source={{
                                                uri: item.product.image_url.startsWith('http')
                                                    ? item.product.image_url
                                                    : `${API_URL}${item.product.image_url}`
                                            }}
                                            style={styles.productImage}
                                        />
                                    )}
                                    <TouchableOpacity
                                        style={[styles.discountBadge, { backgroundColor: 'red', zIndex: 10 }]}
                                        onPress={() => handleDeleteTopPick(item.id)}
                                    >
                                        <Ionicons name="trash-outline" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.productInfo}>
                                    <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>
                                        {item.product?.name || 'Unknown'}
                                    </Text>
                                    <View style={styles.priceRow}>
                                        <Text style={styles.currentPrice}>RM {item.product?.price.toFixed(2)}</Text>
                                    </View>
                                </View>

                                {/* Reorder Controls Footer */}
                                <View style={styles.reorderFooter}>
                                    <TouchableOpacity
                                        style={[styles.reorderBtn, { opacity: index === 0 ? 0.3 : 1 }]}
                                        disabled={index === 0}
                                        onPress={() => moveTopPick(index, 'left')}
                                    >
                                        <Ionicons name="chevron-back" size={20} color={theme.text} />
                                    </TouchableOpacity>
                                    <View style={styles.reorderDivider} />
                                    <TouchableOpacity
                                        style={[styles.reorderBtn, { opacity: index === topPicks.length - 1 ? 0.3 : 1 }]}
                                        disabled={index === topPicks.length - 1}
                                        onPress={() => moveTopPick(index, 'right')}
                                    >
                                        <Ionicons name="chevron-forward" size={20} color={theme.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        {/* Add Button Top Pick */}
                        <TouchableOpacity
                            style={[styles.productCard, { backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', minHeight: 200 }]}
                            onPress={() => setProductPickerVisible(true)}
                        >
                            <Ionicons name="add-circle-outline" size={50} color={theme.icon} />
                            <Text style={{ color: theme.icon, marginTop: 8 }}>Add Product</Text>
                        </TouchableOpacity>

                    </View>

                </View>
            </ScrollView>

            <ProductPickerModal
                visible={isProductPickerVisible}
                onClose={() => setProductPickerVisible(false)}
                onSelect={handleAddTopPick}
                existingProductIds={topPicks.map(p => p.product_id)}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    slideshowContainer: {
        height: 380,
        width: '100%',
        position: 'relative',
    },
    pagination: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    contentContainer: {
        marginTop: -30,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 0,
        paddingHorizontal: Layout.spacing.lg,
        minHeight: 500,
    },
    floatingCard: {
        marginTop: -40,
        marginBottom: 24,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    bannerRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    mainBanner: {
        flex: 1,
        height: 100,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    productCard: {
        width: (width - 48 - 12) / 2,
        borderRadius: 16,
        overflow: 'hidden',
        paddingBottom: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    productImageWrapper: {
        height: 140,
        backgroundColor: '#F5F5F5',
        marginBottom: 12,
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
    },
    productInfo: {
        paddingHorizontal: 12,
        gap: 4,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    currentPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#D32F2F',
    },
    deleteButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    addCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center'
    },
    moveButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    reorderFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        marginTop: 12,
        height: 40
    },
    reorderBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
    },
    reorderDivider: {
        width: 1,
        height: '60%',
        backgroundColor: '#f0f0f0'
    }
});
