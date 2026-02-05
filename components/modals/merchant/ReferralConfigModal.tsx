import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ReferralConfigModalProps {
    visible: boolean;
    onClose: () => void;
}

export const ReferralConfigModal = ({ visible, onClose }: ReferralConfigModalProps) => {
    const { user, refreshProfile } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [rewards, setRewards] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [referrerRewardId, setReferrerRewardId] = useState<number | null>(null);
    const [refereeRewardId, setRefereeRewardId] = useState<number | null>(null);
    const [referrerPoints, setReferrerPoints] = useState('');
    const [refereePoints, setRefereePoints] = useState('');

    const [selectingFor, setSelectingFor] = useState<'referrer' | 'referee' | null>(null);

    useEffect(() => {
        if (visible) {
            fetchRewards();
            const config = user?.referral_config;
            if (config) {
                setReferrerRewardId(config.referral_referrer_reward_id || null);
                setRefereeRewardId(config.referral_referee_reward_id || null);
                setReferrerPoints(config.referral_referrer_points ? config.referral_referrer_points.toString() : '');
                setRefereePoints(config.referral_referee_points ? config.referral_referee_points.toString() : '');
            }
        }
    }, [visible, user]);

    const fetchRewards = async () => {
        try {
            setLoading(true);
            const data = await api.rewards.getRewards({ active_only: true });
            setRewards(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load rewards');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            await api.merchant.updateProfile({
                referral_referrer_reward_id: referrerRewardId,
                referral_referee_reward_id: refereeRewardId,
                referral_referrer_points: referrerPoints ? parseInt(referrerPoints) : 0,
                referral_referee_points: refereePoints ? parseInt(refereePoints) : 0
            });
            await refreshProfile();
            Alert.alert('Success', 'Referral program updated');
            onClose();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const getRewardLabel = (rewardId: number | null) => {
        if (!rewardId) return null;
        const reward = rewards.find(r => r.id === rewardId);
        return reward?.title || 'Selected (Loading...)';
    };

    const getRewardSubLabel = (item: any) => {
        if (item.reward_type === 'free_item') return 'Free Item';
        if (item.reward_type === 'discount_percentage') return `${item.discount_value}% Off`;
        return `RM ${item.discount_value} Off`;
    };

    return (
        <BaseModal
            visible={visible}
            onClose={selectingFor ? () => setSelectingFor(null) : onClose}
            title={selectingFor
                ? `Select Reward for ${selectingFor === 'referrer' ? 'Referrer' : 'Referee'}`
                : 'Referral Program Settings'
            }
            scrollable={false}
        >
            {selectingFor ? (
                /* Reward selection list */
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <TouchableOpacity
                        style={[styles.rewardItem, { borderBottomColor: theme.border }]}
                        onPress={() => {
                            if (selectingFor === 'referrer') setReferrerRewardId(null);
                            if (selectingFor === 'referee') setRefereeRewardId(null);
                            setSelectingFor(null);
                        }}
                    >
                        <Text style={[styles.rewardNoReward, { color: theme.icon }]}>No Reward</Text>
                    </TouchableOpacity>

                    {rewards.map(item => {
                        const currentId = selectingFor === 'referrer' ? referrerRewardId : refereeRewardId;
                        const isSelected = currentId === item.id;
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.rewardItem,
                                    { borderBottomColor: theme.border },
                                    isSelected && { backgroundColor: theme.primary + '10' }
                                ]}
                                onPress={() => {
                                    if (selectingFor === 'referrer') setReferrerRewardId(item.id);
                                    if (selectingFor === 'referee') setRefereeRewardId(item.id);
                                    setSelectingFor(null);
                                }}
                            >
                                <View>
                                    <Text style={[styles.rewardTitle, { color: theme.text }]}>{item.title}</Text>
                                    <Text style={[styles.rewardSubtitle, { color: theme.icon }]}>{getRewardSubLabel(item)}</Text>
                                </View>
                                {isSelected && (
                                    <Text style={[styles.rewardSelected, { color: theme.primary }]}>Selected</Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : (
                /* Main form */
                <View style={styles.formWrapper}>
                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                        <View style={styles.form}>
                            <Text style={[styles.description, { color: theme.icon }]}>
                                Configure the rewards given when a new user registers using a referral code.
                            </Text>

                            {/* Referrer */}
                            <Text style={[styles.sectionLabel, { color: theme.text }]}>Reward for Referrer (Inviter)</Text>
                            <TouchableOpacity
                                style={[styles.selector, { backgroundColor: theme.card, borderColor: theme.border }]}
                                onPress={() => setSelectingFor('referrer')}
                            >
                                <Text style={[styles.selectorText, { color: referrerRewardId ? theme.text : theme.icon }]}>
                                    {getRewardLabel(referrerRewardId) || 'Select a reward...'}
                                </Text>
                            </TouchableOpacity>
                            <Input
                                label="Bonus Points"
                                value={referrerPoints}
                                onChangeText={setReferrerPoints}
                                placeholder="0"
                                keyboardType="numeric"
                            />

                            {/* Referee */}
                            <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 8 }]}>Reward for Referee (New User)</Text>
                            <TouchableOpacity
                                style={[styles.selector, { backgroundColor: theme.card, borderColor: theme.border }]}
                                onPress={() => setSelectingFor('referee')}
                            >
                                <Text style={[styles.selectorText, { color: refereeRewardId ? theme.text : theme.icon }]}>
                                    {getRewardLabel(refereeRewardId) || 'Select a reward...'}
                                </Text>
                            </TouchableOpacity>
                            <Input
                                label="Bonus Points"
                                value={refereePoints}
                                onChangeText={setRefereePoints}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: theme.border }]}>
                        <View style={styles.buttonRow}>
                            <View style={styles.buttonHalf}>
                                <Button variant="outline" title="Cancel" onPress={onClose} disabled={loading} />
                            </View>
                            <View style={styles.buttonHalf}>
                                <Button variant="primary" title="Save" onPress={handleSave} loading={loading} />
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    formWrapper: {
        flex: 1,
    },
    form: {
        padding: 16,
    },
    description: {
        fontSize: 14,
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    selector: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
    },
    selectorText: {
        fontSize: 15,
    },
    rewardItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rewardNoReward: {
        fontStyle: 'italic',
    },
    rewardTitle: {
        fontWeight: '600',
    },
    rewardSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    rewardSelected: {
        fontWeight: 'bold',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    buttonHalf: {
        flex: 1,
    },
});
