import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { ActivityIndicator, Text, TextStyle, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    size = 'md',
    loading = false,
    style,
    textStyle: customTextStyle,
    disabled,
    ...props
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const getBackgroundColor = () => {
        if (disabled) return theme.inputBackground;
        switch (variant) {
            case 'primary': return theme.primary;
            case 'secondary': return theme.secondary;
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            default: return theme.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return theme.icon;
        switch (variant) {
            case 'primary': return '#fff';
            case 'secondary': return '#fff';
            case 'outline': return theme.primary;
            case 'ghost': return theme.primary;
            default: return '#fff';
        }
    };

    const getHeight = () => {
        switch (size) {
            case 'sm': return 36;
            case 'md': return 48;
            case 'lg': return 56;
            default: return 48;
        }
    };

    const containerStyle: ViewStyle = {
        backgroundColor: getBackgroundColor(),
        height: getHeight(),
        borderRadius: Layout.radius.round, // Fully rounded like pill
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Layout.spacing.lg,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: variant === 'outline' ? theme.primary : 'transparent',
        opacity: disabled ? 0.7 : 1,
    };

    const textStyle: TextStyle = {
        color: getTextColor(),
        fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
        fontWeight: '600',
    };

    const handlePressIn = () => {
        if (!disabled && !loading) {
            // Different haptic feedback based on button variant
            if (variant === 'primary' || variant === 'secondary') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
                Haptics.selectionAsync();
            }
        }
    };

    return (
        <TouchableOpacity
            style={[containerStyle, style]}
            disabled={disabled || loading}
            activeOpacity={0.8}
            onPressIn={handlePressIn}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[textStyle, customTextStyle]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};
