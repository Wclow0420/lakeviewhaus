import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastNotificationProps = {
    visible: boolean;
    title: string;
    message: string;
    type?: 'success' | 'info' | 'warning' | 'error';
    onClose: () => void;
    onPress?: () => void;
};

export const ToastNotification = ({
    visible,
    title,
    message,
    type = 'info',
    onClose,
    onPress
}: ToastNotificationProps) => {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    useEffect(() => {
        if (visible) {
            const timer = setTimeout(onClose, 4000); // Auto close after 4s
            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!visible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'warning': return 'warning';
            case 'error': return 'alert-circle';
            default: return 'notifications';
        }
    };

    const getColors = () => {
        // Use theme-aware or specific colors
        switch (type) {
            case 'success': return { bg: theme.card, accent: '#4CAF50' };
            case 'error': return { bg: theme.card, accent: '#F44336' };
            default: return { bg: theme.card, accent: theme.primary };
        }
    };

    const colors = getColors();

    return (
        <Animated.View
            entering={FadeInUp.duration(300)}
            exiting={FadeOutUp.duration(300)}
            style={[styles.wrapper, { top: insets.top + 10 }]}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                    if (onPress) onPress();
                    onClose();
                }}
                style={[
                    styles.container,
                    {
                        backgroundColor: theme.card, // Clean background
                        // borderLeftColor: colors.accent // Removed border
                    }
                ]}
            >
                <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20' }]}>
                    <Ionicons name={getIcon()} size={20} color={colors.accent} />
                </View>
                <View style={styles.content}>
                    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.icon }]} numberOfLines={2}>
                        {message}
                    </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={theme.icon} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 20,
        right: 20,
        zIndex: 1000,
        alignItems: 'center',
    },
    container: {
        flexDirection: 'row',
        width: '100%',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        // borderLeftWidth: 4, // Removed
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    message: {
        fontSize: 13,
        lineHeight: 18,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    }
});
