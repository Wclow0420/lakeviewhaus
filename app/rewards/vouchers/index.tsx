import { RewardQRModal } from '@/components/modals/user/RewardQRModal';
import { RewardBadge } from '@/components/ui/RewardBadge';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { socketService } from '@/services/socket';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

interface UserReward {
    id: number;
    reward_id: number;
    redemption_code: string;
    status: 'active' | 'used' | 'expired' | 'cancelled';
    points_spent: number;
    redeemed_at: string;
    expires_at: string;
    used_at?: string;
    used_at_branch_name?: string;
    valid_at_branch_name?: string;
    reward: {
        title: string;
        description: string;
        image_url: string;
        reward_type: string;
        discount_value?: number;
        target_name?: string;
    };
}

export default function VouchersScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [rewards, setRewards] = useState<UserReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedReward, setSelectedReward] = useState<UserReward | null>(null);
    const [qrModalVisible, setQrModalVisible] = useState(false);

    const fetchRewards = async (isRefreshing = false) => {
        try {
            if (!isRefreshing) setLoading(true);
            const data = await api.rewards.getMyRewards();
            setRewards(data);
        } catch (error) {
            console.error('Failed to fetch rewards:', error);
            Alert.alert('Error', 'Failed to load your vouchers');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Socket Listener for Real-Time Updates
    useEffect(() => {
        const handleNewNotification = (data: any) => {
            if (data.type === 'voucher_redeemed') {
                const redemptionCode = data.data?.redemption_code;

                // 1. Update List
                setRewards(prevRewards => prevRewards.map(r => {
                    if (r.redemption_code === redemptionCode) {
                        return { ...r, status: 'used', used_at: new Date().toISOString() };
                    }
                    return r;
                }));

                // 2. Update Modal if open
                if (selectedReward && selectedReward.redemption_code === redemptionCode) {
                    setSelectedReward(prev => prev ? { ...prev, status: 'used' } : null);
                }
            }
        };

        socketService.on('new_notification', handleNewNotification);

        return () => {
            socketService.off('new_notification', handleNewNotification);
        };
    }, [selectedReward]);

    useFocusEffect(
        useCallback(() => {
            fetchRewards();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchRewards(true);
    };

    const handleRewardPress = (reward: UserReward) => {
        if (reward.status === 'active') {
            setSelectedReward(reward);
            setQrModalVisible(true);
        }
    };

    const handleCloseQRModal = () => {
        setQrModalVisible(false);
        setSelectedReward(null);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return '#4CAF50';
            case 'used':
                return '#9E9E9E';
            case 'expired':
                return '#F44336';
            case 'cancelled':
                return '#FF9800';
            default:
                return theme.icon;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active': return 'Active';
            case 'used': return 'Used';
            case 'expired': return 'Expired';
            case 'cancelled': return 'Cancelled';
            default: return status;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const renderTicket = (reward: UserReward) => {
        const isActive = reward.status === 'active';
        const statusColor = getStatusColor(reward.status);
        const imageUrl = reward.reward?.image_url;

        return (
            <TouchableOpacity
                key={reward.id}
                style={[
                    styles.ticketContainer,
                    { backgroundColor: theme.card, opacity: isActive ? 1 : 0.8 }
                ]}
                onPress={() => handleRewardPress(reward)}
                activeOpacity={isActive ? 0.7 : 1}
                disabled={!isActive}
            >
                {/* Top Section */}
                <View style={styles.ticketTop}>
                    {/* Image */}
                    {imageUrl ? (
                        <Image
                            source={{
                                uri: imageUrl.startsWith('http')
                                    ? imageUrl
                                    : `${API_URL}${imageUrl}`
                            }}
                            style={styles.ticketImage}
                        />
                    ) : (
                        <View style={[styles.ticketImagePlaceholder, { backgroundColor: theme.border }]}>
                            <Ionicons name="gift-outline" size={32} color={theme.icon} />
                        </View>
                    )}

                    {/* Content */}
                    <View style={styles.ticketContent}>
                        <View style={styles.ticketHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.ticketTitle, { color: theme.text }]} numberOfLines={1}>
                                    {reward.reward?.title}
                                </Text>
                                {/* Target Item Name (e.g., specific product) */}
                                {reward.reward?.target_name && (
                                    <Text style={[styles.targetName, { color: theme.primary }]}>
                                        {reward.reward.target_name}
                                    </Text>
                                )}
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                                <Text style={styles.statusText}>{getStatusLabel(reward.status)}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                            <RewardBadge
                                type={reward.reward.reward_type}
                                value={reward.reward.discount_value}
                            />
                        </View>

                        {/* Validity / Usage Context */}
                        <View style={styles.contextRow}>
                            {reward.status === 'used' ? (
                                <Text style={[styles.contextText, { color: theme.text }]}>
                                    Used at: <Text style={{ fontWeight: '600' }}>{reward.used_at_branch_name || 'Unknown Branch'}</Text>
                                </Text>
                            ) : (
                                <Text style={[styles.contextText, { color: theme.icon }]}>
                                    Valid at: <Text style={{ fontWeight: '600', color: theme.text }}>
                                        {reward.valid_at_branch_name || 'All Branches'}
                                    </Text>
                                </Text>
                            )}
                        </View>

                        <View style={styles.ticketInfo}>
                            <View style={styles.infoRow}>
                                <Ionicons name="calendar-outline" size={12} color={theme.icon} />
                                <Text style={[styles.infoText, { color: theme.icon }]}>
                                    Expires: {formatDate(reward.expires_at)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Dashed Line Separator */}
                <View style={styles.dashedSeparator}>
                    <View style={[styles.semicircleLeft, { backgroundColor: theme.background }]} />
                    <View style={[styles.dashedLine, { borderColor: theme.border }]} />
                    <View style={[styles.semicircleRight, { backgroundColor: theme.background }]} />
                </View>

                {/* Bottom Section */}
                <View style={styles.ticketBottom}>
                    <View style={styles.codeContainer}>
                        <Text style={[styles.codeLabel, { color: theme.icon }]}>Code</Text>
                        <Text style={[styles.codeValue, { color: theme.text }]}>
                            {reward.redemption_code}
                        </Text>
                    </View>
                    {isActive && (
                        <View style={styles.tapHint}>
                            <Ionicons name="qr-code-outline" size={20} color={theme.icon} />
                            <Text style={[styles.tapHintText, { color: theme.icon }]}>Tap to show QR</Text>
                        </View>
                    )}
                    {reward.used_at && (
                        <Text style={[styles.usedAtText, { color: theme.icon }]}>
                            Used on {formatDate(reward.used_at)}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const activeRewards = rewards.filter(r => r.status === 'active');
    const usedRewards = rewards.filter(r => r.status === 'used');
    const expiredRewards = rewards.filter(r => r.status === 'expired' || r.status === 'cancelled');

    return (
        <ScreenWrapper withScrollView={false}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Vouchers</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : rewards.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="ticket-outline" size={80} color={theme.icon} />
                    <Text style={[styles.emptyText, { color: theme.text }]}>No vouchers yet</Text>
                    <Text style={[styles.emptySubtext, { color: theme.icon }]}>
                        Redeem rewards to see them here
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                    }
                >
                    {/* Active Rewards */}
                    {activeRewards.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                Active ({activeRewards.length})
                            </Text>
                            {activeRewards.map(renderTicket)}
                        </View>
                    )}

                    {/* Used Rewards */}
                    {usedRewards.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                Used ({usedRewards.length})
                            </Text>
                            {usedRewards.map(renderTicket)}
                        </View>
                    )}

                    {/* Expired Rewards */}
                    {expiredRewards.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                Expired ({expiredRewards.length})
                            </Text>
                            {expiredRewards.map(renderTicket)}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* QR Code Modal */}
            {selectedReward && (
                <RewardQRModal
                    visible={qrModalVisible}
                    onClose={handleCloseQRModal}
                    rewardTitle={selectedReward.reward.title}
                    redemptionCode={selectedReward.redemption_code}
                    expiresAt={selectedReward.expires_at}
                    rewardDescription={selectedReward.reward.description}
                    status={selectedReward.status}
                />
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: 20,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },

    // Ticket Styles
    ticketContainer: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    ticketTop: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    ticketImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    ticketImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ticketContent: {
        flex: 1,
        gap: 6,
    },
    ticketHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
    },
    ticketTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    targetName: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    discountBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    discountBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    contextRow: {
        marginTop: 4,
    },
    contextText: {
        fontSize: 12,
    },
    ticketInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    infoText: {
        fontSize: 11,
        fontWeight: '500',
    },

    // Dashed Separator
    dashedSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 20,
    },
    semicircleLeft: {
        width: 20,
        height: 20,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        marginLeft: -10,
    },
    dashedLine: {
        flex: 1,
        height: 1,
        borderTopWidth: 2,
        borderStyle: 'dashed',
    },
    semicircleRight: {
        width: 20,
        height: 20,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        marginRight: -10,
    },

    // Bottom Section
    ticketBottom: {
        padding: 16,
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    codeContainer: {
        gap: 2,
    },
    codeLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    codeValue: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 2,
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tapHintText: {
        fontSize: 11,
        fontWeight: '600',
    },
    usedAtText: {
        fontSize: 11,
    },
});
