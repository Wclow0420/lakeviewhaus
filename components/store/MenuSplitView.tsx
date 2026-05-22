import { Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api, API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MenuItem } from './MenuItem';

interface MenuSplitViewProps {
    branchId: number;
    initialProductId?: number;
    searchQuery: string;
    onProductPress?: (product: Product) => void;
}

interface Category {
    id: number;
    name: string;
    image_url?: string;
}

interface Product {
    id: number;
    name: string;
    category_id: number;
    price: number;
    description?: string;
    image_url?: string;
    is_new?: boolean;
    is_recommended?: boolean;
    is_active?: boolean;
}

// -------- Sidebar pill --------
interface SidebarPillProps {
    title: string;
    imageUrl?: string;
    selected: boolean;
    onPress: () => void;
}

const SidebarPill = React.memo(({ title, imageUrl, selected, onPress }: SidebarPillProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const scale = useSharedValue(selected ? 1.02 : 1);

    useEffect(() => {
        scale.value = withSpring(selected ? 1.02 : 1, { damping: 15 });
    }, [selected]);

    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Animated.View style={animStyle}>
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.8}
                style={[
                    styles.sidebarPill,
                    selected && {
                        backgroundColor: theme.primary,
                        shadowOpacity: 0.08,
                    },
                ]}
            >
                <View style={[styles.sidebarImageBox, { backgroundColor: selected ? 'rgba(255,255,255,0.6)' : theme.card }]}>
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl.startsWith('http') ? imageUrl : `${API_URL}${imageUrl}` }}
                            style={styles.sidebarImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <Ionicons name="restaurant-outline" size={18} color={selected ? theme.secondary : theme.icon} />
                    )}
                </View>
                <Text
                    style={[
                        styles.sidebarLabel,
                        { color: selected ? theme.secondary : theme.text, fontFamily: selected ? Fonts.bold : Fonts.medium },
                    ]}
                    numberOfLines={2}
                >
                    {title}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
});

// -------- Skeleton card --------
const SkeletonCard = () => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.8, { duration: 900 }), -1, true);
    }, []);

    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={[styles.skeletonCard, { backgroundColor: theme.card }, style]}>
            <View style={[styles.skeletonImage, { backgroundColor: theme.border }]} />
            <View style={styles.skeletonBody}>
                <View style={[styles.skeletonLine, { backgroundColor: theme.border, width: '80%' }]} />
                <View style={[styles.skeletonLine, { backgroundColor: theme.border, width: '60%', marginTop: 6 }]} />
                <View style={[styles.skeletonLine, { backgroundColor: theme.border, width: '30%', marginTop: 12 }]} />
            </View>
        </Animated.View>
    );
};

