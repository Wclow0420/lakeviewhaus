import { RewardBadge } from '@/components/ui/RewardBadge';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface Reward {
    id: number;
    title: string;
    description?: string;
    image_url?: string;
    category?: string;
    points_cost: number;
    min_rank_required: string;
    is_active: boolean;
    stock_quantity?: number;
    available_stock?: number;

    // New Fields
    reward_type: string;
    discount_value?: number;
    target_name?: string;
    branch_id?: number; // If null, all branches
}

const RANK_HIERARCHY: Record<string, number> = {
    'bronze': 0,
    'silver': 1,
    'gold': 2,
    'platinum': 3
};

export default function RewardCatalogScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [rewards, setRewards] = useState<{ title: string; data: Reward[] }[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [branches, setBranches] = useState<Record<number, string>>({});

    useEffect(() => {
        loadRewards();
    }, []);

    const loadRewards = async () => {
        try {
            setLoading(true);
            const data = await api.rewards.getAvailableRewards();

            // Fetch branches map for lookup (optional optimization)
            // Ideally backend sends branch name, but for now we might show "Branch #ID" or generic
            // Since Reward.to_dict doesn't send branch_name, we might want to just show "Specific Branch"
            // or fetch branches if we really care. For now, "Specific Branch" or just logic.

            // Sort data into sections
            const grouped = data.reduce((acc: any, reward: Reward) => {
                const category = reward.category || 'Other';
                if (!acc[category]) {
                    acc[category] = [];
                }
                acc[category].push(reward);
                return acc;
            }, {});

            const sections = Object.keys(grouped).map(key => ({
                title: key,
                data: grouped[key]
            }));

            setRewards(sections);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load rewards');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        loadRewards();
        setRefreshing(false);
    };


    const renderItem = ({ item }: { item: Reward }) => {
        const isStockUnlimited = item.stock_quantity === null;
        const available = item.available_stock || 0;
        const hasStock = isStockUnlimited || available > 0;

        const userRankLevel = RANK_HIERARCHY[(user?.rank || 'bronze').toLowerCase()] || 0;
        const requiredRankLevel = RANK_HIERARCHY[(item.min_rank_required || '').toLowerCase()] || 0;
        const isLocked = userRankLevel < requiredRankLevel;

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    { backgroundColor: theme.card },
                    (isLocked || !hasStock) && { opacity: 0.7 }
                ]}
                onPress={() => router.push(`/rewards/${item.id}`)}
                activeOpacity={0.8}
            >
                {/* Image */}
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

                    {/* Floating Badges */}
                    <View style={styles.imageOverlay}>
                        <RewardBadge
                            type={item.reward_type}
                            value={item.discount_value}
                            style={styles.typeBadge}
                            variant="overlay"
                        />
                        {item.branch_id && (
                            <View style={[styles.branchBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                                <Ionicons name="storefront" size={10} color="#FFF" />
                                <Text style={styles.branchBadgeText}>Select Branch</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
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

    return (
        <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>All Rewards</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <SectionList
                    sections={rewards}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index, section }) => {
                        // Grid Layout Logic
                        if (index % 2 !== 0) return null; // Skip every other item (handled in pair)

                        const item1 = item;
                        const item2 = section.data[index + 1];

                        return (
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    {renderItem({ item: item1 })}
                                </View>
                                <View style={{ width: 12 }} />
                                <View style={{ flex: 1 }}>
                                    {item2 && renderItem({ item: item2 })}
                                </View>
                            </View>
                        );
                    }}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={[styles.sectionHeader, { color: theme.text, backgroundColor: theme.background }]}>{title}</Text>
                    )}
                    contentContainerStyle={styles.list}
                    stickySectionHeadersEnabled={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                    }
                />
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: 16,
        paddingBottom: 40,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 12,
        paddingVertical: 4,
    },
    card: {
        flex: 1,
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
    // Floating Badges
    imageOverlay: {
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    branchBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    branchBadgeText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#FFF',
    }
});
