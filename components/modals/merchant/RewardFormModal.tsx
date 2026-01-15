import { BaseModal } from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pill } from '@/components/ui/Pill';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL, api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface RewardFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    initialData?: any;
}

const RANK_OPTIONS = [
    { value: 'bronze', label: 'Bronze' },
    { value: 'silver', label: 'Silver' },
    { value: 'gold', label: 'Gold' },
    { value: 'platinum', label: 'Platinum' }
];

const CATEGORY_OPTIONS = [
    { value: 'Food', label: 'Food' },
    { value: 'Beverage', label: 'Beverage' },
    { value: 'Merchandise', label: 'Merchandise' },
    { value: 'Discount', label: 'Discount' },
    { value: 'Service', label: 'Service' }
];

const REWARD_TYPES = [
    { id: 'free_item', label: 'Free Item', icon: 'gift-outline', description: 'Redeem a free product' },
    { id: 'discount_percentage', label: '% Discount', icon: 'pricetag-outline', description: 'Percentage off order or item' },
    { id: 'discount_fixed', label: 'Cash Voucher', icon: 'cash-outline', description: 'Fixed amount off order' },
];

const TARGET_SCOPES = [
    { id: 'custom', label: 'Custom', icon: 'create-outline' },
    { id: 'order', label: 'Entire Order', icon: 'receipt-outline' },
    { id: 'product', label: 'Specific Item', icon: 'fast-food-outline' },
    { id: 'category', label: 'Category', icon: 'grid-outline' },
];

