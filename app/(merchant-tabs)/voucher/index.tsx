import { RewardFormModal } from '@/components/modals/merchant/RewardFormModal';
import { LuckyDrawManager } from '@/components/modals/merchant/LuckyDrawManager';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface Reward {
    id: number;
    title: string;
    description?: string;
    image_url?: string;
    category?: string;
    points_cost: number;
    min_rank_required: string;
    is_active: boolean;
    stock_quantity?: number;
    available_stock?: number;
    // New logic fields
    reward_type?: 'free_item' | 'discount_percentage' | 'discount_fixed';
    target_scope?: 'order' | 'product' | 'category' | 'custom';
    target_id?: number | null;
    target_name?: string | null;  // New Data from backend
    discount_value?: number | null;
    branch_id?: number | null;
}

// Helpers for display
const getTypeIcon = (type: string) => {
    switch (type) {
        case 'free_item': return 'gift-outline';
        case 'discount_percentage': return 'pricetag-outline';
        case 'discount_fixed': return 'cash-outline';
        default: return 'gift-outline';
    }
};

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'free_item': return 'Free Items';
        case 'discount_percentage': return 'Discounts (%)';
        case 'discount_fixed': return 'Cash Vouchers';
        default: return 'Other Rewards';
    }
};

export default function MerchantVoucherScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const { user } = useAuth();

    const [rewards, setRewards] = useState<Reward[]>([]);
    // Branches map for lookup
    const [branches, setBranches] = useState<{ [key: number]: string }>({});

    const [filteredRewards, setFilteredRewards] = useState<Reward[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [activeType, setActiveType] = useState<'All' | 'free_item' | 'discount_percentage' | 'discount_fixed'>('All');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<number | 'all' | 'global'>('all'); // all=Everything, global=MerchantWide(null), number=Specific Branch

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showLuckyDrawManager, setShowLuckyDrawManager] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | undefined>();

    // Animation State
    const scrollY = React.useRef(new Animated.Value(0)).current;
    const [headerHeight, setHeaderHeight] = useState(280); // Default estimate

    const [listHeight, setListHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);

    // Calculate max scrollable distance
    // We add a buffer or ensure it's at least 1 to prevent range errors
    const scrollRange = Math.max(contentHeight - listHeight, 1);

    // Re-create animation node when scroll range changes (e.g. data load)
    const clampScroll = React.useMemo(() => {
        return Animated.diffClamp(
            scrollY.interpolate({
                inputRange: [0, scrollRange],
                outputRange: [0, scrollRange],
                extrapolate: 'clamp',
            }),
            0,
            headerHeight
        );
    }, [headerHeight, scrollRange]);

    const headerTranslateY = clampScroll.interpolate({
        inputRange: [0, headerHeight],
        outputRange: [0, -headerHeight],
        extrapolate: 'clamp',
    });

    const headerOpacity = clampScroll.interpolate({
        inputRange: [0, headerHeight - 20, headerHeight],
        outputRange: [1, 1, 0], // Keep opacity 1 longer
        extrapolate: 'clamp',
    });

    const isMainBranch = user?.is_main ?? false;

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [rewardsData, branchesData] = await Promise.all([
                api.rewards.getRewards(),
                api.merchant.getBranches() // Assume this exists or similar endpoint
            ]);

            setRewards(rewardsData);
            setFilteredRewards(rewardsData);

            // Create branch lookup map
            const branchMap: { [key: number]: string } = {};
            branchesData.forEach((b: any) => {
                branchMap[b.id] = b.name;
            });
            setBranches(branchMap);

        } catch (error: any) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Grouping Logic for SectionList
    const sections = React.useMemo(() => {
        const grouped: { [key: string]: Reward[] } = {
            'free_item': [],
            'discount_percentage': [],
            'discount_fixed': []
        };

        // Distribute rewards into buckets
        filteredRewards.forEach(r => {
            const type = r.reward_type || 'free_item';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(r);
        });

        // Convert to SectionList format
        return Object.keys(grouped)
            .filter(key => grouped[key].length > 0)
            .map(key => ({
                title: getTypeLabel(key),
                data: grouped[key],
                icon: getTypeIcon(key)
            }));
    }, [filteredRewards]);

    // Effect to filter rewards when dependencies change
    React.useEffect(() => {
        let result = rewards;

        // 1. Filter by Tab
        if (activeTab === 'Active') {
            result = result.filter(r => r.is_active);
        } else if (activeTab === 'Inactive') {
            result = result.filter(r => !r.is_active);
        }

        // 2. Filter by Search Query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.title.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query))
            );
        }

        // 3. Filter by Reward Type
        if (activeType !== 'All') {
            result = result.filter(r => r.reward_type === activeType);
        }

        // 4. Filter by Branch (New)
        if (selectedBranchFilter !== 'all') {
            if (selectedBranchFilter === 'global') {
                // Show rewards deemed merchant-wide (branch_id is null)
                result = result.filter(r => r.branch_id === null);
            } else {
                // Show rewards for specific branch
                result = result.filter(r => r.branch_id === selectedBranchFilter);
            }
        }

        setFilteredRewards(result);
    }, [rewards, activeTab, searchQuery, activeType, selectedBranchFilter]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleCreateReward = async (data: any) => {
        try {
            await api.rewards.createReward(data);
            Alert.alert('Success', 'Reward created successfully');
            loadData();
        } catch (error: any) {
            throw new Error(error.error || 'Failed to create reward');
        }
    };

    const handleUpdateReward = async (data: any) => {
        if (!editingReward) return;

        try {
            await api.rewards.updateReward(editingReward.id, data);
            Alert.alert('Success', 'Reward updated successfully');
            loadData();
            setEditingReward(undefined);
        } catch (error: any) {
            throw new Error(error.error || 'Failed to update reward');
        }
    };

    const handleDeleteReward = (reward: Reward) => {
        Alert.alert(
            'Delete Reward',
            `Are you sure you want to delete "${reward.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.rewards.deleteReward(reward.id);
                            Alert.alert('Success', 'Reward deleted successfully');
                            loadData();
                        } catch (error: any) {
                            Alert.alert('Error', error.error || 'Failed to delete reward');
                        }
                    }
                }
            ]
        );
    };

    const handleToggleActive = async (reward: Reward) => {
        try {
            await api.rewards.updateReward(reward.id, {
                is_active: !reward.is_active
            });
            loadData();
        } catch (error: any) {
            Alert.alert('Error', error.error || 'Failed to update reward status');
        }
    };

    const renderRewardItem = ({ item }: { item: Reward }) => {
        // Resolve Subtitle (Target Info)
        let subtitle = 'General Reward';
        if (item.target_scope === 'product' || item.target_scope === 'category') {
            subtitle = `Linked to ${item.target_scope}`;
            if (item.target_name) {
                subtitle = `${item.target_scope === 'product' ? 'Product:' : 'Category:'} ${item.target_name}`;
            } else if (item.target_id) {
                subtitle += ` #${item.target_id}`;
            }
        } else if (item.target_scope === 'order') {
            subtitle = 'Applies to entire order';
        }

        // Resolve Caption (Branch Info)
        const branchName = item.branch_id ? branches[item.branch_id] || `Branch #${item.branch_id}` : 'All Branches (Merchant-wide)';
        const isLocked = !!item.branch_id;

        return (
            <TouchableOpacity
                style={[styles.listRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                    setEditingReward(item);
                    setShowFormModal(true);
                }}
            >
                {/* Left: Image or Icon Badge */}
                {item.image_url ? (
                    <Image
                        source={{
                            uri: item.image_url.startsWith('http')
                                ? item.image_url
                                : `${API_URL}${item.image_url}`
                        }}
                        style={{ width: 48, height: 48, borderRadius: 8, marginRight: 0 }}
                    />
                ) : (
                    <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
                        <Ionicons name={getTypeIcon(item.reward_type || 'free_item') as any} size={24} color={theme.primary} />
                    </View>
                )}

                {/* Middle: Main Info */}
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                            {item.title}
                        </Text>
                        {!item.is_active && (
                            <View style={[styles.statusDot, { backgroundColor: Colors.light.error, marginLeft: 6 }]} />
                        )}
                    </View>

                    <Text style={[styles.rowSubtitle, { color: theme.icon }]} numberOfLines={1}>
                        {subtitle}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons name={isLocked ? "location" : "globe-outline"} size={12} color={theme.icon} style={{ marginRight: 4 }} />
                        <Text style={[styles.rowCaption, { color: theme.icon }]} numberOfLines={1}>
                            {branchName}
                        </Text>
                    </View>
                </View>

                {/* Right: Meta & Actions */}
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <View style={[styles.pointsBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Ionicons name="star" size={10} color={theme.primary} style={{ marginRight: 2 }} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}>{item.points_cost}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
                        {/* Delete Button */}
                        <TouchableOpacity
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleDeleteReward(item);
                            }}
                        >
                            <Ionicons name="trash-outline" size={20} color={Colors.light.error} />
                        </TouchableOpacity>

                        {/* Toggle Status */}
                        <TouchableOpacity
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            onPress={(e) => {
                                e.stopPropagation(); // Prevent opening modal
                                handleToggleActive(item);
                            }}
                        >
                            <Ionicons
                                name={item.is_active ? "toggle" : "toggle-outline"}
                                size={24}
                                color={item.is_active ? Colors.light.success : theme.icon}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = ({ section: { title, data, icon } }: any) => (
        <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={icon} size={18} color={theme.text} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: theme.border }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>{data.length}</Text>
            </View>
        </View>
    );

    if (!isMainBranch) {
        return (
            <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
                <View style={[styles.container, { backgroundColor: theme.background }]}>
                    <View style={styles.restrictedContainer}>
                        <Ionicons name="lock-closed-outline" size={64} color={theme.icon} />
                        <Text style={[styles.restrictedTitle, { color: theme.text }]}>
                            Rewards Management
                        </Text>
                        <Text style={[styles.restrictedMessage, { color: theme.icon }]}>
                            Only the main branch can manage rewards. Please contact your main branch to
                            create or modify rewards.
                        </Text>
                    </View>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                {/* Animated Header */}
                <Animated.View
                    style={[
                        styles.headerContainer,
                        {
                            backgroundColor: theme.background,
                            height: headerHeight,
                            transform: [{ translateY: headerTranslateY }],
                            opacity: headerOpacity
                        }
                    ]}
                    onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                >
                    <View style={styles.headerContent}>
                        <View style={{ marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.title, { color: theme.text }]}>Rewards</Text>
                                    <Text style={[styles.subtitle, { color: theme.icon }]}>
                                        Manage loyalty rewards
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.headerIconButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setShowLuckyDrawManager(true);
                                        }}
                                    >
                                        <Ionicons name="gift" size={20} color={theme.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.addButton, { backgroundColor: theme.primary }]}
                                        onPress={() => {
                                            Haptics.selectionAsync();
                                            setEditingReward(undefined);
                                            setShowFormModal(true);
                                        }}
                                    >
                                        <Ionicons name="add" size={24} color="#000" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Search Bar */}
                        <View style={{ marginBottom: 16 }}>
                            <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <Ionicons name="search-outline" size={20} color={theme.icon} style={{ marginLeft: 12, marginRight: 8 }} />
                                <TextInput
                                    placeholder="Search rewards..."
                                    placeholderTextColor={theme.icon}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    style={{ flex: 1, color: theme.text, height: 44 }}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color={theme.icon} style={{ marginRight: 12 }} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Branch Filter Row */}
                        <View style={{ marginBottom: 12 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <TouchableOpacity
                                    style={[
                                        styles.smallPill,
                                        selectedBranchFilter === 'all' && { backgroundColor: theme.text },
                                        selectedBranchFilter !== 'all' && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                                    ]}
                                    onPress={() => setSelectedBranchFilter('all')}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedBranchFilter === 'all' ? theme.background : theme.text }}>
                                        All Branches
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.smallPill,
                                        selectedBranchFilter === 'global' && { backgroundColor: theme.text },
                                        selectedBranchFilter !== 'global' && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                                    ]}
                                    onPress={() => setSelectedBranchFilter('global')}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedBranchFilter === 'global' ? theme.background : theme.text }}>
                                        Merchant Wide
                                    </Text>
                                </TouchableOpacity>

                                {Object.entries(branches).map(([id, name]) => (
                                    <TouchableOpacity
                                        key={id}
                                        style={[
                                            styles.smallPill,
                                            selectedBranchFilter === Number(id) && { backgroundColor: theme.text },
                                            selectedBranchFilter !== Number(id) && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                                        ]}
                                        onPress={() => setSelectedBranchFilter(Number(id))}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: selectedBranchFilter === Number(id) ? theme.background : theme.text }}>
                                            {name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Status Tabs */}
                        <View style={styles.tabsContainer}>
                            {(['All', 'Active', 'Inactive'] as const).map(tab => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[
                                        styles.tabPill,
                                        activeTab === tab && { backgroundColor: theme.primary },
                                        activeTab !== tab && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                                    ]}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            activeTab === tab ? { color: '#000', fontWeight: 'bold' } : { color: theme.text }
                                        ]}
                                    >
                                        {tab}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Type Filters (Scrollable) */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                            {[
                                { id: 'All', label: 'All Types' },
                                { id: 'free_item', label: 'Free Items' },
                                { id: 'discount_percentage', label: 'Discounts' },
                                { id: 'discount_fixed', label: 'Vouchers' }
                            ].map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.smallPill,
                                        activeType === type.id && { backgroundColor: theme.text },
                                        activeType !== type.id && { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }
                                    ]}
                                    onPress={() => setActiveType(type.id as any)}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: activeType === type.id ? theme.background : theme.text
                                        }}
                                    >
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Animated.View>

                {/* Rewards List */}
                {loading ? (
                    <View style={[styles.centerContainer, { paddingTop: headerHeight }]}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : rewards.length === 0 ? (
                    <View style={[styles.centerContainer, { paddingTop: headerHeight }]}>
                        <Ionicons name="gift-outline" size={64} color={theme.icon} />
                        <Text style={[styles.emptyText, { color: theme.icon }]}>
                            No rewards yet
                        </Text>
                        <Text style={[styles.emptySubtext, { color: theme.icon }]}>
                            Tap the + button to create your first reward
                        </Text>
                    </View>
                ) : (
                    <Animated.SectionList
                        sections={sections}
                        renderItem={renderRewardItem}
                        renderSectionHeader={renderSectionHeader}
                        keyExtractor={(item: any) => item.id.toString()}
                        contentContainerStyle={{
                            paddingTop: headerHeight + 16,
                            paddingHorizontal: 16,
                            paddingBottom: 100
                        }}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                            { useNativeDriver: true }
                        )}
                        stickySectionHeadersEnabled={true}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={theme.primary}
                                progressViewOffset={headerHeight} // Ensure spinner shows below header
                            />
                        }
                        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
                        onContentSizeChange={(w, h) => setContentHeight(h)}
                    />
                )}

                {/* Form Modal */}
                <RewardFormModal
                    visible={showFormModal}
                    onClose={() => {
                        setShowFormModal(false);
                        setEditingReward(undefined);
                    }}
                    onSubmit={editingReward ? handleUpdateReward : handleCreateReward}
                    initialData={editingReward}
                />

                {/* Lucky Draw Manager Modal */}
                <LuckyDrawManager
                    visible={showLuckyDrawManager}
                    onClose={() => setShowLuckyDrawManager(false)}
                />
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    headerContent: {
        paddingVertical: 16,
        paddingBottom: 8,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerIconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100, // Add bottom padding for better scroll experience
    },
    columnWrapper: {
        gap: 16,
        marginBottom: 16,
    },
    gridItem: {
        flex: 1 / 2,
        // Remove padding/margin hacks if using gap
    },
    gridItemLast: {
        // Not needed with columnWrapper gap
    },
    rewardCard: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        flex: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    rewardImage: {
        width: '100%',
        height: 150,
        resizeMode: 'cover',
    },
    rewardImagePlaceholder: {
        width: '100%',
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        zIndex: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    rewardContent: {
        padding: 12,
    },
    rewardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
        lineHeight: 22,
    },
    pointsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    pointsText: {
        fontSize: 16,
        fontWeight: '700',
    },
    miniMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    rankBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    rankText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    stockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    stockText: {
        fontSize: 11,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // Align right
        gap: 12,
        marginTop: 4,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)', // Will be overridden by dynamic styles? No, hardcoded here. Should check lines.
    },
    actionButton: {
        padding: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 8,
    },
    restrictedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    restrictedTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 12,
    },
    restrictedMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    tabPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    smallPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    rowSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    rowCaption: {
        fontSize: 12,
        marginLeft: 2,
    },
    pointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },

});
