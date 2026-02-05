/**
 * Lakeview Haus Theme
 * Style: Modern Warm (Beige/Yellow/Black)
 * Inspiration: Clean financial/lifestyle app with floating nav
 */

import { Platform } from 'react-native';

// Colors from the screenshot inspiration
const primaryYellow = '#FCD259'; // The warm yellow/mustard
const primaryBlack = '#000000';
const backgroundBeige = '#F2F1EC'; // Soft off-white
const cardWhite = '#FFFFFF';
const textPrimary = '#000000';
const textSecondary = '#666666';

export const Colors = {
  light: {
    text: textPrimary,
    background: backgroundBeige,
    card: cardWhite,

    primary: primaryYellow,
    secondary: primaryBlack, // Used for buttons often
    success: '#27AE60',
    error: '#EB5757',

    tint: primaryBlack,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: primaryYellow, // Or black box with yellow icon

    border: '#E0E0E0',
    inputBackground: '#FFFFFF',

    // Specific UI Elements
    tabBarBackground: '#111111', // Black floating bar
  },
  dark: {
    text: textPrimary,
    background: backgroundBeige,
    card: cardWhite,

    primary: primaryYellow,
    secondary: primaryBlack, // Used for buttons often
    success: '#27AE60',
    error: '#EB5757',

    tint: primaryBlack,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: primaryYellow, // Or black box with yellow icon

    border: '#E0E0E0',
    inputBackground: '#FFFFFF',

    // Specific UI Elements
    tabBarBackground: '#111111', // Black floating bar
  },
  darkbackup: {
    // Dark mode backup (though the design is light-centric)
    text: '#FFFFFF',
    background: '#121212',
    card: '#1E1E1E',

    primary: primaryYellow,
    secondary: '#FFFFFF',
    success: '#6FCF97',
    error: '#EB5757',

    tint: primaryYellow,
    icon: '#ABABAB',
    tabIconDefault: '#666666',
    tabIconSelected: primaryYellow,

    border: '#333333',
    inputBackground: '#2C2C2E',
    tabBarBackground: '#000000',
  },
};

export const Layout = {
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    round: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
};

export const Fonts = Platform.select({
  ios: { sans: 'System', rounded: 'System' },
  android: { sans: 'Roboto', rounded: 'Roboto' },
  default: { sans: 'System', rounded: 'System' },
});

export const RANKS = {
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
    gradient: ['#ffffffff', '#bbbbbbff', '#f1f1f1ff', '#a3a3a3ff', '#bbbbbbff'], // Solid Silver
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