export const RewardFormModal: React.FC<RewardFormModalProps> = ({
    visible,
    onClose,
    onSubmit,
    initialData
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const isEditing = !!initialData;


    // Reward Logic State
    const [rewardType, setRewardType] = useState('free_item');
    const [targetScope, setTargetScope] = useState('custom'); // custom, order, product, category
    const [targetId, setTargetId] = useState<number | null>(null);
    const [discountValue, setDiscountValue] = useState('');

    // Menu Browsing State
    const [browsingBranchId, setBrowsingBranchId] = useState<number | null>(null);
    const [menuProducts, setMenuProducts] = useState<any[]>([]);
    const [menuCategories, setMenuCategories] = useState<any[]>([]);
    const [loadingMenu, setLoadingMenu] = useState(false);

    // Basic Info
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [category, setCategory] = useState('Food'); // Display category
    const [pointsCost, setPointsCost] = useState('');
    const [minRankRequired, setMinRankRequired] = useState('bronze');

    // Availability
    const [isActive, setIsActive] = useState(true);
    const [hasStockLimit, setHasStockLimit] = useState(false);
    const [stockQuantity, setStockQuantity] = useState('');

    // Rules
    const [validityDays, setValidityDays] = useState('30');
    const [hasRedemptionLimit, setHasRedemptionLimit] = useState(false);
    const [redemptionLimit, setRedemptionLimit] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');

    // Branch selection (null = merchant-wide, number = specific branch)
    const [isMerchantWide, setIsMerchantWide] = useState(true);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [branches, setBranches] = useState<any[]>([]);

    // UI State
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);

    // Fetch branches on modal open
    useEffect(() => {
        if (visible) {
            // Fetch branches for selection
            api.merchant.getBranches()
                .then(data => setBranches(data))
                .catch(err => console.error('Failed to load branches:', err));
        }
    }, [visible]);

    // Fetch Menu Items when Browsing Branch Changes
    useEffect(() => {
        if (browsingBranchId) {
            setLoadingMenu(true);
            Promise.all([
                api.menu.getProducts(browsingBranchId),
                api.menu.getCategories(browsingBranchId)
            ]).then(([productsData, categoriesData]) => {
                setMenuProducts(productsData);
                setMenuCategories(categoriesData);
            }).catch(err => console.error('Failed to load menu:', err))
                .finally(() => setLoadingMenu(false));
        } else {
            setMenuProducts([]);
            setMenuCategories([]);
        }
    }, [browsingBranchId]);

    // Reset or Populate form
    useEffect(() => {
        if (visible) {
            if (initialData) {
                // Edit mode
                setTitle(initialData.title || '');
                setDescription(initialData.description || '');
                setImageUrl(initialData.image_url || '');
                setCategory(initialData.category || 'Food');
                setPointsCost(initialData.points_cost?.toString() || '');
                setMinRankRequired(initialData.min_rank_required || 'bronze');
                setIsActive(initialData.is_active ?? true);

                // New Logic Fields
                // Fallback for old rewards: if no reward_type, guess based on data
                setRewardType(initialData.reward_type || 'free_item');
                setTargetScope(initialData.target_scope || 'custom');
                setTargetId(initialData.target_id || null);
                setDiscountValue(initialData.discount_value ? initialData.discount_value.toString() : '');

                // Stock
                setHasStockLimit(initialData.stock_quantity !== null);
                setStockQuantity(initialData.stock_quantity?.toString() || '');

                // Rules
                setValidityDays(initialData.validity_days?.toString() || '30');
                setHasRedemptionLimit(initialData.redemption_limit_per_user !== null);
                setRedemptionLimit(initialData.redemption_limit_per_user?.toString() || '');
                setTermsAndConditions(initialData.terms_and_conditions || '');

                // Branch Logic
                // If it has a linked target, availability is locked to that target's branch
                const hasLinkedTarget = !!initialData.target_id;
                if (hasLinkedTarget) {
                    setIsMerchantWide(false);
                    // If existing data has a branch_id, use it. If not (data corruption), we might need to fetch it, 
                    // but for now assume detailed initialData has it.
                    setSelectedBranchId(initialData.branch_id || null);
                } else {
                    setIsMerchantWide(initialData.branch_id === null);
                    setSelectedBranchId(initialData.branch_id || null);
                }
            } else {
                // Create mode - reset all fields
                setTitle('');
                setDescription('');
                setImageUrl('');
                setCategory('Food');
                setPointsCost('');
                setMinRankRequired('bronze');
                setIsActive(true);

                // Reset New Logic
                setRewardType('free_item');
                setTargetScope('custom');
                setTargetId(null);
                setDiscountValue('');
                setBrowsingBranchId(null); // Default to nothing selected


                setHasStockLimit(false);
                setStockQuantity('');
                setValidityDays('30');
                setHasRedemptionLimit(false);
                setRedemptionLimit('');
                setTermsAndConditions('');
                setIsMerchantWide(true);
                setSelectedBranchId(null);
            }
        }
    }, [visible, initialData]);

    const handleProductSelect = (product: any) => {
        setTargetId(product.id);
        setTitle(product.name);
        setDescription(product.description || '');
        if (product.image_url) setImageUrl(product.image_url);

        // Lock branch to the product's branch
        setIsMerchantWide(false);
        setSelectedBranchId(product.branch_id);

        // Auto-select category mapping if possible
        const productCatName = menuCategories.find(c => c.id === product.category_id)?.name;
        const matchedCat = CATEGORY_OPTIONS.find(c => c.value === productCatName);
        if (matchedCat) setCategory(matchedCat.value);
    };

    const handleCategorySelect = (cat: any) => {
        setTargetId(cat.id);
        setTitle(`${rewardType === 'discount_percentage' ? `${discountValue}% Off` : `Discount on`} ${cat.name}`);
        if (cat.image_url) setImageUrl(cat.image_url);

        // Lock branch to the category's branch
        setIsMerchantWide(false);
        setSelectedBranchId(cat.branch_id);
    };


    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri,
                type: 'image/jpeg',
                name: 'reward.jpg',
            } as any);

            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = await response.json();
            if (data.url) {
                setImageUrl(data.url);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a reward title');
            return;
        }
        if (!pointsCost || parseFloat(pointsCost) <= 0) {
            Alert.alert('Error', 'Please enter a valid points cost');
            return;
        }
        if (!isMerchantWide && !selectedBranchId) {
            Alert.alert('Error', 'Please select a branch or make the reward available merchant-wide');
            return;
        }

        setLoading(true);
        try {
            const data = {
                title: title.trim(),
                description: description.trim() || undefined,
                image_url: imageUrl || undefined,
                category: category || 'Food',
                points_cost: parseInt(pointsCost),
                min_rank_required: minRankRequired,

                // New Fields
                reward_type: rewardType,
                target_scope: targetScope,
                target_id: targetId,
                is_custom: targetScope === 'custom',
                discount_value: discountValue ? parseFloat(discountValue) : null,

                is_active: isActive,
                stock_quantity: hasStockLimit ? parseInt(stockQuantity) || null : null,
                validity_days: parseInt(validityDays) || 30,
                redemption_limit_per_user: hasRedemptionLimit ? parseInt(redemptionLimit) || null : null,
                terms_and_conditions: termsAndConditions.trim() || undefined,
                branch_id: isMerchantWide ? null : selectedBranchId
            };

            await onSubmit(data);
            onClose();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save reward');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title={initialData ? 'Edit Reward' : 'Create Reward'}
            scrollable={false}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* 1. Reward Type Selection */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Reward Type</Text>
                            {isEditing && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="lock-closed-outline" size={14} color={theme.icon} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, color: theme.icon }}>Cannot change</Text>
                                </View>
                            )}
                        </View>

                        <View style={[styles.typeGrid, isEditing && { opacity: 0.6 }]}>
                            {REWARD_TYPES.map(type => {
                                const isSelected = rewardType === type.id;
                                return (
                                    <TouchableOpacity
                                        key={type.id}
                                        disabled={isEditing}
                                        style={[
                                            styles.typeCard,
                                            {
                                                borderColor: isSelected ? theme.primary : theme.border,
                                                backgroundColor: isSelected ? `${theme.primary}10` : 'transparent'
                                            }
                                        ]}
                                        onPress={() => {
                                            if (isEditing) return;
                                            setRewardType(type.id);
                                            if (type.id === 'free_item') setTargetScope('product');
                                            else setTargetScope('order');
                                        }}
                                    >
                                        <Ionicons
                                            name={type.icon as any}
                                            size={24}
                                            color={isSelected ? theme.primary : theme.icon}
                                        />
                                        <Text style={[styles.typeLabel, { color: theme.text }]}>{type.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* 2. Target Configuration */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Reward Details</Text>
                            {isEditing && (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="lock-closed-outline" size={14} color={theme.icon} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, color: theme.icon }}>Target locked</Text>
                                </View>
                            )}
                        </View>

                        {/* Scope Selector */}
                        <View style={isEditing && { opacity: 0.6, pointerEvents: 'none' }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                                {TARGET_SCOPES
                                    .filter(s => {
                                        if (rewardType === 'free_item') {
                                            // Free items: Specific Product (Gets that item) or Custom (Mystery Gift)
                                            // Invalid: Free "Entire Order"? (Unless specific promotion, but rare). Free "Category"? (Rare).
                                            return s.id === 'product' || s.id === 'custom';
                                        } else {
                                            // Discounts: Order (% off bill), Category (% off food), Product (% off coffee)
                                            // Invalid: Custom (Discount needs a math base)
                                            return s.id !== 'custom';
                                        }
                                    })
                                    .map(scope => (
                                        <Pill
                                            key={scope.id}
                                            label={scope.label}
                                            selected={targetScope === scope.id}
                                            onPress={() => !isEditing && setTargetScope(scope.id)}
                                            style={{ marginRight: 8 }}
                                        />
                                    ))}
                            </ScrollView>
                        </View>

                        {/* Discount Value Input (ALWAYS EDITABLE) */}
                        {rewardType !== 'free_item' && (
                            <View style={{ marginTop: 16 }}>
                                <Input
                                    label={rewardType === 'discount_percentage' ? 'Percentage (%)' : 'Amount ($)'}
                                    value={discountValue}
                                    onChangeText={setDiscountValue}
                                    placeholder={rewardType === 'discount_percentage' ? 'e.g. 10' : 'e.g. 5.00'}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}

                        {/* Linked Item Selection */}
                        {(targetScope === 'product' || targetScope === 'category') && (
                            <View style={[styles.card, { borderColor: theme.border, marginTop: 16 }, isEditing && { backgroundColor: theme.card, opacity: 0.8 }]}>
                                <Text style={[styles.label, { color: theme.text, marginTop: 0 }]}>
                                    Target Item {isEditing && '(Locked)'}
                                </Text>

                                {/* If editing, just show the selected item name, hide browsing */}
                                {isEditing ? (
                                    <View style={{ padding: 8 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                                            {title}
                                        </Text>
                                        <Text style={{ fontSize: 14, color: theme.icon, marginTop: 4 }}>
                                            Linked to {targetScope} ID: {targetId}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {/* Branch Filter for Menu Browsing */}
                                        <Text style={[styles.helperText, { color: theme.icon }]}>Browse menu from branch:</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                                            {branches.map(branch => (
                                                <Pill
                                                    key={branch.id}
                                                    label={branch.name}
                                                    selected={browsingBranchId === branch.id}
                                                    onPress={() => setBrowsingBranchId(branch.id)}
                                                    style={{ marginRight: 8 }}
                                                />
                                            ))}
                                        </ScrollView>

                                        {loadingMenu ? (
                                            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
                                        ) : browsingBranchId ? (
                                            <View style={{ marginTop: 12 }}>
                                                {targetScope === 'product' ? (
                                                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                                        {menuProducts.map(p => (
                                                            <TouchableOpacity
                                                                key={p.id}
                                                                style={[
                                                                    styles.listItem,
                                                                    { borderColor: targetId === p.id ? theme.primary : theme.border }
                                                                ]}
                                                                onPress={() => handleProductSelect(p)}
                                                            >
                                                                <Text style={{ color: theme.text }}>{p.name}</Text>
                                                                <Text style={{ color: theme.text, fontWeight: 'bold' }}>
                                                                    {targetId === p.id && '✓'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                ) : (
                                                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                                        {menuCategories.map(c => (
                                                            <TouchableOpacity
                                                                key={c.id}
                                                                style={[
                                                                    styles.listItem,
                                                                    { borderColor: targetId === c.id ? theme.primary : theme.border }
                                                                ]}
                                                                onPress={() => handleCategorySelect(c)}
                                                            >
                                                                <Text style={{ color: theme.text }}>{c.name}</Text>
                                                                <Text style={{ color: theme.text, fontWeight: 'bold' }}>
                                                                    {targetId === c.id && '✓'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                )}
                                            </View>
                                        ) : (
                                            <View style={styles.emptyState}>
                                                <Text style={{ color: theme.icon, fontStyle: 'italic' }}>Select a branch above to browse items</Text>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Image Upload / Title (Display Info) */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Display Information</Text>

                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <TouchableOpacity
                                style={[styles.miniImagePicker, { borderColor: theme.border }]}
                                onPress={pickImage}
                                disabled={uploading}
                            >
                                {imageUrl ? (
                                    <Image
                                        source={{ uri: imageUrl.startsWith('http') ? imageUrl : `${API_URL}${imageUrl}` }}
                                        style={styles.previewImage}
                                    />
                                ) : (
                                    <Ionicons name="camera-outline" size={24} color={theme.icon} />
                                )}
                            </TouchableOpacity>

                            <View style={{ flex: 1 }}>
                                <Input
                                    label="Display Title *"
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder={targetScope === 'product' ? "Product Name" : "e.g. Free Coffee"}
                                />
                            </View>
                        </View>

                        <Input
                            label="Description"
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Describe what the reward includes..."
                            multiline
                            numberOfLines={2}
                            style={{ height: 60 }}
                        />

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Visual Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {CATEGORY_OPTIONS.map(opt => (
                                    <Pill
                                        key={opt.value}
                                        label={opt.label}
                                        selected={category === opt.value}
                                        onPress={() => setCategory(opt.value)}
                                        style={{ marginRight: 8 }}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    {/* Points & Access */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Points & Access</Text>

                        <Input
                            label="Points Cost *"
                            value={pointsCost}
                            onChangeText={setPointsCost}
                            placeholder="e.g., 500"
                            keyboardType="numeric"
                        />

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Minimum Rank Required</Text>
                            <View style={styles.rankPills}>
                                {RANK_OPTIONS.map(rank => (
                                    <Pill
                                        key={rank.value}
                                        label={rank.label}
                                        selected={minRankRequired === rank.value}
                                        onPress={() => setMinRankRequired(rank.value)}
                                        style={{ marginRight: 8, marginBottom: 8 }}
                                    />
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* Availability */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Availability</Text>

                        <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>Active</Text>
                            <Switch
                                value={isActive}
                                onValueChange={setIsActive}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={isActive ? '#000' : '#f4f3f4'}
                            />
                        </View>

                        <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>Stock Limit</Text>
                            <Switch
                                value={hasStockLimit}
                                onValueChange={setHasStockLimit}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={hasStockLimit ? '#000' : '#f4f3f4'}
                            />
                        </View>

                        {hasStockLimit && (
                            <Input
                                label="Stock Quantity"
                                value={stockQuantity}
                                onChangeText={setStockQuantity}
                                placeholder="e.g., 100"
                                keyboardType="numeric"
                            />
                        )}

                        {/* Branch Logic: Locked if Linked, Flexible if Custom/Order */}
                        {(targetId || targetScope === 'product' || targetScope === 'category') ? (
                            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Ionicons name="lock-closed-outline" size={20} color={theme.icon} style={{ marginRight: 8 }} />
                                    <Text style={{ fontWeight: '600', color: theme.text }}>Availability Locked</Text>
                                </View>
                                <Text style={{ color: theme.icon, fontSize: 13 }}>
                                    This reward is linked to a specific menu item.
                                    It can only be redeemed at its valid branch.
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
                                    <Text style={[styles.switchLabel, { color: theme.text }]}>Available Merchant-Wide</Text>
                                    <Switch
                                        value={isMerchantWide}
                                        onValueChange={setIsMerchantWide}
                                        trackColor={{ false: theme.border, true: theme.primary }}
                                        thumbColor={isMerchantWide ? '#000' : '#f4f3f4'}
                                    />
                                </View>

                                {!isMerchantWide && branches.length > 0 && (
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.label, { color: theme.text }]}>Select Branch *</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            style={styles.pillContainer}
                                        >
                                            {branches.map(branch => (
                                                <Pill
                                                    key={branch.id}
                                                    label={branch.name}
                                                    selected={selectedBranchId === branch.id}
                                                    onPress={() => setSelectedBranchId(branch.id)}
                                                    style={{ marginRight: 8 }}
                                                />
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    {/* Rules */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Rules</Text>

                        <Input
                            label="Validity Days"
                            value={validityDays}
                            onChangeText={setValidityDays}
                            placeholder="e.g., 30"
                            keyboardType="numeric"
                        />

                        <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>Redemption Limit Per User</Text>
                            <Switch
                                value={hasRedemptionLimit}
                                onValueChange={setHasRedemptionLimit}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={hasRedemptionLimit ? '#000' : '#f4f3f4'}
                            />
                        </View>

                        {hasRedemptionLimit && (
                            <Input
                                label="Max Redemptions Per User"
                                value={redemptionLimit}
                                onChangeText={setRedemptionLimit}
                                placeholder="e.g., 1"
                                keyboardType="numeric"
                            />
                        )}

                        <Input
                            label="Terms & Conditions"
                            value={termsAndConditions}
                            onChangeText={setTermsAndConditions}
                            placeholder="Optional terms and conditions..."
                            multiline
                            numberOfLines={4}
                            style={{ height: 100 }}
                        />
                    </View>

                    {/* Submit Button */}
                    <Button
                        title={loading ? 'Saving...' : initialData ? 'Update Reward' : 'Create Reward'}
                        onPress={handleSubmit}
                        disabled={loading}
                        style={styles.submitButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    imagePicker: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        marginTop: 8,
        fontSize: 14,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    pillContainer: {
        flexDirection: 'row',
    },
    rankPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        marginBottom: 12,
    },
    switchLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    submitButton: {
        marginTop: 8,
        marginBottom: 32,
    },
    typeGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    typeCard: {
        width: '31%',
        paddingVertical: 12,
        paddingHorizontal: 4,
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
    },
    typeLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
    },
    card: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    helperText: {
        fontSize: 12,
        marginBottom: 8,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniImagePicker: {
        width: 80,
        height: 80,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});
