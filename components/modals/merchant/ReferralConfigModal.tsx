import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
            // Load current config
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

    const renderRewardItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[
                styles.rewardItem,
                { borderBottomColor: theme.border },
                (selectingFor === 'referrer' && referrerRewardId === item.id) && { backgroundColor: theme.primary + '10' },
                (selectingFor === 'referee' && refereeRewardId === item.id) && { backgroundColor: theme.primary + '10' }
            ]}
            onPress={() => {
                if (selectingFor === 'referrer') setReferrerRewardId(item.id);
                if (selectingFor === 'referee') setRefereeRewardId(item.id);
                setSelectingFor(null); // Close selection
            }}
        >
            <View>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: theme.icon, fontSize: 12 }}>
                    {item.reward_type === 'free_item' ? 'Free Item' :
                        item.reward_type === 'discount_percentage' ? `${item.discount_value}% Off` :
                            `RM ${item.discount_value} Off`}
                </Text>
            </View>
            {((selectingFor === 'referrer' && referrerRewardId === item.id) ||
                (selectingFor === 'referee' && refereeRewardId === item.id)) && (
                    <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Selected</Text>
                )}
        </TouchableOpacity>
    );

    return (
        <BaseModal visible={visible} onClose={onClose} title="Referral Program Settings">
            {selectingFor ? (
                <View style={{ flex: 1, maxHeight: 400, paddingHorizontal: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                        <Text style={{ color: theme.text, fontWeight: 'bold' }}>
                            Select Reward for {selectingFor === 'referrer' ? 'Referrer' : 'Referee'}
                        </Text>
                        <TouchableOpacity onPress={() => setSelectingFor(null)}>
                            <Text style={{ color: theme.primary }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.rewardItem, { borderBottomColor: theme.border }]}
                        onPress={() => {
                            if (selectingFor === 'referrer') setReferrerRewardId(null);
                            if (selectingFor === 'referee') setRefereeRewardId(null);
                            setSelectingFor(null);
                        }}
                    >
                        <Text style={{ color: theme.icon, fontStyle: 'italic' }}>No Reward</Text>
                    </TouchableOpacity>

                    <FlatList
                        data={rewards}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderRewardItem}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>
            ) : (
                <View style={{ paddingHorizontal: 10 }}>
                    <Text style={{ color: theme.icon, marginBottom: 20 }}>
                        Configure the rewards given when a new user registers using a referral code.
                    </Text>

                    <Text style={[styles.label, { color: theme.text }]}>Reward for Referrer (Inviter)</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => setSelectingFor('referrer')}
                    >
                        <Text style={{ color: referrerRewardId ? theme.text : theme.icon }}>
                            {referrerRewardId
                                ? rewards.find(r => r.id === referrerRewardId)?.title || 'Selected (Loading...)'
                                : 'Select a reward...'}
                        </Text>
                    </TouchableOpacity>
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: theme.text, width: 60, fontSize: 13 }}>Points:</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border, flex: 1 }]}
                            placeholder="0"
                            placeholderTextColor={theme.icon}
                            keyboardType="numeric"
                            value={referrerPoints}
                            onChangeText={setReferrerPoints}
                        />
                    </View>

                    <Text style={[styles.label, { color: theme.text, marginTop: 16 }]}>Reward for Referee (New User)</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => setSelectingFor('referee')}
                    >
                        <Text style={{ color: refereeRewardId ? theme.text : theme.icon }}>
                            {refereeRewardId
                                ? rewards.find(r => r.id === refereeRewardId)?.title || 'Selected (Loading...)'
                                : 'Select a reward...'}
                        </Text>
                    </TouchableOpacity>
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: theme.text, width: 60, fontSize: 13 }}>Points:</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.border, flex: 1 }]}
                            placeholder="0"
                            placeholderTextColor={theme.icon}
                            keyboardType="numeric"
                            value={refereePoints}
                            onChangeText={setRefereePoints}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: theme.primary }]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save Settings</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    selector: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 4,
    },
    saveButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    saveText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    rewardItem: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    input: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 14,
    }
});
