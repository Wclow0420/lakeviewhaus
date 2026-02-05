import { RewardBadge } from '@/components/ui/RewardBadge';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Reward {
    id: string;
    title: string;
    description?: string;
    image_url?: string;
    category?: string;
    points_cost: number;
    min_rank_required: string;
    is_active: boolean;
    stock_quantity?: number;
    available_stock?: number;
    reward_type: string;
    discount_value?: number;
    target_name?: string;
    branch_id?: number;
}

interface LuckyDraw {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    points_cost: number;
    total_available_spins?: number;
    remaining_spins?: number;
    is_day7_draw: boolean;
    user_can_spin: boolean;
    user_spins_today: number;
    user_has_enough_points: boolean;
}

const RANK_HIERARCHY: Record<string, number> = {
    'bronze': 0,
    'silver': 1,
    'gold': 2,
    'platinum': 3
};

type ContentType = 'all' | 'rewards' | 'lucky_draws';

export default function RewardCatalogScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [rewards, setRewards] = useState<Reward[]>([]);
    const [luckyDraws, setLuckyDraws] = useState<LuckyDraw[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Filters
    const [contentType, setContentType] = useState<ContentType>('all');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Categories (fetched dynamically or hardcoded)
    const [categories, setCategories] = useState<string[]>([]);

    useEffect(() => {
        loadInitialData();
    }, [contentType, selectedCategory]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setCurrentPage(1);
            await fetchData(1);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load catalog');
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async (page: number) => {
        try {
            if (contentType === 'all' || contentType === 'rewards') {
                const params: any = { page, per_page: 20 };
                if (selectedCategory) params.category = selectedCategory;

                const rewardsData = await api.rewards.getAvailableRewards(params);

                if (page === 1) {
                    setRewards(rewardsData.rewards || rewardsData);
                } else {
                    setRewards(prev => [...prev, ...(rewardsData.rewards || rewardsData)]);
                }

                if (rewardsData.pages) {
                    setTotalPages(rewardsData.pages);
                    setHasMore(page < rewardsData.pages);
                }
            }

            if (contentType === 'all' || contentType === 'lucky_draws') {
                const drawsData = await api.userLuckyDraw.getAvailableDraws();
                setLuckyDraws(drawsData.lucky_draws || []);
            }

            // Fetch categories for filter (if endpoint available, otherwise use existing data)
            if (page === 1) {
                try {
                    const cats = await api.rewards.getCategories();
                    setCategories(cats);
                } catch {
                    // Fallback: extract from loaded rewards
                    const uniqueCats = Array.from(new Set(rewards.map(r => r.category).filter(Boolean)));
                    setCategories(uniqueCats as string[]);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const loadMore = async () => {
        if (loadingMore || !hasMore || contentType === 'lucky_draws') return;

        try {
            setLoadingMore(true);
            const nextPage = currentPage + 1;
            await fetchData(nextPage);
            setCurrentPage(nextPage);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingMore(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        setCurrentPage(1);
        await fetchData(1);
        setRefreshing(false);
    };

    const renderReward = (item: Reward) => {
        const isStockUnlimited = item.stock_quantity === null;
        const available = item.available_stock || 0;
        const hasStock = isStockUnlimited || available > 0;

        const userRankLevel = RANK_HIERARCHY[(user?.rank || 'bronze').toLowerCase()] || 0;
        const requiredRankLevel = RANK_HIERARCHY[(item.min_rank_required || '').toLowerCase()] || 0;
        const isLocked = userRankLevel < requiredRankLevel;

        return (
            <TouchableOpacity
                key={item.id}
                style={[
                    styles.card,
                    { backgroundColor: theme.card },
                    (isLocked || !hasStock) && { opacity: 0.7 }
                ]}
                onPress={() => router.push(`/rewards/${item.id}`)}
                activeOpacity={0.8}
            >
                <View>
                    {item.image_url ? (
                        <Image
                            source={{
                                uri: item.image_url.startsWith('http')
                                    ? item.image_url
                                    : `${API_URL}${item.image_url}`
                            }}
                            style={styles.image}
                        />
                    ) : (
                        <View style={[styles.placeholder, { backgroundColor: theme.border }]}>
                            <Ionicons name="gift-outline" size={32} color={theme.icon} />
                        </View>
                    )}

                    <View style={styles.imageOverlay}>
                        <RewardBadge
                            type={item.reward_type}
                            value={item.discount_value}
                            variant="overlay"
                        />
                    </View>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    {item.target_name && (
                        <Text style={[styles.targetName, { color: theme.primary }]} numberOfLines={1}>
                            for {item.target_name}
                        </Text>
                    )}

                    <View style={styles.metaRow}>
                        <View style={styles.badge}>
                            <Ionicons name="star" size={12} color={theme.primary} />
                            <Text style={[styles.badgeText, { color: theme.primary }]}>{item.points_cost} pts</Text>
                        </View>

                        {!isStockUnlimited && (
                            <View style={styles.badge}>
                                <Ionicons name="cube-outline" size={12} color={hasStock ? theme.icon : theme.error} />
                                <Text style={[styles.badgeText, { color: hasStock ? theme.icon : theme.error }]}>
                                    {available} left
                                </Text>
                            </View>
                        )}
                    </View>

                    {isLocked && (
                        <View style={styles.lockRow}>
                            <Ionicons name="lock-closed-outline" size={12} color={theme.icon} />
                            <Text style={[styles.lockText, { color: theme.icon }]}>
                                Requires {item.min_rank_required}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderLuckyDraw = (item: LuckyDraw) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={[styles.luckyDrawCard, { marginBottom: 12 }]}
                onPress={() => router.push(`/rewards/lucky-draw/${item.id}`)}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={['#4c669f', '#3b5998', '#192f6a']}
                    style={styles.luckyDrawGradient}
                >
                    <View style={styles.luckyDrawContent}>
                        <View style={styles.luckyDrawIcon}>
                            <LottieView
                                source={require('@/assets/lottie/Gift.lottie')}
                                autoPlay loop
                                style={{ width: 60, height: 60 }}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.luckyDrawTitle}>{item.name}</Text>
                            <View style={styles.luckyDrawMeta}>
                                <View style={styles.costTag}>
                                    <Ionicons name="star" size={12} color="#FFD700" />
                                    <Text style={styles.costTagText}>
                                        {item.points_cost === 0 ? "FREE" : `${item.points_cost} pts`}
                                    </Text>
                                </View>
                                {item.remaining_spins !== undefined && (
                                    <Text style={styles.spinsText}>{item.remaining_spins} left</Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.playButton}>
                            <Ionicons name="arrow-forward" size={20} color="#4c669f" />
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const isEndReached = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
        const paddingToBottom = 20;
        return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    };

    return (
        <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Catalog</Text>
            </View>

            {/* Filters */}
            <View style={[styles.filterContainer, { backgroundColor: theme.background }]}>
                {/* Content Type Filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {(['all', 'rewards', 'lucky_draws'] as ContentType[]).map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.filterChip,
                                contentType === type && { backgroundColor: theme.primary },
                                contentType !== type && { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
                            ]}
                            onPress={() => setContentType(type)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { color: contentType === type ? '#000' : theme.text }
                            ]}>
                                {type === 'all' ? 'All' : type === 'rewards' ? 'Rewards' : 'Lucky Draws'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Category Filter (if showing rewards) */}
                {(contentType === 'all' || contentType === 'rewards') && categories.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                !selectedCategory && { backgroundColor: theme.primary },
                                selectedCategory && { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
                            ]}
                            onPress={() => setSelectedCategory(null)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { color: !selectedCategory ? '#000' : theme.text }
                            ]}>
                                All Categories
                            </Text>
                        </TouchableOpacity>
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.filterChip,
                                    selectedCategory === cat && { backgroundColor: theme.primary },
                                    selectedCategory !== cat && { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[
                                    styles.filterChipText,
                                    { color: selectedCategory === cat ? '#000' : theme.text }
                                ]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                    }
                    onScroll={({ nativeEvent }) => {
                        if (isEndReached(nativeEvent)) {
                            loadMore();
                        }
                    }}
                    scrollEventThrottle={400}
                >
                    {/* Lucky Draws Section */}
                    {(contentType === 'all' || contentType === 'lucky_draws') && luckyDraws.length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                            <Text style={[styles.sectionHeader, { color: theme.text }]}>Lucky Draws</Text>
                            {luckyDraws.map(renderLuckyDraw)}
                        </View>
                    )}

                    {/* Rewards Grid */}
                    {(contentType === 'all' || contentType === 'rewards') && (
                        <>
                            {contentType === 'all' && rewards.length > 0 && (
                                <Text style={[styles.sectionHeader, { color: theme.text }]}>Rewards</Text>
                            )}
                            <View style={styles.grid}>
                                {rewards.map(renderReward)}
                            </View>
                        </>
                    )}

                    {/* Load More Indicator */}
                    {loadingMore && (
                        <View style={{ paddingVertical: 20 }}>
                            <ActivityIndicator size="small" color={theme.primary} />
                        </View>
                    )}

                    {/* End Message */}
                    {!hasMore && rewards.length > 0 && (
                        <Text style={[styles.endMessage, { color: theme.icon }]}>
                            You've reached the end
                        </Text>
                    )}

                    {/* Empty State */}
                    {rewards.length === 0 && luckyDraws.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="gift-outline" size={64} color={theme.icon} />
                            <Text style={[styles.emptyText, { color: theme.icon }]}>
                                No items available
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    filterContainer: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    filterRow: {
        paddingHorizontal: 16,
        gap: 8,
        paddingVertical: 4,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: 16,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    image: {
        width: '100%',
        height: 120,
        resizeMode: 'cover',
    },
    placeholder: {
        width: '100%',
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    targetName: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        gap: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    lockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    lockText: {
        fontSize: 10,
        fontStyle: 'italic',
        textTransform: 'capitalize',
    },
    imageOverlay: {
        position: 'absolute',
        top: 8,
        left: 8,
    },
    luckyDrawCard: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    luckyDrawGradient: {
        padding: 16,
    },
    luckyDrawContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    luckyDrawIcon: {
        width: 60,
        height: 60,
    },
    luckyDrawTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 6,
    },
    luckyDrawMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    costTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    costTagText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 12,
    },
    spinsText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    endMessage: {
        textAlign: 'center',
        fontSize: 14,
        marginTop: 20,
        marginBottom: 10,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
    },
});
