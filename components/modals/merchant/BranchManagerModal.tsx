import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { BaseModal } from '@/components/ui/BaseModal';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface Branch {
    id: number;
    name: string;
    username: string;
    location: string;
    is_main: boolean;
    is_active: boolean;
    points_multiplier: number;
}

interface BranchManagerModalProps {
    visible: boolean;
    onClose: () => void;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({ visible, onClose }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [branches, setBranches] = useState<Branch[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);

    // Create Branch State
    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    // Fields
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [location, setLocation] = useState('');
    const [pointsMultiplier, setPointsMultiplier] = useState('1.0');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchBranches();
            fetchBranches();
            setShowForm(false);
            setEditingBranch(null);
        }
    }, [visible]);

    const fetchBranches = async () => {
        setLoadingBranches(true);
        try {
            const data = await api.get('/merchant/branches');
            setBranches(data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to fetch branches');
        } finally {
            setLoadingBranches(false);
        }
    };

    const openCreate = () => {
        setEditingBranch(null);
        setName(''); setUsername(''); setPassword(''); setLocation('');
        setPointsMultiplier('1.0');
        setShowForm(true);
    };

    const openEdit = (branch: Branch) => {
        setEditingBranch(branch);
        setName(branch.name);
        setUsername(branch.username);
        setPassword('');
        setLocation(branch.location || '');
        setPointsMultiplier((branch.points_multiplier || 1.0).toString());
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!name || !username) {
            Alert.alert('Missing Fields', 'Name and Username are required.');
            return;
        }

        if (!editingBranch && !password) {
            Alert.alert('Missing Fields', 'Password is required for new branches.');
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = { name, username, location };
            if (password) payload.password = password;

            // Add points multiplier
            const multiplier = parseFloat(pointsMultiplier);
            if (isNaN(multiplier) || multiplier < 0) {
                Alert.alert('Invalid Input', 'Points multiplier must be a positive number.');
                setSubmitting(false);
                return;
            }
            payload.points_multiplier = multiplier;

            if (editingBranch) {
                await api.merchant.updateBranch(editingBranch.id, payload);
                Alert.alert('Success', 'Branch updated.');
            } else {
                await api.merchant.createBranch({ ...payload, password }); // Password mandatory for create
                Alert.alert('Success', 'Branch updated.');
            }

            setShowForm(false);
            fetchBranches();
        } catch (error: any) {
            Alert.alert('Error', error.error || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = () => {
        if (!editingBranch) return;
        Alert.alert('Confirm Delete', `Are you sure you want to delete ${editingBranch.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setSubmitting(true);
                    try {
                        await api.merchant.deleteBranch(editingBranch.id);
                        setShowForm(false);
                        fetchBranches();
                    } catch (error: any) {
                        Alert.alert('Error', error.error || 'Failed to delete branch');
                    } finally {
                        setSubmitting(false);
                    }
                }
            }
        ]);
    };

    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
        try {
            setBranches(prev => prev.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
            await api.put(`/merchant/branches/${id}/status`, { is_active: !currentStatus });
        } catch (error) {
            Alert.alert('Error', 'Failed to update status');
            fetchBranches(); // Revert
        }
    };

    const renderBranchItem = ({ item }: { item: Branch }) => (
        <View style={[styles.card, { backgroundColor: theme.card, marginBottom: 12 }]}>
            <View style={styles.cardHeaderRow}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.branchName, { color: theme.text }]}>{item.name}</Text>
                        {item.is_main && (
                            <View style={{ backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold' }}>MAIN HQ</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.details, { color: theme.icon }]}>@{item.username}</Text>
                    <Text style={[styles.details, { color: theme.icon }]}>{item.location || 'No Location Set'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="star" size={12} color={theme.primary} />
                        <Text style={[styles.details, { color: theme.primary, fontWeight: '600' }]}>
                            {item.points_multiplier || 1.0}x Points
                        </Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <TouchableOpacity onPress={() => openEdit(item)}>
                        <Ionicons name="pencil" size={20} color={theme.primary} />
                    </TouchableOpacity>
                    {!item.is_main && (
                        <Switch
                            value={item.is_active}
                            onValueChange={(val) => handleToggleStatus(item.id, val)}
                            disabled={item.is_main}
                        />
                    )}
                </View>
            </View>
            {!item.is_active && (
                <Text style={{ color: 'red', fontSize: 12, marginTop: 4 }}>Inactive (Access Denied)</Text>
            )}
        </View>
    );

    return (
        <BaseModal
            visible={visible}
            onClose={showForm ? () => setShowForm(false) : onClose}
            title={showForm ? (editingBranch ? 'Edit Branch' : 'New Branch') : 'Branches'}
            scrollable={false}
        >

                {showForm ? (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                        style={{ flex: 1 }}
                    >
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={() => setShowForm(false)} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="arrow-back" size={24} color={theme.text} />
                                <Text style={{ color: theme.text, marginLeft: 8, fontSize: 16, fontWeight: '600' }}>
                                    Back to List
                                </Text>
                            </TouchableOpacity>

                            <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 20 }]}>
                                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
                            </Text>

                            <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                                <Input label="Branch Name" value={name} onChangeText={setName} placeholder="Lakeview Haus - Subang" />
                                <Input label="Username (Login ID)" value={username} onChangeText={setUsername} placeholder="lakeview_subang" autoCapitalize="none" />
                                <Input
                                    label={editingBranch ? "New Password (Leave blank to keep current)" : "Password"}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    secureTextEntry
                                />
                                <Input label="Location (Optional)" value={location} onChangeText={setLocation} placeholder="123, Jalan..." />
                                <Input
                                    label="Points Multiplier"
                                    value={pointsMultiplier}
                                    onChangeText={setPointsMultiplier}
                                    placeholder="1.0"
                                    keyboardType="decimal-pad"
                                />
                                <Text style={{ fontSize: 12, color: theme.icon, marginTop: -10 }}>
                                    Set how many points customers earn at this branch. Default is 1.0 (1:1 ratio). Example: 1.5 means RM100 spent = 150 points.
                                </Text>

                                <Button
                                    title={editingBranch ? "Update Branch" : "Create Branch"}
                                    onPress={handleSubmit}
                                    loading={submitting}
                                    style={{ marginTop: 10 }}
                                />

                                {editingBranch && !editingBranch.is_main && (
                                    <Button
                                        title="Delete Branch"
                                        variant="outline"
                                        textStyle={{ color: Colors.light.error }}
                                        style={{ borderColor: Colors.light.error }}
                                        onPress={handleDelete}
                                        loading={submitting}
                                    />
                                )}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                ) : (
                    <View style={{ flex: 1 }}>
                        {loadingBranches ? (
                            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                data={branches}
                                renderItem={renderBranchItem}
                                keyExtractor={item => item.id.toString()}
                                contentContainerStyle={{ paddingBottom: 100 }}
                                ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.icon, marginTop: 40 }}>No branches found</Text>}
                            />
                        )}
                        <TouchableOpacity
                            style={[styles.fab, { backgroundColor: theme.primary }]}
                            onPress={openCreate}
                        >
                            <Ionicons name="add" size={30} color="#000" />
                        </TouchableOpacity>
                    </View>
                )}
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold'
    },
    fab: {
        position: 'absolute',
        bottom: 40,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    card: {
        borderRadius: 12,
        padding: 16,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    branchName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    details: {
        fontSize: 13,
        marginTop: 2,
    }
});
