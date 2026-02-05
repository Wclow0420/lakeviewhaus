import { BaseModal } from '@/components/ui/BaseModal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (width - 72) / 3; // 3 items per row with padding

interface Branch {
    id: number;
    name: string;
    location: string;
    is_main: boolean;
    logo_url?: string;
}

interface BranchSelectorProps {
    selectedBranchId: number | null;
    onSelectBranch: (branch: Branch) => void;
}

export function BranchSelector({ selectedBranchId, onSelectBranch }: BranchSelectorProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

    useEffect(() => {
        loadBranches();
    }, []);

    // Sync prop changes (e.g. navigation from Home)
    useEffect(() => {
        if (branches.length > 0 && selectedBranchId) {
            const found = branches.find(b => b.id === selectedBranchId);
            if (found && found.id !== selectedBranch?.id) {
                setSelectedBranch(found);
            }
        }
    }, [selectedBranchId, branches]);

    const loadBranches = async () => {
        setLoading(true);
        try {
            const data = await api.customer.getBranches();
            setBranches(data);
            if (data.length > 0) {
                if (!selectedBranchId) {
                    // Auto select first if none and no prop
                    onSelectBranch(data[0]);
                    setSelectedBranch(data[0]);
                } else {
                    // Prop provided initially
                    const found = data.find((b: Branch) => b.id === selectedBranchId);
                    if (found) setSelectedBranch(found);
                }
            }
        } catch (e) {
            console.error("Failed to load branches", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (branch: Branch) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedBranch(branch);
        onSelectBranch(branch);
        setModalVisible(false);
    };

    return (
        <View style={styles.wrapper}>
            {/* Top Row: Title + Search */}
            <View style={styles.topRow}>
                <Text style={[styles.pageTitle, { color: theme.text }]}>Menu</Text>
                <View style={[styles.searchContainer, { backgroundColor: theme.inputBackground }]}>
                    <Ionicons name="search" size={16} color={theme.icon} style={{ marginRight: 8 }} />
                    <Text style={{ color: theme.icon, fontSize: 14 }}>Search menu...</Text>
                </View>
            </View>

            {/* Bottom Row: Branch Selector */}
            <TouchableOpacity
                style={styles.selectorRow}
                onPress={() => {
                    Haptics.selectionAsync();
                    setModalVisible(true);
                }}
            >
                <View>
                    <View style={styles.branchNameRow}>
                        <Text style={[styles.branchName, { color: theme.text }]}>
                            {selectedBranch ? selectedBranch.name : (loading ? "Loading..." : "Select Store")}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={theme.text} style={{ marginLeft: 4 }} />
                    </View>
                    {selectedBranch && (
                        <Text style={[styles.subtext, { color: theme.icon }]}>
                            {selectedBranch.location} • 40m away
                        </Text>
                    )}
                </View>
            </TouchableOpacity>

            {/* Modal */}
            <BaseModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title="Select Store"
                scrollable={false}
            >
                <View style={{ flex: 1, paddingHorizontal: 24 }}>
                    {loading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={branches}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={3}
                            columnWrapperStyle={styles.gridRow}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.gridItem}
                                    onPress={() => handleSelect(item)}
                                >
                                    <View style={[
                                        styles.imageContainer,
                                        { backgroundColor: theme.background },
                                        item.id === selectedBranchId && {
                                            borderColor: theme.primary,
                                            borderWidth: 3
                                        }
                                    ]}>
                                        {item.logo_url ? (
                                            <Image
                                                source={{ uri: item.logo_url.startsWith('http') ? item.logo_url : `${API_URL}${item.logo_url}` }}
                                                style={styles.branchImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <Ionicons name="storefront-outline" size={40} color={theme.icon} />
                                        )}
                                    </View>
                                    <Text
                                        numberOfLines={2}
                                        style={[
                                            styles.gridBranchName,
                                            {
                                                color: item.id === selectedBranchId ? theme.primary : theme.text,
                                                fontWeight: item.id === selectedBranchId ? '700' : '600'
                                            }
                                        ]}
                                    >
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    )}
                </View>
            </BaseModal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        zIndex: 100,
        backgroundColor: 'transparent',
        paddingBottom: 8,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginRight: 16,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 12,
    },
    selectorRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    branchNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    branchName: {
        fontSize: 16,
        fontWeight: '600',
    },
    subtext: {
        fontSize: 12,
    },
    gridRow: {
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    gridItem: {
        width: GRID_ITEM_WIDTH,
        alignItems: 'center',
    },
    imageContainer: {
        width: GRID_ITEM_WIDTH,
        height: GRID_ITEM_WIDTH,
        borderRadius: GRID_ITEM_WIDTH / 2,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    branchImage: {
        width: '100%',
        height: '100%',
    },
    gridBranchName: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 2,
    },
    hqBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    hqText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
