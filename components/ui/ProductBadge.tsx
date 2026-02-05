import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

interface ProductBadgeProps {
    type: 'new' | 'recommended';
    style?: ViewStyle;
}

export const ProductBadge: React.FC<ProductBadgeProps> = ({ type, style }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    if (type === 'recommended') {
        return (
            <View style={[styles.container, { backgroundColor: '#FFD700', zIndex: 10 }, style]}>
                <Ionicons name="star" size={10} color="#000" />
                <Text style={[styles.text, { color: '#000', marginLeft: 3 }]}>Recommended</Text>
            </View>
        );
    }

    if (type === 'new') {
        return (
            <View style={[styles.container, { backgroundColor: theme.primary, zIndex: 10 }, style]}>
                <Text style={[styles.text, { color: '#fff' }]}>NEW</Text>
            </View>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        // No shadow/elevation for cleaner look
    },
    text: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.2,
    }
});