export function MenuSplitView({ branchId, initialProductId, searchQuery, onProductPress }: MenuSplitViewProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const sectionListRef = useRef<SectionList>(null);
    const categoryListRef = useRef<FlatList>(null);
    const isManualScroll = useRef(false);
    const sectionsRef = useRef<any[]>([]);
    const selectedCategoryIndexRef = useRef(0);

    // Card height = imageHeight(104) + padding(24) + marginBottom(12)
    const SECTION_HEADER_HEIGHT = 56;
    const ITEM_HEIGHT = 140;

    useEffect(() => {
        loadData();
    }, [branchId]);

    useEffect(() => {
        if (!loading && initialProductId && products.length > 0 && categories.length > 0) {
            const product = products.find(p => p.id === initialProductId);
            if (product) {
                const visibleSections = categories.map(cat => ({
                    id: cat.id,
                    data: products.filter(p => p.category_id === cat.id),
                })).filter(s => s.data.length > 0);
                const sectionIndex = visibleSections.findIndex(s => s.id === product.category_id);
                if (sectionIndex !== -1) {
                    const itemIndex = visibleSections[sectionIndex].data.findIndex(p => p.id === product.id);
                    setTimeout(() => {
                        setSelectedCategoryIndex(sectionIndex);
                        categoryListRef.current?.scrollToIndex({ index: sectionIndex, animated: true, viewPosition: 0.5 });
                        sectionListRef.current?.scrollToLocation({
                            sectionIndex,
                            itemIndex: itemIndex !== -1 ? itemIndex : 0,
                            animated: true,
                            viewPosition: 0,
                        });
                    }, 500);
                }
            }
        }
    }, [loading, initialProductId, products, categories]);

    const loadData = async () => {
        if (!refreshing) setLoading(true);
        try {
            const [cats, prods] = await Promise.all([
                api.customer.getCategories(branchId),
                api.customer.getProducts(branchId),
            ]);
            setCategories(cats);
            setProducts(prods);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const sections = categories.map(cat => ({
        title: cat.name,
        image_url: cat.image_url,
        id: cat.id,
        data: products.filter(p => p.category_id === cat.id),
    })).filter(s => s.data.length > 0);

    sectionsRef.current = sections;
    selectedCategoryIndexRef.current = selectedCategoryIndex;

    const filteredProducts = searchQuery.trim()
        ? products.filter(p => {
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
        })
        : [];
    const isSearching = searchQuery.trim().length > 0;

    const calculateSectionOffset = (targetIndex: number): number => {
        let offset = 0;
        for (let i = 0; i < targetIndex; i++) {
            offset += SECTION_HEADER_HEIGHT;
            offset += sections[i].data.length * ITEM_HEIGHT;
        }
        return offset;
    };

    const handleCategoryPress = (index: number) => {
        if (index === selectedCategoryIndex) return;
        Haptics.selectionAsync();
        isManualScroll.current = true;
        setSelectedCategoryIndex(index);
        categoryListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        const offset = calculateSectionOffset(index);
        const scrollResponder = sectionListRef.current?.getScrollResponder();
        if (scrollResponder && 'scrollTo' in scrollResponder) {
            (scrollResponder as any).scrollTo({ y: offset, animated: true });
            setTimeout(() => { isManualScroll.current = false; }, 800);
        }
    };

    const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (isManualScroll.current) return;
        if (viewableItems.length > 0) {
            const visibleItem = viewableItems[0];
            if (visibleItem.section) {
                const sectionTitle = visibleItem.section.title;
                const index = sectionsRef.current.findIndex(s => s.title === sectionTitle);
                if (index !== -1 && index !== selectedCategoryIndexRef.current) {
                    setSelectedCategoryIndex(index);
                    categoryListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                }
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 10,
        waitForInteraction: false,
    }).current;

    // Loading skeleton — shows in both panes
    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.contentRow}>
                    <View style={[styles.sidebar, { backgroundColor: theme.background }]}>
                        {[0, 1, 2, 3].map(i => (
                            <View key={i} style={[styles.sidebarSkeleton, { backgroundColor: theme.card }]} />
                        ))}
                    </View>
                    <View style={[styles.content, { backgroundColor: theme.background }]}>
                        <View style={styles.contentInner}>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    if (sections.length === 0) {
        return (
            <View style={styles.emptyScreen}>
                <Ionicons name="restaurant-outline" size={56} color={theme.icon} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No menu available</Text>
                <Text style={[styles.emptySub, { color: theme.icon }]}>This branch hasn't added any items yet.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.contentRow}>
                {isSearching ? (
                    filteredProducts.length > 0 ? (
                        <FlatList
                            style={{ flex: 1, backgroundColor: theme.background }}
                            data={filteredProducts}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <MenuItem item={item} onPress={onProductPress} />
                            )}
                            contentContainerStyle={[styles.contentInner, { paddingBottom: 300 }]}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <View style={styles.emptySearch}>
                            <Ionicons name="search-outline" size={48} color={theme.icon} />
                            <Text style={[styles.emptySearchText, { color: theme.text }]}>
                                No results for "{searchQuery}"
                            </Text>
                            <Text style={[styles.emptySub, { color: theme.icon }]}>
                                Try a different keyword.
                            </Text>
                        </View>
                    )
                ) : (
                    <>
                        {/* Sidebar */}
                        <View style={[styles.sidebar, { backgroundColor: theme.background }]}>
                            <FlatList
                                ref={categoryListRef}
                                data={sections}
                                keyExtractor={(item) => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.sidebarList}
                                renderItem={({ item, index }) => (
                                    <SidebarPill
                                        title={item.title}
                                        imageUrl={item.image_url}
                                        selected={selectedCategoryIndex === index}
                                        onPress={() => handleCategoryPress(index)}
                                    />
                                )}
                            />
                        </View>

                        {/* Main Content */}
                        <View style={[styles.content, { backgroundColor: theme.background }]}>
                            <SectionList
                                ref={sectionListRef}
                                sections={sections}
                                keyExtractor={(item) => item.id.toString()}
                                stickySectionHeadersEnabled={true}
                                renderSectionHeader={({ section }: any) => (
                                    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
                                        <Text style={[styles.sectionHeaderText, { color: theme.text }]}>
                                            {section.title}
                                        </Text>
                                        <Text style={[styles.sectionHeaderCount, { color: theme.icon }]}>
                                            {section.data.length} item{section.data.length !== 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                )}
                                renderItem={({ item }) => (
                                    <MenuItem item={item} onPress={onProductPress} />
                                )}
                                onViewableItemsChanged={handleViewableItemsChanged}
                                viewabilityConfig={viewabilityConfig}
                                refreshControl={
                                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />
                                }
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={[styles.contentInner, { paddingBottom: 300 }]}
                                onScrollBeginDrag={() => { isManualScroll.current = false; }}
                                onMomentumScrollBegin={() => { isManualScroll.current = false; }}
                            />
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
    },

    // Sidebar
    sidebar: {
        width: '22%',
    },
    sidebarList: {
        paddingVertical: 8,
        paddingHorizontal: 6,
        gap: 6,
    },
    sidebarPill: {
        paddingVertical: 10,
        paddingHorizontal: 6,
        alignItems: 'center',
        borderRadius: Layout.radius.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0,
        shadowRadius: 6,
        elevation: 0,
    },
    sidebarImageBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    sidebarImage: {
        width: '100%',
        height: '100%',
    },
    sidebarLabel: {
        fontSize: 11.5,
        textAlign: 'center',
        lineHeight: 14,
        letterSpacing: -0.1,
    },
    sidebarSkeleton: {
        height: 78,
        marginVertical: 4,
        marginHorizontal: 6,
        borderRadius: Layout.radius.md,
        opacity: 0.5,
    },

    // Content
    content: {
        flex: 1,
    },
    contentInner: {
        paddingHorizontal: 14,
        paddingTop: 8,
    },
    sectionHeader: {
        paddingTop: 16,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    sectionHeaderText: {
        fontSize: 18,
        fontFamily: Fonts.bold,
        letterSpacing: -0.3,
    },
    sectionHeaderCount: {
        fontSize: 12,
        fontFamily: Fonts.medium,
    },

    // Empty states
    emptyScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 10,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: Fonts.bold,
        marginTop: 12,
    },
    emptySub: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        textAlign: 'center',
    },
    emptySearch: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 30,
    },
    emptySearchText: {
        fontSize: 15,
        fontFamily: Fonts.bold,
        marginTop: 10,
    },

    // Skeleton card
    skeletonCard: {
        flexDirection: 'row',
        borderRadius: Layout.radius.md,
        padding: 12,
        marginBottom: 12,
    },
    skeletonImage: {
        width: 104,
        height: 104,
        borderRadius: Layout.radius.md,
        marginRight: 14,
    },
    skeletonBody: {
        flex: 1,
        paddingVertical: 4,
    },
    skeletonLine: {
        height: 12,
        borderRadius: 6,
    },
});
