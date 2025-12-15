import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];

  return (
    <ScreenWrapper style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {/* Avatar Placeholder */}
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#666" />
          </View>
          <View>
            <Text style={[styles.greeting, { color: theme.text }]}>Hey,</Text>
            <Text style={[styles.username, { color: theme.text }]}>{user?.username || 'Guest'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Main Balance Card (White) */}
      <View style={[styles.balanceCard, { backgroundColor: theme.card }]}>
        <View style={styles.balanceHeader}>
          <View style={styles.coinIconContainer}>
            <Ionicons name="gift" size={16} color="#FFF" />
          </View>
        </View>

        <View style={styles.balanceContent}>
          <View>
            <Text style={styles.balanceLabel}>Current Points</Text>
            <Text style={styles.balanceValue}>{user?.points || 0}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.balanceLabel}>Streak Points</Text>
            <Text style={styles.balanceValue}>0</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary }]}>
            <Ionicons name="caret-up-circle-outline" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>Check In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#000' }]}>
            <Ionicons name="scan-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Scan</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Rewards</Text>
      {/* Just placeholder scroll for now */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rewardsScroll}>
        {/* Reward Card 1 */}
        <View style={[styles.rewardCard, { backgroundColor: '#FFF' }]}>
          <View style={{ height: 100, backgroundColor: '#F0F0F0', borderRadius: 16, marginBottom: 10 }} />
          <Text style={styles.rewardTitle}>Free Coffee</Text>
          <Text style={styles.rewardCost}>500 pts</Text>
        </View>

        {/* Reward Card 2 */}
        <View style={[styles.rewardCard, { backgroundColor: '#FFF' }]}>
          <View style={{ height: 100, backgroundColor: '#F0F0F0', borderRadius: 16, marginBottom: 10 }} />
          <Text style={styles.rewardTitle}>$5 Voucher</Text>
          <Text style={styles.rewardCost}>1000 pts</Text>
        </View>
      </ScrollView>

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: 60, // Custom safe area top
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.spacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  notifBtn: {
    padding: 8,
  },
  balanceCard: {
    borderRadius: 32,
    padding: 24,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  coinIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  rewardsScroll: {
    flexGrow: 0,
  },
  rewardCard: { // Simulating the yellow cards in screenshot style
    width: 160,
    padding: 12,
    borderRadius: 24,
    marginRight: 16,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardCost: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  }
});
