import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

// Get screen width
const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_BAR_WIDTH = SCREEN_WIDTH * 0.85;
const TAB_COUNT = 5;
const TAB_ITEM_WIDTH = (TAB_BAR_WIDTH - 20) / TAB_COUNT; // Account for padding

// Hardcoded Warm Theme Colors
const COLORS = {
  primary: '#FCD259',
  background: '#1A1A1A',
  inactive: '#888888',
  active: '#000000',
};

// Tab icon names
const TAB_ICONS = ['home', 'gift', 'scan', 'storefront', 'person'];

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rewards/index" />
      <Tabs.Screen name="scan/index" />
      <Tabs.Screen name="store/index" />
      <Tabs.Screen name="profile/index" />
    </Tabs>
  );
}

// Custom Tab Bar Component with Animation
function CustomTabBar({ state, descriptors, navigation }: any) {
  const translateX = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);

  // Update position when active tab changes
  useEffect(() => {
    const targetX = state.index * TAB_ITEM_WIDTH;

    // Smooth slide animation - NO bounce
    translateX.value = withSpring(targetX, {
      damping: 100,  // Very high = no bounce at all
      stiffness: 400,
    });
  }, [state.index]);

  // Animated style for the indicator
  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={styles.tabBar}>
      {/* Animated Indicator */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {/* Tab Items */}
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const iconName = TAB_ICONS[index];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}>
            <Ionicons
              name={isFocused ? (iconName as any) : (`${iconName}-outline` as any)}
              size={24}
              color={isFocused ? COLORS.active : COLORS.inactive}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 34,
    marginLeft: (SCREEN_WIDTH - TAB_BAR_WIDTH) / 2,
    width: TAB_BAR_WIDTH,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  indicator: {
    position: 'absolute',
    left: 10 + (TAB_ITEM_WIDTH - 48) / 2, // Center the indicator in first tab
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
  },
  tabItem: {
    flex: 1,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
