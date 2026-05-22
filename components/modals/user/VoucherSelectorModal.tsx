import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from '@/components/ui/BaseModal';
import { RewardBadge } from '@/components/ui/RewardBadge';
import { useCart } from '@/context/CartContext';
import { api, API_URL } from '@/services/api';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';

interface VoucherSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

// Full reward data from API including conditions
interface RewardData {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  reward_type: 'discount_percentage' | 'discount_fixed' | 'free_item';
  discount_value: number | null;
  target_scope: 'custom' | 'order' | 'product' | 'category';
  target_id: string | null;
  target_name: string | null;
  title: string;
  image_url?: string;
}

interface UserRewardFull {
  id: string;
  redemption_code: string;
  status: 'active' | 'used' | 'expired';
  expires_at: string;
  valid_at_branch_name?: string;
  reward: RewardData;
}

interface VoucherWithValidity extends UserRewardFull {
  isApplicable: boolean;
  disabledReason: string | null;
}

export const VoucherSelectorModal: React.FC<VoucherSelectorModalProps> = ({ visible, onClose }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const { selectedVoucher, setSelectedVoucher, cart, branchId } = useCart();
  const [activeTab, setActiveTab] = useState<'available' | 'used'>('available');
  const [availableVouchers, setAvailableVouchers] = useState<VoucherWithValidity[]>([]);
  const [usedVouchers, setUsedVouchers] = useState<UserRewardFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempSelectedId, setTempSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTempSelectedId(selectedVoucher?.id || null);
      loadVouchers();
    }
  }, [visible, selectedVoucher]);

  // Check if voucher can be applied to current cart
  const checkVoucherApplicability = (voucher: UserRewardFull): { isApplicable: boolean; reason: string | null } => {
    const reward = voucher.reward;

    // Check if expired
    if (new Date(voucher.expires_at) < new Date()) {
      return { isApplicable: false, reason: 'Expired' };
    }

    // Check branch restriction
    if (reward.branch_id && branchId && reward.branch_id !== branchId.toString()) {
      return { isApplicable: false, reason: `Only valid at ${reward.branch_name || 'specific branch'}` };
    }

    // Check cart is not empty
    if (cart.length === 0) {
      return { isApplicable: false, reason: 'Cart is empty' };
    }

    // Check target scope restrictions
    if (reward.target_scope === 'product' && reward.target_id) {
      const hasProduct = cart.some(item => item.productId === reward.target_id);
      if (!hasProduct) {
        return { isApplicable: false, reason: `Requires ${reward.target_name || 'specific item'} in cart` };
      }
    }

    return { isApplicable: true, reason: null };
  };

  const loadVouchers = async () => {
    setLoading(true);
    try {
      // Load active vouchers - API returns array directly
      const activeRewards = await api.rewards.getMyRewards('active');
      if (Array.isArray(activeRewards)) {
        const now = new Date();
        const vouchersWithValidity: VoucherWithValidity[] = activeRewards
          .filter((reward: UserRewardFull) => {
            const expiresAt = new Date(reward.expires_at);
            return expiresAt > now && reward.status === 'active';
          })
          .map((voucher: UserRewardFull) => {
            const { isApplicable, reason } = checkVoucherApplicability(voucher);
            return {
              ...voucher,
              isApplicable,
              disabledReason: reason,
            };
          })
          // Sort: applicable first, then by expiry date
          .sort((a: VoucherWithValidity, b: VoucherWithValidity) => {
            if (a.isApplicable !== b.isApplicable) {
              return a.isApplicable ? -1 : 1;
            }
            return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
          });

        setAvailableVouchers(vouchersWithValidity);
      }

      // Load used vouchers - API returns array directly
      const usedRewards = await api.rewards.getMyRewards('used');
      if (Array.isArray(usedRewards)) {
        setUsedVouchers(usedRewards);
      }
    } catch (error: any) {
      console.error('Failed to load vouchers:', error);
      Alert.alert('Error', 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVoucher = (voucher: VoucherWithValidity) => {
    if (!voucher.isApplicable) return;

    Haptics.selectionAsync();
    // Toggle selection
    if (tempSelectedId === voucher.id) {
      setTempSelectedId(null);
    } else {
      setTempSelectedId(voucher.id);
    }
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (tempSelectedId) {
      const selected = availableVouchers.find(v => v.id === tempSelectedId);
      if (selected && selected.isApplicable) {
        // Convert to the format expected by CartContext
        setSelectedVoucher({
          id: selected.id,
          redemption_code: selected.redemption_code,
          reward_type: selected.reward.reward_type,
          reward_value: selected.reward.discount_value || 0,
          reward_name: selected.reward.title,
          expires_at: selected.expires_at,
          status: selected.status,
          target_scope: selected.reward.target_scope,
          target_id: selected.reward.target_id,
          branch_id: selected.reward.branch_id,
        });
      }
    } else {
      setSelectedVoucher(null);
    }
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderTicket = (item: VoucherWithValidity | UserRewardFull, isUsed: boolean = false) => {
    const isSelected = !isUsed && tempSelectedId === item.id;
    const isDisabled = isUsed || ('isApplicable' in item && !item.isApplicable);
    const imageUrl = item.reward?.image_url;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.ticketContainer,
          { backgroundColor: theme.card, opacity: isDisabled ? 0.7 : 1 },
          isSelected && { borderColor: theme.secondary, borderWidth: 2 },
        ]}
        onPress={() => !isUsed && handleSelectVoucher(item as VoucherWithValidity)}
        activeOpacity={isDisabled ? 1 : 0.7}
        disabled={isDisabled}
      >
        {/* Top Section */}
        <View style={styles.ticketTop}>
          {/* Image */}
          {imageUrl ? (
            <Image
              source={{
                uri: imageUrl.startsWith('http')
                  ? imageUrl
                  : `${API_URL}${imageUrl}`
              }}
              style={styles.ticketImage}
            />
          ) : (
            <View style={[styles.ticketImagePlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="gift-outline" size={28} color={theme.icon} />
            </View>
          )}

          {/* Content */}
          <View style={styles.ticketContent}>
            <View style={styles.ticketHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.reward?.title}
                </Text>
                {/* Target Item Name */}
                {item.reward?.target_name && (
                  <Text style={[styles.targetName, { color: theme.primary }]}>
                    {item.reward.target_name}
                  </Text>
                )}
              </View>
              {/* Selection indicator for available vouchers */}
              {!isUsed && (
                <View style={[
                  styles.radioButton,
                  { borderColor: isSelected ? theme.secondary : theme.border },
                  isSelected && { borderColor: theme.secondary }
                ]}>
                  {isSelected && <View style={[styles.radioButtonInner, { backgroundColor: theme.secondary }]} />}
                </View>
              )}
            </View>

            {/* Reward Badge */}
            <View style={{ marginTop: 6 }}>
              <RewardBadge
                type={item.reward.reward_type}
                value={item.reward.discount_value || undefined}
              />
            </View>

            {/* Validity / Usage Context */}
            <View style={styles.contextRow}>
              {isUsed ? (
                <Text style={[styles.contextText, { color: theme.icon }]}>
                  Used
                </Text>
              ) : 'disabledReason' in item && item.disabledReason ? (
                <Text style={[styles.contextText, { color: theme.error }]}>
                  {item.disabledReason}
                </Text>
              ) : (
                <Text style={[styles.contextText, { color: theme.icon }]}>
                  Valid at: <Text style={{ fontFamily: Fonts.semibold, color: theme.text }}>
                    {item.valid_at_branch_name || 'All Branches'}
                  </Text>
                </Text>
              )}
            </View>

            {/* Expiry */}
            <View style={styles.ticketInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={12} color={theme.icon} />
                <Text style={[styles.infoText, { color: theme.icon }]}>
                  Expires: {formatDate(item.expires_at)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Dashed Line Separator */}
        <View style={styles.dashedSeparator}>
          <View style={[styles.semicircleLeft, { backgroundColor: theme.background }]} />
          <View style={[styles.dashedLine, { borderColor: theme.border }]} />
          <View style={[styles.semicircleRight, { backgroundColor: theme.background }]} />
        </View>

        {/* Bottom Section */}
        <View style={styles.ticketBottom}>
          <View style={styles.codeContainer}>
            <Text style={[styles.codeLabel, { color: theme.icon }]}>Code</Text>
            <Text style={[styles.codeValue, { color: theme.text }]}>
              {item.redemption_code}
            </Text>
          </View>
          {!isUsed && !isDisabled && (
            <View style={styles.tapHint}>
              <Text style={[styles.tapHintText, { color: theme.icon }]}>
                {isSelected ? 'Selected' : 'Tap to select'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.icon }]}>Loading vouchers...</Text>
        </View>
      );
    }

    if (activeTab === 'available') {
      if (availableVouchers.length === 0) {
        return (
          <View style={styles.centerContainer}>
            <Ionicons name="ticket-outline" size={64} color={theme.icon} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No vouchers available</Text>
            <Text style={[styles.emptySubtitle, { color: theme.icon }]}>
              Redeem rewards to get vouchers
            </Text>
          </View>
        );
      }

      const applicableCount = availableVouchers.filter(v => v.isApplicable).length;

      return (
        <>
          {applicableCount === 0 && availableVouchers.length > 0 && (
            <View style={[styles.warningBanner, { backgroundColor: `${theme.primary}20` }]}>
              <Ionicons name="information-circle" size={18} color={theme.secondary} />
              <Text style={[styles.warningText, { color: theme.secondary }]}>
                No vouchers applicable for current cart
              </Text>
            </View>
          )}
          <FlatList
            data={availableVouchers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderTicket(item, false)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      );
    }

    if (usedVouchers.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="ticket-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No used vouchers</Text>
          <Text style={[styles.emptySubtitle, { color: theme.icon }]}>
            Your used vouchers will appear here
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={usedVouchers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderTicket(item as any, true)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const applicableCount = availableVouchers.filter(v => v.isApplicable).length;

  return (
    <BaseModal visible={visible} onClose={onClose} title="Select Voucher" scrollable={false}>
      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'available' && [styles.tabActive, { borderBottomColor: theme.secondary }]
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('available');
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: theme.icon },
            activeTab === 'available' && [styles.tabTextActive, { color: theme.secondary }]
          ]}>
            Available ({applicableCount}/{availableVouchers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'used' && [styles.tabActive, { borderBottomColor: theme.secondary }]
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('used');
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            { color: theme.icon },
            activeTab === 'used' && [styles.tabTextActive, { color: theme.secondary }]
          ]}>
            Used ({usedVouchers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Apply Button (only show for available tab) */}
      {activeTab === 'available' && !loading && (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.applyButton, { backgroundColor: theme.secondary }]}
            onPress={handleApply}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>
              {tempSelectedId ? 'Apply Voucher' : 'Continue without voucher'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </BaseModal>
  );
};

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  tabTextActive: {
    fontFamily: Fonts.semibold,
  },
  content: {
    flex: 1,
    minHeight: 300,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    flex: 1,
  },

  // Ticket Styles (matching vouchers page)
  ticketContainer: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  ticketTop: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  ticketImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  ticketImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketContent: {
    flex: 1,
    gap: 4,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  ticketTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  targetName: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    marginTop: 2,
  },
  contextRow: {
    marginTop: 4,
  },
  contextText: {
    fontSize: 12,
  },
  ticketInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
  },

  // Radio Button
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Dashed Separator
  dashedSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
  },
  semicircleLeft: {
    width: 18,
    height: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    marginLeft: -9,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  semicircleRight: {
    width: 18,
    height: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    marginRight: -9,
  },

  // Bottom Section
  ticketBottom: {
    padding: 14,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeContainer: {
    gap: 2,
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
  },
  codeValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tapHintText: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
  },

  // Other styles
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  applyButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    color: '#FFFFFF',
  },
});
