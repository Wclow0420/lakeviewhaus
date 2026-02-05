import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type BadgeProps = {
    count: number;
    style?: ViewStyle;
    size?: number;
};

export const Badge = ({ count, style, size = 18 }: BadgeProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    if (count <= 0) return null;

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: 'red', // Standard badge red
                width: size,
                height: size,
                borderRadius: size / 2,
            },
            style
        ]}>
            <Text style={[styles.text, { fontSize: size * 0.6 }]}>
                {count > 99 ? '99+' : count}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: -5,
        right: -5,
        zIndex: 10,
        borderWidth: 1.5,
        borderColor: '#fff', // White border to separate from icon
    },
    text: {
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
