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
