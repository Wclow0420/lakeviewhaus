import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReferralScreen() {
    const { user, refreshProfile } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [inputCode, setInputCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [referralInfo, setReferralInfo] = useState<any>(null);

    useEffect(() => {
        refreshProfile(); // Ensure we have latest referred_by_id
        api.get('/auth/referral-info').then(setReferralInfo).catch(console.error);
    }, []);

    const handleCopy = async () => {
        if (user?.referral_code) {
            await Clipboard.setStringAsync(user.referral_code);
            Alert.alert('Copied', 'Referral code copied to clipboard!');
        }
    };

    const handleShare = async () => {
        if (user?.referral_code) {
            try {
                await Share.share({
                    message: `Join me on Lakeview Haus! Use my referral code ${user.referral_code} to get ${referralInfo?.referee_reward?.title || 'rewards'}!`,
                });
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleSubmitCode = async () => {
        if (!inputCode.trim()) {
            Alert.alert('Error', 'Please enter a code');
            return;
        }
        if (inputCode.trim().toUpperCase() === user?.referral_code) {
            Alert.alert('Error', 'Cannot use your own code');
            return;
        }

        try {
            setSubmitting(true);
            await api.submitReferral(inputCode);
            await refreshProfile(); // Refresh to update referred_by_id and hide section
            Alert.alert('Success', 'Referral code applied! Check your rewards.');
            setInputCode('');
        } catch (error: any) {
            Alert.alert('Error', error.error || 'Failed to apply code');
        } finally {
            setSubmitting(false);
        }
    };

    const getRewardDetailText = (reward: any) => {
        if (!reward) return '';
        if (reward.reward_type === 'discount_percentage') {
            return `${reward.discount_value}% OFF`;
        } else if (reward.reward_type === 'discount_fixed') {
            return `RM ${reward.discount_value} OFF`;
        } else if (reward.reward_type === 'free_item') {
            return 'FREE ITEM';
        }
        return '';
    };

    const renderRewardInfo = () => {
        if (!referralInfo) return null;
        const { referrer_reward, referee_reward, referrer_points, referee_points } = referralInfo;

        const hasReferrerReward = referrer_reward || (referrer_points > 0);
        const hasRefereeReward = referee_reward || (referee_points > 0);

        if (!hasReferrerReward && !hasRefereeReward) return null;

        return (
            <View style={[styles.rewardInfoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.rewardTitle, { color: theme.primary }]}>DOUBLE THE REWARDS</Text>
                <View style={styles.rewardRow}>
                    {hasReferrerReward && (
                        <View style={styles.rewardItem}>
                            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                                <Ionicons name="gift-outline" size={24} color={theme.primary} />
                            </View>
                            <Text style={[styles.rewardLabel, { color: theme.icon }]}>YOU GET</Text>

                            {referrer_reward && (
                                <>
                                    <Text style={[styles.rewardValue, { color: theme.text }]} numberOfLines={2}>
                                        {referrer_reward.title}
                                    </Text>
                                    <Text style={{ color: theme.primary, fontWeight: '800', marginTop: 2, fontSize: 12 }}>
                                        {getRewardDetailText(referrer_reward)}
                                    </Text>
                                </>
                            )}

                            {referrer_points > 0 && (
                                <Text style={{ color: '#F57C00', fontWeight: 'bold', marginTop: 4 }}>
                                    + {referrer_points} Points
                                </Text>
                            )}
                        </View>
                    )}

                    {hasReferrerReward && hasRefereeReward && <View style={[styles.divider, { backgroundColor: theme.border }]} />}

                    {hasRefereeReward && (
                        <View style={styles.rewardItem}>
                            <View style={[styles.iconCircle, { backgroundColor: '#4CAF5020' }]}>
                                <Ionicons name="person-add-outline" size={24} color="#4CAF50" />
                            </View>
                            <Text style={[styles.rewardLabel, { color: theme.icon }]}>THEY GET</Text>

                            {referee_reward && (
                                <>
                                    <Text style={[styles.rewardValue, { color: theme.text }]} numberOfLines={2}>
                                        {referee_reward.title}
                                    </Text>
                                    <Text style={{ color: '#4CAF50', fontWeight: '800', marginTop: 2, fontSize: 12 }}>
                                        {getRewardDetailText(referee_reward)}
                                    </Text>
                                </>
                            )}

                            {referee_points > 0 && (
                                <Text style={{ color: '#F57C00', fontWeight: 'bold', marginTop: 4 }}>
                                    + {referee_points} Points
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <ScreenWrapper withScrollView style={{ backgroundColor: theme.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Refer & Earn</Text>
            </View>

            <View style={styles.container}>
                {/* Rewards Dynamic Banner */}
                {renderRewardInfo()}

                {/* Hero Section */}
                <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
                    <Text style={styles.heroTitle}>Invite Friends</Text>
                    <Text style={styles.heroSubtitle}>Share your code and earn rewards together!</Text>

                    <View style={styles.codeContainer}>
                        <Text style={styles.codeLabel}>YOUR CODE</Text>
                        <Text style={styles.codeText}>{user?.referral_code || '---'}</Text>
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                            <Ionicons name="copy-outline" size={20} color={theme.primary} />
                            <Text style={[styles.actionText, { color: theme.primary }]}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={20} color="#FFF" />
                            <Text style={styles.actionText2}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Enter Code Section - Only show if not referred yet */}
                {!user?.referred_by_id ? (
                    <View style={[styles.inputSection, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Have a Referral Code?</Text>
                        <Text style={[styles.sectionDesc, { color: theme.icon }]}>
                            Enter your friend's code to unlock special rewards.
                        </Text>

                        <View style={styles.inputRow}>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                placeholder="Enter Code"
                                placeholderTextColor={theme.icon}
                                value={inputCode}
                                onChangeText={setInputCode}
                                autoCapitalize="characters"
                            />
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                                onPress={handleSubmitCode}
                                disabled={submitting}
                            >
                                <Text style={styles.submitText}>{submitting ? '...' : 'Apply'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.successBanner, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <Text style={[styles.successText, { color: '#2E7D32' }]}> You have been referred!</Text>
                    </View>
                )}

                <View style={styles.tips}>
                    <Ionicons name="information-circle-outline" size={20} color={theme.icon} />
                    <Text style={{ color: theme.icon, marginLeft: 8, flex: 1, fontSize: 13 }}>
                        Rewards are automatically credited to your account upon successful referral verification.
                    </Text>
                </View>
            </View>
            <View style={{ height: 40 }} />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    backButton: {
        padding: 5,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    container: {
        padding: 16,
    },
    rewardInfoCard: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 24,
        alignItems: 'center',
    },
    rewardTitle: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 16,
    },
    rewardRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        width: '100%',
    },
    rewardItem: {
        flex: 1,
        alignItems: 'center',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    rewardLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    rewardValue: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    divider: {
        width: 1,
        height: '80%',
        marginHorizontal: 16,
        alignSelf: 'center',
    },
    heroCard: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 6,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 24,
        textAlign: 'center',
    },
    codeContainer: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    codeLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        letterSpacing: 1,
        marginBottom: 4,
    },
    codeText: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 2,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#FFF',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        gap: 8,
    },
    actionText: {
        fontWeight: '600',
    },
    actionText2: {
        fontWeight: '600',
        color: '#FFF',
    },
    inputSection: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    sectionDesc: {
        fontSize: 14,
        marginBottom: 16,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 10,
    },
    input: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    submitButton: {
        width: 80,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
        justifyContent: 'center',
        gap: 8
    },
    successText: {
        fontWeight: '600',
        fontSize: 16,
    },
    tips: {
        flexDirection: 'row',
        padding: 10,
        alignItems: 'center',
    }
});
