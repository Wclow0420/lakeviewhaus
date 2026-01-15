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
                <Text style={[styles.text, { color: '#000', marginLeft: 2 }]}>Recommended</Text>
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
        paddingVertical: 4,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    text: {
        fontSize: 10,
        fontWeight: 'bold',
    }
});
