import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api, API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MenuItem } from './MenuItem';

interface MenuSplitViewProps {
    branchId: number;
    initialProductId?: number;
    searchQuery: string;
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

export function MenuSplitView({ branchId, initialProductId, searchQuery }: MenuSplitViewProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);

    const sectionListRef = useRef<SectionList>(null);
    const categoryListRef = useRef<FlatList>(null);
    const isManualScroll = useRef(false);
    const sectionsRef = useRef<typeof sections>([]);
    const selectedCategoryIndexRef = useRef(0);

    const [refreshing, setRefreshing] = useState(false);

    // Fixed heights for calculation
    const SECTION_HEADER_HEIGHT = 56; // paddingTop(12) + paddingVertical(12) + text height + paddingBottom(0) + inner padding
    const ITEM_HEIGHT = 110; // from MenuItem styles
    const ITEM_MARGIN_BOTTOM = 12; // marginBottom for last item in section

    useEffect(() => {
        loadData();
    }, [branchId]);

    // Auto Scroll to Product if requested
    useEffect(() => {
        if (!loading && initialProductId && products.length > 0 && categories.length > 0) {
            const product = products.find(p => p.id === initialProductId);
            if (product) {
                // Find category index (of rendered sections, which filters out empty categories)
                const visibleSections = categories.map(cat => ({
                    id: cat.id,
                    data: products.filter(p => p.category_id === cat.id)
                })).filter(s => s.data.length > 0);

                const sectionIndex = visibleSections.findIndex(s => s.id === product.category_id);

                if (sectionIndex !== -1) {
                    // Find item index within section
                    const itemIndex = visibleSections[sectionIndex].data.findIndex(p => p.id === product.id);

                    // Slight delay to ensure layout
                    setTimeout(() => {
                        // Select Category First (Sidebar)
                        setSelectedCategoryIndex(sectionIndex);
                        categoryListRef.current?.scrollToIndex({ index: sectionIndex, animated: true, viewPosition: 0.5 });

                        // Scroll Main Content to Exact Item
                        sectionListRef.current?.scrollToLocation({
                            sectionIndex,
                            itemIndex: itemIndex !== -1 ? itemIndex : 0,
                            animated: true,
                            viewPosition: 0, // Top of item at top of view
                            viewOffset: 0
                        });
                    }, 500);
                }
            }
        }
    }, [loading, initialProductId, products, categories]);

    const loadData = async () => {
        // Only show full loading on initial load or id change, not refresh
        if (!refreshing) setLoading(true);
        try {
            // Parallel fetch
            const [cats, prods] = await Promise.all([
                api.customer.getCategories(branchId),
                api.customer.getProducts(branchId)
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

    // Group products by category
    const sections = categories.map(cat => ({
        title: cat.name,
        image_url: cat.image_url,
        id: cat.id,
        data: products.filter(p => p.category_id === cat.id)
    })).filter(section => section.data.length > 0); // Only show categories with products

    // Keep refs in sync so the stable onViewableItemsChanged callback sees current values
    sectionsRef.current = sections;
    selectedCategoryIndexRef.current = selectedCategoryIndex;

    const filteredProducts = searchQuery.trim()
        ? products.filter(p => {
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) ||
                (p.description && p.description.toLowerCase().includes(q));
        })
        : [];
    const isSearching = searchQuery.trim().length > 0;

    const calculateSectionOffset = (targetIndex: number): number => {
        let offset = 0;

        // Sum up heights of all sections before the target
        for (let i = 0; i < targetIndex; i++) {
            offset += SECTION_HEADER_HEIGHT; // Section header
            offset += sections[i].data.length * ITEM_HEIGHT; // All items in section
            offset += ITEM_MARGIN_BOTTOM; // Margin after last item
        }

        return offset;
    };

    const handleCategoryPress = (index: number) => {
        if (index === selectedCategoryIndex) return;

        isManualScroll.current = true;
        setSelectedCategoryIndex(index);

        // Scroll to category list first to show selection
        categoryListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });

        // Calculate the scroll offset for this section
        const offset = calculateSectionOffset(index);

        // Get the scroll responder and scroll to the calculated position
        const scrollResponder = sectionListRef.current?.getScrollResponder();
        if (scrollResponder && 'scrollTo' in scrollResponder) {
            (scrollResponder as any).scrollTo({
                y: offset,
                animated: true
            });

            // Re-enable auto-sync after scroll animation (approx 800ms)
            setTimeout(() => {
                isManualScroll.current = false;
            }, 800);
        }
    };

    const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (isManualScroll.current) return;

        if (viewableItems.length > 0) {
            // Find the most visible item's section
            const visibleItem = viewableItems[0];

            if (visibleItem.section) {
                const sectionTitle = visibleItem.section.title;
                const index = sectionsRef.current.findIndex(s => s.title === sectionTitle);

                if (index !== -1 && index !== selectedCategoryIndexRef.current) {
                    setSelectedCategoryIndex(index);
                    categoryListRef.current?.scrollToIndex({
                        index: index,
                        animated: true,
                        viewPosition: 0.5
                    });
                }
            }
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 10, // More sensitive
        waitForInteraction: false,
    }).current;

