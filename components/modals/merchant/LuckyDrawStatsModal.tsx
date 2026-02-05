import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from '@/components/ui/BaseModal';
import { api } from '@/services/api';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface LuckyDraw {
  id: number;
  name: string;
}

interface Stats {
  lucky_draw_id: number;
  lucky_draw_name: string;
  total_spins: number;
  day7_spins: number;
  points_spins: number;
  total_points_awarded: number;
  total_points_spent: number;
  unique_participants: number;
  remaining_spins: number | null;
  is_active: boolean;
  prize_distribution: PrizeDistribution[];
}

interface PrizeDistribution {
  prize_id: number;
  prize_name: string;
  prize_type: string;
  won_count: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  draw: LuckyDraw | null;
}

export function LuckyDrawStatsModal({ visible, onClose, draw }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (visible && draw) {
      loadStats();
    }
  }, [visible, draw]);

  const loadStats = async () => {
    if (!draw) return;

    setLoading(true);
    try {
      const response = await api.get(`/merchant/lucky-draws/${draw.id}/statistics`);
      setStats(response);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const getPrizeTypeColor = (type: string) => {
    switch (type) {
      case 'points':
        return theme.primary;
      case 'reward':
        return '#FF6B6B';
      case 'voucher':
        return '#4ECDC4';
      default:
        return theme.icon;
    }
  };

  const StatBox = ({ label, value, icon, color }: any) => (
    <View style={[styles.statBox, { backgroundColor: theme.card, shadowColor: '#000000' }]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={[styles.statBoxValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statBoxLabel, { color: theme.icon }]}>{label}</Text>
      </View>
    </View>
  );

  if (!draw) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Performance Insights"
      scrollable={false}
    >
      {loading && !stats ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.icon }]}>Analyzing data...</Text>
        </View>
      ) : !stats ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.icon }]}>No stats available</Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.scrollView, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header Status */}
          <View style={[styles.headerCard, { backgroundColor: theme.card, shadowColor: '#000000' }]}>
            <View>
              <Text style={[styles.drawName, { color: theme.text }]}>{draw.name}</Text>
              <View style={[styles.statusBadge, stats.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                <View style={[styles.statusDot, { backgroundColor: stats.is_active ? '#4CAF50' : '#666' }]} />
                <Text style={[styles.statusText, { color: stats.is_active ? '#4CAF50' : '#666' }]}>
                  {stats.is_active ? 'Active Running' : 'Currently Inactive'}
                </Text>
              </View>
            </View>
            <View style={[styles.bigStat, { borderColor: theme.border }]}>
              <Text style={[styles.bigStatValue, { color: theme.primary }]}>{stats.total_spins}</Text>
              <Text style={[styles.bigStatLabel, { color: theme.icon }]}>Total Spins</Text>
            </View>
          </View>

          {/* Key Metrics Grid */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Key Metrics</Text>
          <View style={styles.grid}>
            <StatBox
              label="Unique Users"
              value={stats.unique_participants}
              icon="people"
              color="#4ECDC4"
            />
            {stats.remaining_spins !== null && (
              <StatBox
                label="Remaining"
                value={stats.remaining_spins}
                icon="hourglass"
                color="#FF6B6B"
              />
            )}
            <StatBox
              label="Day 7 Spins"
              value={stats.day7_spins}
              icon="calendar"
              color="#FF9F43"
            />
            <StatBox
              label="Points Spins"
              value={stats.points_spins}
              icon="star"
              color={theme.primary}
            />
          </View>

          {/* Points Flow */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Points Economy</Text>
          <View style={[styles.economyCard, { backgroundColor: theme.card, shadowColor: '#000000' }]}>
            <View style={styles.economyRow}>
              <View style={styles.economyItem}>
                <Text style={[styles.economyLabel, { color: theme.icon }]}>Spent by Users</Text>
                <Text style={[styles.economyValue, { color: theme.text }]}>{stats.total_points_spent}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.economyItem}>
                <Text style={[styles.economyLabel, { color: theme.icon }]}>Awarded to Users</Text>
                <Text style={[styles.economyValue, { color: theme.text }]}>{stats.total_points_awarded}</Text>
              </View>
            </View>
            <View style={[styles.netBadge, { backgroundColor: (stats.total_points_awarded - stats.total_points_spent) >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
              <Text style={[styles.netText, { color: (stats.total_points_awarded - stats.total_points_spent) >= 0 ? '#2E7D32' : '#C62828' }]}>
                Net: {(stats.total_points_awarded - stats.total_points_spent) >= 0 ? '+' : ''}{stats.total_points_awarded - stats.total_points_spent} points
              </Text>
            </View>
          </View>

          {/* Prize Distribution */}
          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Prize Distribution</Text>
          <View style={[styles.distributionCard, { backgroundColor: theme.card, shadowColor: '#000000' }]}>
            {stats.prize_distribution.length === 0 ? (
              <Text style={[styles.noDataText, { color: theme.icon }]}>No prizes distributed yet.</Text>
            ) : (
              stats.prize_distribution.map((prize, index) => {
                const percent = stats.total_spins > 0 ? (prize.won_count / stats.total_spins) * 100 : 0;
                const color = getPrizeTypeColor(prize.prize_type);

                return (
                  <View key={prize.prize_id} style={[
                    styles.distItem,
                    index !== stats.prize_distribution.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                  ]}>
                    <View style={styles.distHeader}>
                      <Text style={[styles.distName, { color: theme.text }]} numberOfLines={1}>{prize.prize_name}</Text>
                      <Text style={[styles.distCount, { color: theme.text }]}>{prize.won_count}</Text>
                    </View>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={[styles.percentText, { color: theme.icon }]}>{percent.toFixed(1)}%</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  // Header Card
  headerCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  drawName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    maxWidth: 200,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignSelf: 'flex-start',
  },
  activeBadge: { backgroundColor: '#E8F5E9' },
  inactiveBadge: { backgroundColor: '#F5F5F5' },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bigStat: {
    alignItems: 'center',
    borderLeftWidth: 1,
    paddingLeft: 20,
  },
  bigStatValue: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
  },
  bigStatLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 1,
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statBoxLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Economy
  economyCard: {
    padding: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  economyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  economyItem: {
    alignItems: 'center',
  },
  economyLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  economyValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: '100%',
  },
  netBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  netText: {
    fontWeight: '700',
    fontSize: 14,
  },
  // Distribution
  distributionCard: {
    padding: 8,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  distItem: {
    padding: 16,
  },
  distHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  distName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  distCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 12,
    width: 40,
    textAlign: 'right',
  },
  noDataText: {
    padding: 24,
    textAlign: 'center',
  },
});
