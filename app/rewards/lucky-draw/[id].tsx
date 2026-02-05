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
    View,
    Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { LuckyDrawSuccess } from '@/components/gamification/LuckyDrawSuccess';

const { width } = Dimensions.get('window');

interface LuckyDrawPrize {
    id: string;
    prize_type: 'points' | 'reward';
    name: string;
    description?: string;
    points_amount?: number;
    reward_id?: string;
    probability_weight: number;
}

interface LuckyDraw {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    points_cost: number;
    prizes: LuckyDrawPrize[];
    start_date: string;
    end_date: string;
    is_active: boolean;
    remaining_spins?: number;
    user_can_spin: boolean;
    user_spins_today: number;
    user_has_enough_points: boolean;
}

// Result of a spin
interface SpinResult {
    prizeName: string;
    prizeType: string;
    value: any;
    pointsEarned?: number;
}

export default function LuckyDrawDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user, refreshProfile } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const insets = useSafeAreaInsets();

    const [draw, setDraw] = useState<LuckyDraw | null>(null);
    const [loading, setLoading] = useState(true);
    const [spinning, setSpinning] = useState(false);

    // Animation State for generic "Success" modal (reusing CheckInSuccess)
    const [showSuccess, setShowSuccess] = useState(false);
    const [spinResult, setSpinResult] = useState<SpinResult | null>(null);

    useEffect(() => {
        loadDraw();
    }, [id]);

    const loadDraw = async () => {
        try {
            setLoading(true);
            const data = await api.userLuckyDraw.getDrawDetails(String(id));
            setDraw(data);
        } catch (error) {
            console.error('Failed to load lucky draw', error);
            Alert.alert('Error', 'Failed to load lucky draw details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleSpin = async () => {
        if (!draw) return;

        if (!draw.user_can_spin) {
            if (!draw.user_has_enough_points) {
                Alert.alert("Insufficient Points", `You need ${draw.points_cost} points to play.`);
            } else if (draw.user_spins_today >= 1) {
                Alert.alert("Daily Limit Reached", "You have reached your limit for today.");
            } else {
                Alert.alert("Unavailable", "This lucky draw is currently unavailable.");
            }
            return;
        }

        Alert.alert(
            "Confirm Spin",
            `Spend ${draw.points_cost} points to spin?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Spin Now",
                    onPress: async () => {
                        try {
                            setSpinning(true);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

                            const response = await api.userLuckyDraw.spin(draw.id, 'points_redemption');

                            // 1. Success! Prepare result
                            const result = {
                                prizeName: response.prize.name,
                                prizeType: response.prize.type,
                                value: response.prize.value,
                                pointsEarned: response.prize.type === 'points' ? response.prize.value.points_amount : 0
                            };
                            setSpinResult(result);

                            // 2. Reload draw (decrement spins)
                            loadDraw();

                            // 3. Show Animation
                            setShowSuccess(true);

                        } catch (error: any) {
                            Alert.alert("Spin Failed", error.error || "Could not complete spin.");
                        } finally {
                            setSpinning(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading || !draw) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {/* Banner / Header */}
                <View style={styles.imageContainer}>
                    <LinearGradient
                        colors={['#4c669f', '#3b5998', '#192f6a']}
                        style={styles.gradientHeader}
                    >
                        <LottieView
                            source={require('@/assets/lottie/Gift.json')}
                            autoPlay loop
                            style={{ width: 150, height: 150 }}
                        />
                    </LinearGradient>

                    {/* Back Button Overlay */}
                    <View style={[styles.headerOverlay, { top: insets.top + 10 }]}>
                        <View style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" onPress={() => router.back()} />
                        </View>
                    </View>
                </View>

                {/* Content */}
                <View style={[styles.content, { backgroundColor: theme.background }]}>
                    <Text style={[styles.title, { color: theme.text }]}>{draw.name}</Text>

                    <View style={styles.pointsBadge}>
                        <Ionicons name="star" size={16} color={theme.primary} />
                        <Text style={[styles.pointsText, { color: theme.primary }]}>
                            {draw.points_cost} pts / Spin
                        </Text>
                    </View>

                    {/* Limits Info */}
                    {draw.remaining_spins !== undefined && (
                        <View style={styles.limitBox}>
                            <Ionicons name="time-outline" size={16} color={theme.primary} style={{ marginRight: 6 }} />
                            <Text style={[styles.limitText, { color: theme.icon }]}>
                                Hurry! Only <Text style={{ fontWeight: '700', color: theme.text }}>{draw.remaining_spins}</Text> spins remaining
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.sectionHeader, { color: theme.text, marginTop: 20 }]}>About</Text>
                    <Text style={[styles.description, { color: theme.text }]}>
                        {draw.description || 'Try your luck and win amazing prizes! Spin the wheel using your loyalty points.'}
                    </Text>

                    {/* Prizes List */}
                    <Text style={[styles.sectionHeader, { color: theme.text }]}>Prizes You Can Win</Text>
                    <View style={styles.prizeList}>
                        {draw.prizes.map((prize, index) => (
                            <View key={prize.id || index} style={[styles.prizeItem, { backgroundColor: theme.card }]}>
                                <View style={[styles.prizeIcon, { backgroundColor: theme.primary + '15' }]}>
                                    <Ionicons
                                        name={prize.prize_type === 'points' ? 'star' : 'gift'}
                                        size={20}
                                        color={theme.primary}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.prizeName, { color: theme.text }]}>{prize.name}</Text>
                                    <Text style={[styles.prizeType, { color: theme.icon }]}>
                                        {prize.prize_type === 'points' ? `+${prize.points_amount} Points` : 'Reward Item'}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Bar */}
            <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: theme.icon, fontSize: 12 }}>My Points: {user?.points_balance || 0}</Text>
                    {!draw.user_has_enough_points && (
                        <Text style={{ color: theme.error, fontSize: 12 }}>Not enough points</Text>
                    )}
                </View>
                <Button
                    title={spinning ? "Spinning..." : `Spin Now (${draw.points_cost} pts)`}
                    onPress={handleSpin}
                    loading={spinning}
                    disabled={!draw.user_can_spin || spinning}
                    style={{
                        opacity: (!draw.user_can_spin) ? 0.6 : 1,
                        backgroundColor: theme.primary
                    }}
                />
            </View>

            {/* Lucky Draw Success Modal */}
            <LuckyDrawSuccess
                visible={showSuccess}
                prizeName={spinResult?.prizeName}
                prizeType={spinResult?.prizeType as any}
                pointsEarned={spinResult?.pointsEarned}
                onClose={() => {
                    setShowSuccess(false);
                    // Refresh profile after animation close to check for rank up
                    setTimeout(() => refreshProfile(), 300);
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
        height: 250,
        width: '100%',
        position: 'relative',
    },
    gradientHeader: {
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
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
    },
    pointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF3CD',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 16,
    },
    pointsText: {
        fontSize: 16,
        fontWeight: '700',
    },
    limitBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    limitText: {
        fontSize: 14,
        fontWeight: '500',
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 24,
    },
    prizeList: {
        gap: 12,
    },
    prizeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 12,
    },
    prizeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    prizeName: {
        fontSize: 15,
        fontWeight: '600',
    },
    prizeType: {
        fontSize: 12,
        opacity: 0.7,
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