    if (loading) {
        return <View style={styles.loading}><ActivityIndicator color={theme.primary} /></View>;
    }

    if (sections.length === 0) {
        return (
            <View style={styles.center}>
                <Text style={{ color: theme.icon }}>No menu items available.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.contentRow}>
                {isSearching ? (
                    /* Full-width search results */
                    filteredProducts.length > 0 ? (
                        <FlatList
                            style={{ flex: 1 }}
                            data={filteredProducts}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item, index }) => {
                                const isLast = index === filteredProducts.length - 1;
                                return (
                                    <View style={[styles.categoryContainer, styles.searchResultItem, isLast && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginBottom: 12 }]}>
                                        <MenuItem
                                            item={item}
                                            onPress={() => console.log('Press Item', item)}
                                            isLast={isLast}
                                        />
                                    </View>
                                );
                            }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 300 }}
                        />
                    ) : (
                        <View style={styles.emptySearch}>
                            <Ionicons name="search-outline" size={40} color="#CCC" />
                            <Text style={styles.emptySearchText}>No results for "{searchQuery}"</Text>
                        </View>
                    )
                ) : (
                    /* Normal sidebar + section list layout */
                    <>
                        {/* Sidebar */}
                        <View style={[styles.sidebar, { backgroundColor: '#F5F5F5' }]}>
                            <FlatList
                                ref={categoryListRef}
                                data={sections}
                                keyExtractor={(item) => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item, index }) => {
                                    const isSelected = selectedCategoryIndex === index;

                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.sidebarItem,
                                                isSelected && { backgroundColor: '#FFFFFF' }
                                            ]}
                                            onPress={() => handleCategoryPress(index)}
                                        >
                                            {/* Category Image Circle */}
                                            <View style={[
                                                styles.categoryImageContainer,
                                                isSelected && { borderColor: theme.primary, borderWidth: 2 },
                                                !item.image_url && { justifyContent: 'center', alignItems: 'center' }
                                            ]}>
                                                {item.image_url ? (
                                                    <Image
                                                        source={{ uri: item.image_url.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}` }}
                                                        style={styles.categoryImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <Ionicons name="restaurant" size={24} color={isSelected ? theme.primary : theme.icon} />
                                                )}
                                            </View>

                                            {/* Category Name */}
                                            <Text style={[
                                                styles.sidebarText,
                                                { color: isSelected ? theme.text : theme.icon },
                                                isSelected && { fontWeight: '700' }
                                            ]} numberOfLines={2}>
                                                {item.title}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>

                        {/* Main Content */}
                        <View style={[styles.content, { backgroundColor: '#F8F8F8' }]}>
                            <SectionList
                                ref={sectionListRef}
                                sections={sections}
                                keyExtractor={(item) => item.id.toString()}
                                stickySectionHeadersEnabled={true}
                                renderSectionHeader={({ section: { title } }: any) => (
                                    <View style={[styles.sectionHeader, { backgroundColor: '#F8F8F8' }]}>
                                        <View style={styles.sectionHeaderInner}>
                                            <Text style={[styles.sectionHeaderText, { color: theme.text }]}>{title}</Text>
                                        </View>
                                    </View>
                                )}
                                renderItem={({ item, section }) => {
                                    // Check if this is the last item in the section
                                    const isLastItem = section.data[section.data.length - 1].id === item.id;

                                    return (
                                        <View style={[
                                            styles.categoryContainer,
                                            isLastItem && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginBottom: 12 }
                                        ]}>
                                            <MenuItem
                                                item={item}
                                                onPress={() => console.log('Press Item', item)}
                                                isLast={isLastItem}
                                            />
                                        </View>
                                    );
                                }}
                                onViewableItemsChanged={handleViewableItemsChanged}
                                viewabilityConfig={viewabilityConfig}
                                refreshControl={
                                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />
                                }
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 300 }}
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
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sidebar: {
        width: '25%',
    },
    sidebarItem: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryImageContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        marginBottom: 6,
        backgroundColor: '#FFFFFF',
    },
    categoryImage: {
        width: '100%',
        height: '100%',
    },
    sidebarText: {
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 14,
    },
    content: {
        width: '75%',
    },
    sectionHeader: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 0,
    },
    sectionHeaderInner: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    sectionHeaderText: {
        fontSize: 16,
        fontWeight: '700',
    },
    categoryContainer: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 12,
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
    },
    searchResultItem: {
        marginHorizontal: 12,
    },
    emptySearch: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptySearchText: {
        fontSize: 14,
        color: '#999',
    },
});
