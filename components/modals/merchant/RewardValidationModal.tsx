import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Image,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RewardValidationModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    rewardData: {
        can_redeem: boolean;
        error_message?: string;
        redemption: any;
        reward: any;
        user: {
            username: string;
            rank: string;
        };
    };
}

export const RewardValidationModal: React.FC<RewardValidationModalProps> = ({
    visible,
    onClose,
    onSuccess,
    rewardData
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const insets = useSafeAreaInsets();

    const [validating, setValidating] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const handleValidate = async () => {
        if (!rewardData.can_redeem) {
            Alert.alert('Cannot Redeem', rewardData.error_message || 'This reward cannot be redeemed.');
            return;
        }

        setValidating(true);
        try {
            await api.rewards.validateRedemption(rewardData.redemption.redemption_code);
            onSuccess();
        } catch (error: any) {
            Alert.alert('Error', error.error || 'Failed to validate reward');
        } finally {
            setValidating(false);
        }
    };

    const getRankColor = (rank: string) => {
        switch (rank.toLowerCase()) {
            case 'platinum':
                return '#E5E4E2';
            case 'gold':
                return '#FFD700';
            case 'silver':
                return '#C0C0C0';
            default:
                return '#A17F5D';
        }
    };

    // Swipe to confirm component
    interface SwipeToConfirmProps {
        canRedeem: boolean;
        validating: boolean;
        onValidate: () => void;
        theme: any;
    }

    const SwipeToConfirm: React.FC<SwipeToConfirmProps> = ({
        canRedeem,
        validating,
        onValidate,
        theme
    }) => {
        const thumbSize = 60;
        const [containerWidth, setContainerWidth] = useState(300);
        const maxSwipe = containerWidth - thumbSize - 8;

        const pan = useRef(new Animated.Value(0)).current;

        // Use refs to keep track of latest props for PanResponder closures
        const stateRef = useRef({ canRedeem, validating, maxSwipe });
        useEffect(() => {
            stateRef.current = { canRedeem, validating, maxSwipe };
        }, [canRedeem, validating, maxSwipe]);

        const panResponder = useRef(
            PanResponder.create({
                onStartShouldSetPanResponder: () => !stateRef.current.validating && stateRef.current.canRedeem,
                onMoveShouldSetPanResponder: () => !stateRef.current.validating && stateRef.current.canRedeem,
                onPanResponderGrant: () => {
                    // Light haptic feedback to indicate touch
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                },
                onPanResponderMove: (_, gestureState) => {
                    const { maxSwipe } = stateRef.current;
                    if (gestureState.dx >= 0 && gestureState.dx <= maxSwipe) {
                        pan.setValue(gestureState.dx);
                    }
                },
                onPanResponderRelease: (_, gestureState) => {
                    const { maxSwipe } = stateRef.current;

                    if (gestureState.dx >= maxSwipe * 0.7) {
                        // Swipe completed - trigger haptic feedback
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Animated.spring(pan, {
                            toValue: maxSwipe,
                            useNativeDriver: false
                        }).start(() => {
                            onValidate();
                        });
                    } else {
                        // Swipe not completed, return to start
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Animated.spring(pan, {
                            toValue: 0,
                            useNativeDriver: false,
                            tension: 40,
                            friction: 8
                        }).start();
                    }
                },
                onPanResponderTerminate: () => {
                    Animated.spring(pan, {
                        toValue: 0,
                        useNativeDriver: false,
                        tension: 40,
                        friction: 8
                    }).start();
                },
                onPanResponderTerminationRequest: () => false, // Prevent parent from stealing gesture
            })
        ).current;

        return (
            <View
                style={[styles.swipeContainer, {
                    backgroundColor: canRedeem ? theme.card : theme.border,
                    opacity: canRedeem ? 1 : 0.5
                }]}
                onLayout={(event) => {
                    const { width } = event.nativeEvent.layout;
                    setContainerWidth(width);
                }}
            >
                <Text style={[styles.swipeText, { color: theme.icon }]}>
                    {canRedeem ? 'Swipe to confirm' : 'Cannot redeem'}
                </Text>
                {canRedeem && (
                    <Animated.View
                        style={[
                            styles.swipeThumb,
                            {
                                backgroundColor: validating ? '#9E9E9E' : theme.primary,
                                transform: [{ translateX: pan }]
                            }
                        ]}
                        {...panResponder.panHandlers}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        {validating ? (
                            <Ionicons name="hourglass" size={24} color="#000" />
                        ) : (
                            <Ionicons name="chevron-forward" size={24} color="#000" />
                        )}
                    </Animated.View>
                )}
            </View>
        );
    };

    // Helper to render action instructions based on reward type
    // Helper to render action instructions based on reward type
    const renderActionDetails = () => {
        const { reward_type, discount_value, target_name, target_scope } = rewardData.reward;

        // Define styles for action box
        const containerStyle = {
            backgroundColor: '#E3F2FD',
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: '#2196F3'
        };
        const labelStyle = { fontSize: 12, fontWeight: '700' as const, color: '#1565C0', marginBottom: 4, textTransform: 'uppercase' as const };
        const valueStyle = { fontSize: 18, fontWeight: '700' as const, color: '#0D47A1' };

        if (reward_type === 'free_item') {
            return (
                <View style={containerStyle}>
                    <Text style={labelStyle}>Action Required: Provide Item</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="gift" size={24} color="#1565C0" />
                        <View>
                            <Text style={valueStyle}>{target_name || 'Free Product'}</Text>
                            {target_scope === 'category' && <Text style={{ fontSize: 12, color: '#1565C0', fontStyle: 'italic' }}>Any item from this category</Text>}
                        </View>
                    </View>
                </View>
            );
        }

        if (reward_type === 'discount_percentage') {
            return (
                <View style={[containerStyle, { backgroundColor: '#E8F5E9', borderLeftColor: '#4CAF50' }]}>
                    <Text style={[labelStyle, { color: '#2E7D32' }]}>Action Required: Apply Discount</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="pricetag" size={24} color="#2E7D32" />
                        <Text style={[valueStyle, { color: '#1B5E20' }]}>{discount_value}% OFF</Text>
                    </View>
                    {target_name && (
                        <Text style={{ color: '#388E3C', marginTop: 4, fontWeight: '600' }}>
                            {target_scope === 'category' ? `Valid for all items in '${target_name}'` : `Valid for: ${target_name}`}
                        </Text>
                    )}
                </View>
            );
        }

        if (reward_type === 'cash_voucher' || reward_type === 'discount_fixed') {
            return (
                <View style={[containerStyle, { backgroundColor: '#FFF3E0', borderLeftColor: '#FF9800' }]}>
                    <Text style={[labelStyle, { color: '#EF6C00' }]}>Action Required: Deduct Value</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="wallet" size={24} color="#EF6C00" />
                        <Text style={[valueStyle, { color: '#E65100' }]}>RM {Number(discount_value).toFixed(2)}</Text>
                    </View>
                    {target_name && target_scope !== 'order' && (
                        <Text style={{ color: '#E65100', marginTop: 4 }}>
                            {target_scope === 'category' ? `Valid for items in '${target_name}'` : `Valid for: ${target_name}`}
                        </Text>
                    )}
                </View>
            );
        }

        return null;
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Validate Reward"
            scrollable={false}
            presentationStyle="fullScreen"
            containerStyle={{
                paddingTop: Platform.OS === 'ios' ? Math.max(20, insets.top) : undefined
            }}
        >
            <View style={styles.modalContent}>
                {/* Scrollable Content */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Error Message */}
                    {!rewardData.can_redeem && rewardData.error_message && (
                        <View style={[styles.errorBanner, { backgroundColor: '#FFEBEE' }]}>
                            <Ionicons name="alert-circle" size={24} color="#F44336" />
                            <Text style={[styles.errorText, { color: '#C62828' }]}>
                                {rewardData.error_message}
                            </Text>
                        </View>
                    )}

                    {/* Reward Image */}
                    {rewardData.reward.image_url && (
                        <Image
                            source={{
                                uri: rewardData.reward.image_url.startsWith('http')
                                    ? rewardData.reward.image_url
                                    : `${API_URL}${rewardData.reward.image_url}`
                            }}
                            style={styles.rewardImage}
                        />
                    )}

                    {/* Reward Info */}
                    <View style={styles.infoSection}>
                        <Text style={[styles.rewardTitle, { color: theme.text }]}>
                            {rewardData.reward.title}
                        </Text>
                        {rewardData.reward.description && (
                            <Text style={[styles.rewardDescription, { color: theme.icon }]}>
                                {rewardData.reward.description}
                            </Text>
                        )}
                    </View>

                    {/* Action Details (What merchant gives) */}
                    {renderActionDetails()}

                    {/* Customer Info */}
                    <View style={[styles.customerCard, { backgroundColor: theme.card }]}>
                        <View style={styles.customerHeader}>
                            <Ionicons name="person-circle-outline" size={24} color={theme.icon} />
                            <Text style={[styles.customerLabel, { color: theme.icon }]}>Customer</Text>
                        </View>
                        <View style={styles.customerInfo}>
                            <Text style={[styles.customerName, { color: theme.text }]}>
                                {rewardData.user.username}
                            </Text>
                            <View style={styles.rankBadge}>
                                <Ionicons name="trophy" size={14} color={getRankColor(rewardData.user.rank)} />
                                <Text style={[styles.rankText, { color: getRankColor(rewardData.user.rank) }]}>
                                    {rewardData.user.rank.charAt(0).toUpperCase() + rewardData.user.rank.slice(1)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Redemption Details */}
                    <View style={[styles.detailsCard, { backgroundColor: theme.card }]}>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: theme.icon }]}>Redemption Code</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>
                                {rewardData.redemption.redemption_code}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: theme.icon }]}>Points Spent</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>
                                {rewardData.redemption.points_spent} pts
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: theme.icon }]}>Redeemed On</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>
                                {formatDate(rewardData.redemption.redeemed_at)}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: theme.icon }]}>Expires On</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>
                                {formatDate(rewardData.redemption.expires_at)}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: theme.icon }]}>Status</Text>
                            <Text style={[
                                styles.detailValue,
                                {
                                    color: rewardData.redemption.status === 'active' ? '#4CAF50' : theme.text
                                }
                            ]}>
                                {rewardData.redemption.status.charAt(0).toUpperCase() + rewardData.redemption.status.slice(1)}
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                {/* Sticky Swipe to Confirm at Bottom */}
                <View style={[styles.stickyBottom, { backgroundColor: theme.background }]}>
                    {rewardData.can_redeem && (
                        <Text style={[styles.swipeHint, { color: theme.icon }]}>
                            <Ionicons name="hand-left-outline" size={14} color={theme.icon} /> Swipe right to validate
                        </Text>
                    )}
                    <SwipeToConfirm
                        canRedeem={rewardData.can_redeem}
                        validating={validating}
                        onValidate={handleValidate}
                        theme={theme}
                    />
                </View>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    modalContent: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100, // Extra padding to ensure content doesn't get hidden behind sticky button
    },
    stickyBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.1)',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    swipeHint: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    rewardImage: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        marginBottom: 20,
    },
    infoSection: {
        marginBottom: 20,
    },
    rewardTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    rewardDescription: {
        fontSize: 14,
        lineHeight: 20,
    },
    customerCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    customerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    customerLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    customerInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    customerName: {
        fontSize: 18,
        fontWeight: '700',
    },
    rankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    rankText: {
        fontSize: 12,
        fontWeight: '700',
    },
    detailsCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    swipeContainer: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    swipeText: {
        fontSize: 14,
        fontWeight: '600',
        position: 'absolute',
    },
    swipeThumb: {
        width: 60,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        left: 4,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
});
