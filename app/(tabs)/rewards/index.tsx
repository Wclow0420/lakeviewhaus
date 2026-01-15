import { CheckInSuccess } from '@/components/gamification/CheckInSuccess';
import { RewardBadge } from '@/components/ui/RewardBadge';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

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
}

const RANK_HIERARCHY: Record<string, number> = {
    'bronze': 0,
    'silver': 1,
    'gold': 2,
    'platinum': 3
};

export default function RewardsScreen() {
    const { user, refreshProfile } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // ... (rest of state items are fine, not modifying them here)
    const [streak, setStreak] = useState(0);
    const [canCheckIn, setCanCheckIn] = useState(false);
    const [currentDay, setCurrentDay] = useState(1);
    const [checkedDays, setCheckedDays] = useState<number[]>([]);

    const [rewards, setRewards] = useState<{ title: string; data: Reward[] }[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [pointsEarned, setPointsEarned] = useState(0);
    const [prizeDesc, setPrizeDesc] = useState<string | undefined>(undefined);
    const [isLuckyDraw, setIsLuckyDraw] = useState(false);

    // ... fetchData logic ...

    // Fetch data
    const fetchData = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const [status, rewardsData] = await Promise.all([
                api.getCheckInStatus(),
                api.rewards.getAvailableRewards()
            ]);

            setStreak(status.total_streak);
            setCanCheckIn(status.can_check_in);
            setCurrentDay(status.cycle_day || 1);

            const checked = [];
            for (let i = 1; i < status.cycle_day; i++) {
                checked.push(i);
            }
            if (!status.can_check_in) {
                checked.push(status.cycle_day);
            }
            setCheckedDays(checked);

            if (status.points !== undefined) {
                // refreshProfile(); 
            }

            const grouped = rewardsData.reduce((acc: any, reward: Reward) => {
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

        } catch (e) {
            console.log("Error fetching data", e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Refresh on Focus (stale data fix)
    useFocusEffect(
        useCallback(() => {
            fetchData(true);
        }, [fetchData])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData(true);
        await refreshProfile();
        setRefreshing(false);
    };

    const handleCheckIn = async () => {
        if (!canCheckIn) {
            Alert.alert("Already Checked In", "You have already checked in today. Come back tomorrow!");
            return;
        }

        try {
            const res = await api.performCheckIn();
            setStreak(res.streak);
            setPointsEarned(res.points_added);
            setPrizeDesc(res.prize);
            setIsLuckyDraw(res.cycle_day === 7);
            setCanCheckIn(false);
            setCheckedDays([...checkedDays, currentDay]);
            setShowCheckIn(true);

            refreshProfile();
            api.getCheckInStatus();
        } catch (e: any) {
            Alert.alert("Check In Failed", e.error || "Something went wrong.");
        }
    };

    const renderDay = (dayNumber: number) => {
        // ... unchanged ...
        const isChecked = checkedDays.includes(dayNumber);
        const isCurrent = dayNumber === currentDay;

        return (
            <View key={dayNumber} style={styles.dayContainer}>
                <View
                    style={[
                        styles.dayCircle,
                        {
                            backgroundColor: isChecked ? theme.primary : theme.card,
                            borderColor: isCurrent && !isChecked ? theme.primary : 'transparent',
                            borderWidth: isCurrent && !isChecked ? 2 : 0,
                        }
                    ]}
                >
                    {isChecked ? (
                        <Ionicons name="checkmark" size={20} color="#000" />
                    ) : (
                        <Text style={[styles.dayNumber, { color: isCurrent ? theme.primary : theme.icon }]}>
                            {dayNumber}
                        </Text>
                    )}
                </View>
                <Text style={[styles.dayLabel, { color: theme.icon }]}>Day {dayNumber}</Text>
                {dayNumber === 7 && (
                    <View style={styles.luckyBadge}>
                        <Ionicons name="gift" size={10} color="#FFF" />
                    </View>
                )}
            </View>
        );
    };

    const renderRewardItem = (item: Reward, index: number) => {
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
                    styles.rewardCard,
                    { backgroundColor: theme.card },
                    (isLocked || !hasStock) && { opacity: 0.7 }
                ]}
                onPress={() => router.push(`/rewards/${item.id}`)}
                disabled={!hasStock && !isLocked}
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
                            style={styles.rewardImage}
                        />
                    ) : (
                        <View style={[styles.rewardPlaceholder, { backgroundColor: theme.border }]}>
                            <Ionicons name="gift-outline" size={32} color={theme.icon} />
                        </View>
                    )}
                    {/* Overlay Badge */}
                    <RewardBadge
                        type={item.reward_type}
                        value={item.discount_value}
                        variant="overlay"
                    />
                </View>

                {/* Lock Overlay */}
                {isLocked && (
                    <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={24} color="#FFF" />
                    </View>
                )}

                <View style={styles.rewardContent}>
                    <Text
                        style={[styles.rewardTitle, { color: theme.text }]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    {item.target_name && (
                        <Text style={{ fontSize: 10, color: theme.primary, marginBottom: 4 }} numberOfLines={1}>
                            for {item.target_name}
                        </Text>
                    )}

                    <View style={styles.rewardMeta}>
                        {/* Points */}
                        <View style={styles.metaBadge}>
                            <Ionicons name="star" size={12} color={theme.primary} />
                            <Text style={[styles.metaText, { color: theme.primary }]}>
                                {item.points_cost}pts
                            </Text>
                        </View>

                        {/* Stock */}
                        <View style={styles.metaBadge}>
                            {isStockUnlimited ? (
                                <Ionicons name="infinite" size={14} color={theme.icon} />
                            ) : (
                                <>
                                    <Ionicons name="cube-outline" size={12} color={theme.icon} />
                                    <Text style={[styles.metaText, { color: theme.icon }]}>
                                        {available}
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Rank Label if locked */}
                    {isLocked && (
                        <Text style={[styles.lockedText, { color: theme.icon }]}>
                            {item.min_rank_required} Rank
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Rewards</Text>
                        <Text style={[styles.headerSubtitle, { color: theme.icon }]}>
                            Current Rank: <Text style={{ color: theme.primary, textTransform: 'capitalize' }}>{user?.rank || 'bronze'}</Text>
                        </Text>
                    </View>
                    <View style={styles.pointsStack}>
                        {/* Lifetime Points */}
                        <View style={styles.pointsRow}>
                            <Text style={[styles.pointsLabel, { color: theme.icon }]}>Total:</Text>
                            <Text style={[styles.pointsValue, { color: theme.text }]}>
                                {user?.points_lifetime || user?.points || 0} pts
                            </Text>
                        </View>
                        {/* Usable Points */}
                        <View style={styles.pointsRow}>
                            <Text style={[styles.pointsLabel, { color: theme.icon }]}>Usable:</Text>
                            <Text style={[styles.pointsValue, { color: theme.text }]}>
                                {user?.points_balance || user?.points || 0} pts
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Check-In Calendar Card */}
                <LinearGradient
                    colors={['#FFF5E1', '#FFE4B5', '#FFDAB9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.checkInCard}
                >
                    <View style={styles.checkInHeader}>
                        <View>
                            <Text style={styles.checkInTitle}>Daily Check-In</Text>
                            <Text style={styles.checkInSubtitle}>
                                {canCheckIn ? "Check in to earn rewards!" : "Come back tomorrow!"}
                            </Text>
                        </View>
                        <View style={styles.streakBadge}>
                            <Ionicons name="flame" size={16} color="#FF4500" />
                            <Text style={styles.streakText}>{streak}</Text>
                        </View>
                    </View>

                    {/* 7-Day Calendar */}
                    <View style={styles.calendarContainer}>
                        {[1, 2, 3, 4, 5, 6, 7].map(renderDay)}
                    </View>

                    {/* Check-In Button */}
                    <TouchableOpacity
                        style={[
                            styles.checkInButton,
                            {
                                backgroundColor: canCheckIn ? '#000' : 'rgba(0,0,0,0.1)',
                                opacity: canCheckIn ? 1 : 0.7
                            }
                        ]}
                        onPress={handleCheckIn}
                        disabled={!canCheckIn}
                    >
                        <Text style={[styles.checkInButtonText, { color: canCheckIn ? '#FFF' : '#666' }]}>
                            {canCheckIn ? 'Check In Now' : 'Already Checked In'}
                        </Text>
                        {canCheckIn && <Ionicons name="arrow-forward" size={18} color="#FFF" />}
                    </TouchableOpacity>
                </LinearGradient>

                {/* Rewards Sections */}
                {loading ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
                ) : rewards.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.icon }]}>No rewards available yet.</Text>
                ) : (
                    rewards.map((section, sectionIndex) => (
                        <View key={section.title} style={{ marginBottom: 24 }}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                                {/* Only show View More on first section or manage per section if needed */}
                                {sectionIndex === 0 && (
                                    <TouchableOpacity onPress={() => router.push('/rewards/catalog')}>
                                        <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.horizontalList}
                            >
                                {section.data.slice(0, 5).map((item, index) => renderRewardItem(item, index))}

                                {/* View More Card at end of each section */}
                                <TouchableOpacity
                                    style={[styles.viewMoreCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                                    onPress={() => router.push('/rewards/catalog')}
                                >
                                    <View style={[styles.viewMoreIcon, { backgroundColor: theme.primary + '20' }]}>
                                        <Ionicons name="arrow-forward" size={24} color={theme.primary} />
                                    </View>
                                    <Text style={[styles.viewMoreText, { color: theme.text }]}>View More</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Check-In Success Modal */}
            <CheckInSuccess
                visible={showCheckIn}
                streakDays={streak}
                pointsEarned={pointsEarned}
                prizeDescription={prizeDesc}
                isLuckyDraw={isLuckyDraw}
                onClose={() => setShowCheckIn(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    pointsStack: {
        gap: 4,
        alignItems: 'flex-end',
    },
    pointsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pointsLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    pointsValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    checkInCard: {
        marginHorizontal: 20,
        marginBottom: 32,
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    checkInHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    checkInTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#000',
        marginBottom: 4,
    },
    checkInSubtitle: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    streakText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FF4500',
    },
    calendarContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    dayContainer: {
        alignItems: 'center',
        position: 'relative',
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    dayNumber: {
        fontSize: 14,
        fontWeight: '700',
    },
    dayLabel: {
        fontSize: 10,
        fontWeight: '500',
    },
    luckyBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FF4500',
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    checkInButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    checkInButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    seeAll: {
        fontSize: 14,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    },
    horizontalList: {
        paddingHorizontal: 20,
        gap: 16,
        paddingBottom: 20,
    },
    rewardCard: {
        width: 160,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    rewardImage: {
        width: '100%',
        height: 100,
        resizeMode: 'cover',
    },
    rewardPlaceholder: {
        width: '100%',
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rewardContent: {
        padding: 12,
    },
    rewardTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    rewardMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '600',
    },
    lockOverlay: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    lockedText: {
        fontSize: 10,
        fontStyle: 'italic',
        marginTop: 6,
    },
    viewMoreCard: {
        width: 100,
        height: 160, // Match Approx Reward Card Height (100 img + ~60 content)
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    viewMoreIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    viewMoreText: {
        fontSize: 12,
        fontWeight: '600',
    }
});
