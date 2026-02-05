import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RedemptionSuccess } from '../../components/gamification/RedemptionSuccess';
import { Button } from '../../components/ui/Button';
import { RewardBadge } from '../../components/ui/RewardBadge';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { API_URL, api } from '../../services/api';

interface Reward {
    id: string; // Updated to string (UUID)
    title: string;
    description?: string;
    image_url?: string;
    category?: string;
    points_cost: number;
    min_rank_required: string;
    is_active: boolean;
    stock_quantity?: number;
    available_stock?: number;
    validity_days: number;
    terms_and_conditions?: string;

    // New Fields
    reward_type: string;
    discount_value?: number;
    target_name?: string;
    branch_name?: string;
    branch_id?: number;
}

const RANK_HIERARCHY: Record<string, number> = {
    'bronze': 0,
    'silver': 1,
    'gold': 2,
    'platinum': 3
};

export default function RewardDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user, refreshProfile } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const insets = useSafeAreaInsets();

    const [reward, setReward] = useState<Reward | null>(null);
    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        loadReward();
    }, [id]);

    const loadReward = async () => {
        try {
            setLoading(true);
            // Ensure id is treated as string and not cast to Number which causes NaN for UUIDs
            const data = await api.rewards.getReward(String(id));
            setReward(data);
        } catch (error) {
            console.error('Failed to load reward', error);
            Alert.alert('Error', 'Failed to load reward details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async () => {
        if (!reward || !user) return;

        // Validation Checks
        const userRankLevel = RANK_HIERARCHY[(user.rank || '').toLowerCase()] || 0;
        const requiredRankLevel = RANK_HIERARCHY[(reward.min_rank_required || '').toLowerCase()] || 0;

        if (userRankLevel < requiredRankLevel) {
            Alert.alert("Locked Reward", `You need to reach ${reward.min_rank_required} rank to redeem this.`);
            return;
        }

        if ((user.points_balance || user.points || 0) < reward.points_cost) {
            Alert.alert("Insufficient Points", "You don't have enough points for this reward.");
            return;
        }

        Alert.alert(
            "Confirm Redemption",
            `Redeem "${reward.title}" for ${reward.points_cost} points?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Redeem",
                    style: "default",
                    onPress: async () => {
                        try {
                            setRedeeming(true);
                            await api.rewards.redeemReward(reward.id); // Passing ID as is (string)
                            await refreshProfile(); // Refresh points balance
                            setShowSuccess(true);
                        } catch (error: any) {
                            Alert.alert("Redemption Failed", error.error || "Unable to redeem reward.");
                        } finally {
                            setRedeeming(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading || !reward) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const hasStock = reward.stock_quantity === null || (reward.available_stock || 0) > 0;
    const isLocked = (RANK_HIERARCHY[(user?.rank || 'bronze').toLowerCase()] || 0) < (RANK_HIERARCHY[(reward.min_rank_required || '').toLowerCase()] || 0);

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {/* Image Header */}
                <View style={styles.imageContainer}>
                    {reward.image_url ? (
                        <Image
                            source={{ uri: reward.image_url.startsWith('http') ? reward.image_url : `${API_URL}${reward.image_url}` }}
                            style={styles.image}
                        />
                    ) : (
                        <View style={[styles.placeholderImage, { backgroundColor: theme.border }]}>
                            <Ionicons name="gift-outline" size={64} color={theme.icon} />
                        </View>
                    )}

                    {/* Back Button Overlay */}
                    <View style={[styles.headerOverlay, { top: insets.top + 10 }]}>
                        <View style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" onPress={() => router.back()} />
                        </View>
                    </View>
                </View>

                {/* Content */}
                <View style={[styles.content, { backgroundColor: theme.background }]}>
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <RewardBadge
                                    type={reward.reward_type}
                                    value={reward.discount_value}
                                />
                                {isLocked && (
                                    <View style={[styles.badgeContainer, { backgroundColor: '#757575' }]}>
                                        <Ionicons name="lock-closed" size={10} color="#FFF" style={{ marginRight: 2 }} />
                                        <Text style={styles.badgeText}>Locked</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.title, { color: theme.text }]}>{reward.title}</Text>
                        </View>

                        <View style={styles.pointsBadge}>
                            <Ionicons name="star" size={16} color={theme.primary} />
                            <Text style={[styles.pointsText, { color: theme.primary }]}>
                                {reward.points_cost} pts
                            </Text>
                        </View>
                    </View>

                    {reward.target_name && (
                        <Text style={[styles.targetText, { color: theme.primary }]}>
                            Redeemable for: <Text style={{ fontWeight: '700' }}>{reward.target_name}</Text>
                        </Text>
                    )}

                    {/* Meta Values */}
                    <View style={styles.infoGrid}>
                        {/* Rank */}
                        <View style={styles.infoItem}>
                            <Ionicons name="trophy-outline" size={20} color={theme.icon} />
                            <View>
                                <Text style={[styles.infoLabel, { color: theme.icon }]}>Required Level</Text>
                                <Text style={[styles.infoValue, { color: theme.text }]}>{reward.min_rank_required}</Text>
                            </View>
                        </View>

                        {/* Stock */}
                        <View style={styles.infoItem}>
                            <Ionicons name="cube-outline" size={20} color={theme.icon} />
                            <View>
                                <Text style={[styles.infoLabel, { color: theme.icon }]}>Availability</Text>
                                <Text style={[styles.infoValue, { color: hasStock ? theme.success : theme.error }]}>
                                    {reward.stock_quantity === null ? 'Unlimited' : `${reward.available_stock} Left`}
                                </Text>
                            </View>
                        </View>

                        {/* Location / Branch */}
                        <View style={styles.infoItem}>
                            <Ionicons name="storefront-outline" size={20} color={theme.icon} />
                            <View>
                                <Text style={[styles.infoLabel, { color: theme.icon }]}>Location</Text>
                                <Text style={[styles.infoValue, { color: theme.text }]}>
                                    {reward.branch_name || 'All Branches'}
                                </Text>
                            </View>
                        </View>

                        {/* Validity */}
                        <View style={styles.infoItem}>
                            <Ionicons name="time-outline" size={20} color={theme.icon} />
                            <View>
                                <Text style={[styles.infoLabel, { color: theme.icon }]}>Validity</Text>
                                <Text style={[styles.infoValue, { color: theme.text }]}>{reward.validity_days} Days</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={[styles.sectionHeader, { color: theme.text }]}>Description</Text>
                    <Text style={[styles.description, { color: theme.text }]}>
                        {reward.description || 'No description provided.'}
                    </Text>

                    {reward.terms_and_conditions && (
                        <>
                            <Text style={[styles.sectionHeader, { color: theme.text }]}>Terms & Conditions</Text>
                            <Text style={[styles.terms, { color: theme.icon }]}>
                                {reward.terms_and_conditions}
                            </Text>
                        </>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Bar */}
            <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
                <Button
                    title={
                        !hasStock ? "Out of Stock" :
                            isLocked ? `Locked (Requires ${reward.min_rank_required})` :
                                `Redeem for ${reward.points_cost} pts`
                    }
                    onPress={handleRedeem}
                    loading={redeeming}
                    disabled={!hasStock || isLocked || redeeming}
                    style={{
                        opacity: (!hasStock || isLocked) ? 0.6 : 1,
                        backgroundColor: (!hasStock || isLocked) ? theme.border : theme.primary
                    }}
                    textStyle={{
                        color: (!hasStock || isLocked) ? theme.icon : '#000'
                    }}
                />
            </View>

            {/* Success Animation Modal */}
            <RedemptionSuccess
                visible={showSuccess}
                rewardName={reward.title}
                onClose={() => {
                    setShowSuccess(false);
                    router.back();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        height: 300,
        width: '100%',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerOverlay: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -24,
        paddingBottom: 40,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
        gap: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 4,
        lineHeight: 30,
    },
    targetText: {
        fontSize: 14,
        marginBottom: 20,
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    pointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF3CD',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    pointsText: {
        fontSize: 16,
        fontWeight: '700',
    },

    // Grid Info
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    infoItem: {
        width: '47%', // 2 per row
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(128,128,128,0.05)',
        padding: 12,
        borderRadius: 12,
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'capitalize',
    },

    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 10,
        marginTop: 8,
    },
    description: {
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 24,
    },
    terms: {
        fontSize: 13,
        lineHeight: 20,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        borderTopWidth: 1,
    },
});
