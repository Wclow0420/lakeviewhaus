import { Badge } from '@/components/ui/Badge';
import { SettingsModal } from '@/components/modals/user/SettingsModal';
import { TransactionHistoryModal } from '@/components/modals/user/TransactionHistoryModal';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, RANKS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');



export default function ProfileScreen() {
    const { logout, user, refreshProfile } = useAuth();
    const { unreadCount } = useNotifications();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // State
    const [activeVouchersCount, setActiveVouchersCount] = useState(0);
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Mock data
    const referralCode = user?.referral_code || '---';
    const totalReferrals = 0;

    // Fetch profile data
    const fetchProfileData = async () => {
        try {
            const [rewards, statusRes] = await Promise.all([
                api.rewards.getMyRewards('active').catch(() => []),
                api.getCheckInStatus().catch(() => ({ total_streak: 0 }))
            ]);

            setActiveVouchersCount(rewards.length);

            if (statusRes) {
                setStreak(statusRes.total_streak || 0);
            }
        } catch (error) {
            console.error('Failed to fetch profile data:', error);
        }
    };

    // Fetch data when screen is focused
    useFocusEffect(
        useCallback(() => {
            refreshProfile();
            fetchProfileData();
        }, [refreshProfile])
    );

    const handleReferralPress = () => {
        router.push('/referral');
    };

    const handleVouchersPress = () => {
        router.push('/rewards/vouchers');
    };

    const handleSettingsPress = () => {
        setShowSettings(true);
    };

    // Rank Logic
    const points = user?.points_lifetime || user?.points || 0;
    let rank: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' = 'Bronze';
    if (points >= 5000) {
        rank = 'Platinum';
    } else if (points >= 2000) {
        rank = 'Gold';
    } else if (points >= 500) {
        rank = 'Silver';
    }

    const currentStyle = RANKS[rank];

    return (
        <ScreenWrapper withScrollView={true} style={{ paddingHorizontal: 0 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>

                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.avatar, { backgroundColor: theme.primary, overflow: 'hidden' }]}>
                            {user?.profile_pic_url ? (
                                <Image
                                    source={{ uri: user.profile_pic_url.startsWith('http') ? user.profile_pic_url : `${api.API_URL}${user.profile_pic_url}` }}
                                    style={{ width: '100%', height: '100%' }}
                                />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user?.username?.[0]?.toUpperCase() || 'U'}
                                </Text>
                            )}
                        </View>
                        <View>
                            <Text style={[styles.userName, { color: theme.text }]}>
                                {user?.username || 'Guest'}
                            </Text>
                            <LinearGradient
                                colors={currentStyle.gradient as any}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.rankBadge, { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }]}
                            >
                                <Ionicons name="trophy" size={12} color={rank === 'Platinum' ? '#FFF' : '#443203'} />
                                <Text style={[styles.rankText, { color: rank === 'Platinum' ? '#FFF' : '#443203' }]}>
                                    {rank} Member
                                </Text>
                            </LinearGradient>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.iconButton}>
                            <Ionicons name="notifications-outline" size={24} color={theme.text} />
                            <Badge count={unreadCount} style={{ top: 4, right: 4 }} size={16} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={logout} style={styles.iconButton}>
                            <Ionicons name="log-out-outline" size={24} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Dashboard Grid */}
                <View style={styles.gridContainer}>
                    <View style={styles.leftCol}>
                        <TouchableOpacity
                            onPress={handleReferralPress}
                            style={[styles.card, styles.bigCard, { backgroundColor: theme.card }]}
                        >
                            <View style={styles.cardHeaderRow}>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>
                                    My{'\n'}Referral
                                </Text>
                                {totalReferrals > 0 && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                            </View>

                            <View style={styles.bigCardContent}>
                                <Ionicons
                                    name="people-outline"
                                    size={60}
                                    color={theme.primary}
                                />
                                <Text style={[styles.bigNum, { color: theme.text }]}>
                                    {totalReferrals} Friends
                                </Text>
                                <Text style={[styles.referralCode, { color: theme.icon }]}>
                                    Code: {referralCode}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.rightCol}>
                        <TouchableOpacity
                            style={[styles.card, styles.smallCard, { backgroundColor: theme.card }]}
                            onPress={handleVouchersPress}
                        >
                            <View style={styles.cardHeaderRow}>
                                <Text style={[styles.smallCardTitle, { color: theme.text }]}>Vouchers</Text>
                                {activeVouchersCount > 0 && (
                                    <View style={[styles.voucherBadge, { backgroundColor: theme.primary }]}>
                                        <Text style={styles.voucherBadgeText}>{activeVouchersCount}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.smallCardContent}>
                                <Ionicons name="ticket-outline" size={32} color={theme.secondary} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, styles.smallCard, { backgroundColor: theme.card }]}
                            onPress={handleSettingsPress}
                        >
                            <Text style={[styles.smallCardTitle, { color: theme.text }]}>Settings</Text>
                            <View style={styles.smallCardContent}>
                                <Ionicons name="cog-outline" size={32} color={theme.icon} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Card */}
                <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
                    <View style={styles.statItem}>
                        <Ionicons name="star" size={24} color={theme.primary} />
                        <Text style={[styles.statValue, { color: theme.text }]}>{points}</Text>
                        <Text style={[styles.statLabel, { color: theme.icon }]}>Points</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <TouchableOpacity style={styles.statItem} onPress={() => setShowHistory(true)}>
                        <Ionicons name="receipt-outline" size={24} color={theme.secondary} />
                        <Text style={[styles.statValue, { color: theme.text }]}>{user?.orders_count || 0}</Text>
                        <Text style={[styles.statLabel, { color: theme.icon }]}>Orders</Text>
                    </TouchableOpacity>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <View style={styles.statItem}>
                        <Ionicons name="flame" size={24} color="#FF4500" />
                        <Text style={[styles.statValue, { color: theme.text }]}>{streak}</Text>
                        <Text style={[styles.statLabel, { color: theme.icon }]}>Day Streak</Text>
                    </View>
                </View>

                {/* Banner / Notices */}
                <View style={[styles.banner, { backgroundColor: '#E8F5E9' }]}>
                    <View>
                        <Text style={[styles.bannerTitle, { color: '#2E7D32' }]}>Referral Rewards</Text>
                        <Text style={[styles.bannerDesc, { color: '#388E3C' }]}>
                            Invite friends & earn rewards!
                            {"\n"}Share your code: {referralCode}
                        </Text>
                    </View>
                    <Ionicons name="gift" size={60} color="#81C784" style={{ opacity: 0.8 }} />
                </View>

                <View style={[styles.banner, { backgroundColor: '#FFF3E0', marginTop: 15 }]}>
                    <View>
                        <Text style={[styles.bannerTitle, { color: '#E65100' }]}>Membership Perks</Text>
                        <Text style={[styles.bannerDesc, { color: '#EF6C00' }]}>
                            You're a {rank} member!
                            {rank !== 'Platinum' && '\nKeep earning to unlock more rewards'}
                        </Text>
                    </View>
                    <Ionicons name="trophy" size={60} color={currentStyle.accent} style={{ opacity: 0.6 }} />
                </View>
            </View>

            <TransactionHistoryModal
                visible={showHistory}
                onClose={() => setShowHistory(false)}
            />
            <SettingsModal
                visible={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </ScreenWrapper >
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 140,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerRight: {
        flexDirection: 'row',
        gap: 10,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#000',
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    rankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    rankText: {
        fontSize: 12,
        fontWeight: '600',
    },
    iconButton: {
        padding: 8,
    },

    // Grid
    gridContainer: {
        flexDirection: 'row',
        height: 200,
        gap: 12,
        marginBottom: 20,
    },
    leftCol: {
        flex: 1.2,
    },
    rightCol: {
        flex: 1,
        flexDirection: 'column',
        gap: 12,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
    },
    bigCard: {
        flex: 1,
    },
    smallCard: {
        flex: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    bigCardContent: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    bigNum: {
        fontSize: 20,
        fontWeight: '800',
        marginTop: 10,
    },
    referralCode: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    smallCardTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    voucherBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    voucherBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#000',
    },
    smallCardContent: {
        alignItems: 'flex-end',
    },

    // Stats Card
    statsCard: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    divider: {
        width: 1,
        height: 50,
    },

    // Banner
    banner: {
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
    },
    bannerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bannerDesc: {
        fontSize: 12,
        lineHeight: 18,
    },
});


