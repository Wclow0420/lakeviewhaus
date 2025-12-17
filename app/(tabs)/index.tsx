
import { CheckInSuccess } from '@/components/gamification/CheckInSuccess';
import { Colors, Layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Data for Slideshow
const SLIDES = [
  { id: 1, image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80', title: 'Summer Special' },
  { id: 2, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80', title: 'New Arrivals' },
  { id: 3, image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80', title: 'Best Brews' },
];

const PRODUCTS = [
  { id: 1, name: 'Orange Americano', price: '7.15', originalPrice: '13.00', discount: '45% OFF', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80' },
  { id: 2, name: 'Grape Fizzy Americano', price: '8.25', originalPrice: '15.00', discount: '45% OFF', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80' },
  { id: 3, name: 'Coconut Latte', price: '9.50', originalPrice: '16.00', discount: '40% OFF', image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&q=80' },
  { id: 4, name: 'Velvet Mocha', price: '10.00', originalPrice: '18.00', discount: '45% OFF', image: 'https://images.unsplash.com/photo-1570968915860-37d4237d74f3?auto=format&fit=crop&w=400&q=80' },
];

const FloatingMemberCard = ({ user, theme, onCheckIn, streak, canCheckIn, currentPoints }: { user: any, theme: any, onCheckIn: () => void, streak: number, canCheckIn: boolean, currentPoints?: number }) => {
  const points = currentPoints !== undefined ? currentPoints : (user?.points || 0);

  // Animation for Streak Badge
  const badgeScale = useSharedValue(0);

  useEffect(() => {
    if (streak > 0) {
      // If appearing for the first time or updating
      badgeScale.value = withSequence(
        withSpring(1.5, { damping: 15, stiffness: 50 }), // Pop up
        withSpring(1, { mass: 0.5, damping: 12, stiffness: 100 }) // Snap back fast
      );
    }
  }, [streak]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: streak > 0 ? 1 : 0
  }));

  // Rank Logic
  let rank: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' = 'Silver';
  let nextRank = 'Silver';
  let min = 0;
  let max = 500;

  if (points >= 5000) {
    rank = 'Platinum';
    nextRank = 'Max';
    min = 5000;
    max = 5000;
  } else if (points >= 2000) {
    rank = 'Gold';
    nextRank = 'Platinum';
    min = 2000;
    max = 5000;
  } else if (points >= 500) {
    rank = 'Silver';
    nextRank = 'Gold';
    min = 500;
    max = 2000;
  }

  // Rank Styling Definitions
  const RANKS = {
    Bronze: {
      gradient: ['#a55435ff', '#e0a270ff', '#ffc6a0ff', '#e0a270ff', '#a55435ff'], // Solid Light Bronze
      text: '#000000',
      label: '#666666',
      accent: '#A17F5D', // Bronze
      border: '#D7C0A5', // Distinct Bronze Border
      badgeBg: '#F5F5F5',
      badgeText: '#A17F5D',
      progressTrack: '#EAE0D5',
      progressFill: '#A17F5D'
    },
    Silver: {
      gradient: ['#ffffffff', '#bbbbbbff', '#f1f1f1ff', '#a3a3a3ff', '#4e4e4eff'], // Solid Silver
      text: '#080000ff',
      label: '#666666',
      accent: '#757575', // Silver
      border: '#B0B0B0', // Distinct Silver Border
      badgeBg: '#EEEEEE',
      badgeText: '#757575',
      progressTrack: '#4f4f4fff',
      progressFill: '#f5f5f5ff'
    },
    Gold: {
      gradient: ['#feedd7ff', '#c6a681ff', '#ffce93ff', '#c18a4aff', '#613d13ff'],// Solid Gold
      text: '#443203ff',
      label: '#302400ff',
      accent: '#FCD259', // Brand Yellow
      border: '#FCD259',
      badgeBg: '#FFF3CD',
      badgeText: '#856404',
      progressTrack: '#483500ff',
      progressFill: '#ffe69cff'
    },
    Platinum: {
      gradient: ['#6a8eadff', '#98b1c5ff', '#c1d1dcff', '#98b1c5ff', '#6a8eadff'], // Dark Grey to Black Gradient
      text: '#001828ff',
      label: '#001828ff',
      accent: '#FFFFFF',
      border: '#E5E4E2', // Platinum/Silver Metallic Border
      badgeBg: '#050000ff',
      badgeText: '#ffffffff',
      progressTrack: '#444444',
      progressFill: '#e2e2e2ff' // Pop of yellow on black
    }
  };

  const currentStyle = RANKS[rank];
  const progress = max === min ? 1 : (points - min) / (max - min);
  const percent = `${Math.min(100, Math.max(0, progress * 100))}% ` as any;

  return (
    <LinearGradient
      colors={currentStyle.gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.floatingCard,
        {
          borderColor: currentStyle.border,
          borderWidth: 1
        }
      ]}
    >
      {/* Header: Rank/Name & Check In */}
      <View style={styles.cardHeader}>
        <View style={styles.rankInfo}>
          <Text style={[styles.userName, { color: currentStyle.text }]}>
            {user?.username || 'Guest'}
          </Text>
          <View style={[styles.rankBadge, { backgroundColor: currentStyle.badgeBg }]}>
            <Ionicons name="trophy" size={12} color={currentStyle.badgeText} />
            <Text style={[styles.rankText, { color: currentStyle.badgeText }]}>{rank}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.miniCheckIn,
            {
              borderColor: rank === 'Platinum' ? '#444' : '#E0E0E0',
              backgroundColor: rank === 'Platinum' ? '#333' : '#FAFAFA',
              opacity: canCheckIn ? 1 : 0.6
            }
          ]}
          onPress={canCheckIn ? onCheckIn : undefined}
        >
          <Text style={[styles.miniCheckInText, { color: rank === 'Platinum' ? '#FFF' : '#333' }]}>
            {canCheckIn ? 'Check In' : 'Done'}
          </Text>

          {/* Animated Streak Badge */}
          {streak > 0 && (
            <Animated.View style={[styles.streakBadge, badgeStyle]}>
              <Ionicons name="flame" size={10} color="#FFF" />
              <Text style={styles.streakBadgeText}>{streak}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {/* Points Display */}
      <View style={styles.pointsRow}>
        <Text style={[styles.bigPoints, { color: currentStyle.text }]}>{points}</Text>
        <Text style={[styles.pointsLabel, { color: currentStyle.label }]}>Current Points</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBarBg, { backgroundColor: currentStyle.progressTrack }]}>
          <View style={[styles.progressBarFill, { width: percent, backgroundColor: currentStyle.progressFill }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: currentStyle.label }]}>Current: {points}</Text>
          <Text style={[styles.progressText, { color: currentStyle.label }]}>
            {nextRank === 'Max' ? 'Max Rank' : `Goal: ${max} `}
          </Text>
        </View>
        {nextRank !== 'Max' && (
          <Text style={[styles.nextRankHint, { color: currentStyle.label }]}>
            Need {max - points} more to {nextRank}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
};

export default function HomeScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme as keyof typeof Colors];
  const insets = useSafeAreaInsets();

  // Check In State
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [streak, setStreak] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [prizeDesc, setPrizeDesc] = useState<string | undefined>(undefined);
  const [isLuckyDraw, setIsLuckyDraw] = useState(false);
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number | undefined>(undefined);

  // Fetch Status
  const fetchStatus = async () => {
    try {
      const status = await api.getCheckInStatus();
      setStreak(status.total_streak);
      setCanCheckIn(status.can_check_in);
      if (status.points !== undefined) {
        setCurrentPoints(status.points);
      }
    } catch (e) {
      console.log("Error fetching gamification status", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Determine initial points from user object if not yet fetched
    if (user?.points) setCurrentPoints(user.points);
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }, []);

  const handleCheckIn = async () => {
    if (!canCheckIn) {
      // Just show current streak status if already checked in?
      // Or disable button. For now let's assume button disabled or shows toast.
      Alert.alert("Already Checked In", "You have already checked in today. Come back tomorrow!");
      return;
    }

    try {
      const res = await api.performCheckIn();

      // Update local state based on result
      setStreak(res.streak);
      setPointsEarned(res.points_added);
      setCurrentPoints(res.new_total_points); // Update points immediately
      setPrizeDesc(res.prize);
      setIsLuckyDraw(res.cycle_day === 7); // OR res.has_voucher
      setCanCheckIn(false);

      // Show Animation
      setShowCheckIn(true);

      // Refresh User Pts (Context update would be ideal here)
      // user.points = res.new_total_points;

    } catch (e: any) {
      Alert.alert("Check In Failed", e.error || "Something went wrong.");
    }
  };

  // Slideshow State
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Auto Scroll
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSlide < SLIDES.length - 1) {
        scrollRef.current?.scrollTo({ x: (activeSlide + 1) * width, animated: true });
        setActiveSlide(activeSlide + 1);
      } else {
        scrollRef.current?.scrollTo({ x: 0, animated: true });
        setActiveSlide(0);
      }
    }, 4000); // 4 seconds

    return () => clearInterval(interval);
  }, [activeSlide]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    if (slide !== activeSlide) {
      setActiveSlide(slide);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={{ paddingBottom: 100 }}
        snapToOffsets={[0, 260]}
        snapToEnd={false}
        decelerationRate="fast"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
        }
      >
        {/* Full Width Slideshow */}
        <View style={styles.slideshowContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {SLIDES.map((slide, index) => (
              <View key={slide.id} style={{ width, height: 380 }}>
                <Image
                  source={{ uri: slide.image }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                {/* Gradient Overlay for text visibility if needed, or keeping it clean like Luckin */}
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: index === activeSlide ? '#FFF' : 'rgba(255,255,255,0.5)' }
                ]}
              />
            ))}
          </View>
        </View>

        {/* Curved Design Block Container */}
        <View style={[styles.contentContainer, { backgroundColor: theme.background }]}>

          {/* Floating Member Card (Bridging sections) */}
          <FloatingMemberCard
            user={user}
            theme={theme}
            onCheckIn={handleCheckIn}
            streak={streak}
            canCheckIn={canCheckIn}
            currentPoints={currentPoints}
          />

          {/* Action Banners */}
          <View style={styles.bannerRow}>
            {/* Order Now - Main Action */}
            <TouchableOpacity style={[styles.mainBanner, { backgroundColor: '#E3F2FD' }]}>
              <View>
                <Text style={[styles.bannerTitle, { color: '#1565C0' }]}>ORDER{'\n'}NOW</Text>
                <Text style={[styles.bannerSubtitle, { color: '#64B5F6' }]}>Collect & Delivery</Text>
              </View>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2927/2927347.png' }}
                style={styles.bannerIcon}
              />
            </TouchableOpacity>

            {/* Wallet / Referral - Secondary Action */}
            <TouchableOpacity style={[styles.mainBanner, { backgroundColor: '#FFEBEE' }]}>
              <View>
                <Text style={[styles.bannerTitle, { color: '#C62828' }]}>MY{'\n'}REFERRAL</Text>
                <Text style={[styles.bannerSubtitle, { color: '#EF5350' }]}>Get Rewards</Text>
              </View>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3898/3898144.png' }}
                style={styles.bannerIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Top Picks Header */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Picks</Text>
            <TouchableOpacity>
              <Text style={{ color: '#999' }}>More</Text>
            </TouchableOpacity>
          </View>

          {/* Product Grid */}
          <View style={styles.productGrid}>
            {PRODUCTS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.productCard, { backgroundColor: theme.card }]}
              >
                <View style={styles.productImageWrapper}>
                  <Image source={{ uri: item.image }} style={styles.productImage} />
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{item.discount}</Text>
                  </View>
                </View>
                <View style={styles.productInfo}>
                  <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.currentPrice}>RM {item.price}</Text>
                    <Text style={styles.originalPrice}>RM {item.originalPrice}</Text>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceTagText}>{item.discount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

        </View>
      </ScrollView>

      {/* Check In Success Modal */}
      <CheckInSuccess
        visible={showCheckIn}
        streakDays={streak}
        pointsEarned={pointsEarned}
        prizeDescription={prizeDesc}
        isLuckyDraw={isLuckyDraw}
        onClose={() => setShowCheckIn(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slideshowContainer: {
    height: 380,
    width: '100%',
    position: 'relative',
  },
  pagination: {
    position: 'absolute',
    bottom: 50, // Moved up to account for the overlap
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contentContainer: {
    marginTop: -30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 0, // Reset padding as the card will provide spacing via margin
    paddingHorizontal: Layout.spacing.lg,
    minHeight: 500,
  },
  floatingCard: {
    marginTop: -40,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rankInfo: {
    gap: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  rankText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#856404',
    textTransform: 'uppercase',
  },
  miniCheckIn: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    // Ensure relative positioning for badge
    position: 'relative',
    overflow: 'visible', // Allow badge to hang out
  },
  miniCheckInText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  streakBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4500', // Fire Orange
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1.5,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  streakBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  bigPoints: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  pointsLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 6,
  },
  progressContainer: {
    gap: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  nextRankHint: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: -4,
  },
  bannerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  mainBanner: {
    flex: 1,
    height: 100,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  bannerIcon: {
    width: 50,
    height: 50,
    transform: [{ rotate: '-10deg' }, { translateX: 5 }, { translateY: 5 }],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: (width - 48 - 12) / 2, // (Screen - padding - gap) / 2
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  productImageWrapper: {
    height: 140,
    backgroundColor: '#F5F5F5',
    marginBottom: 12,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productInfo: {
    paddingHorizontal: 12,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  priceTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 2,
  },
  priceTagText: {
    color: '#D32F2F',
    fontSize: 10,
    fontWeight: '500',
  }
});
