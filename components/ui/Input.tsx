import React from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    containerStyle,
    style,
    ...props
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.inputBackground,
                        color: theme.text,
                        borderColor: error ? theme.error : 'transparent',
                        borderWidth: error ? 1 : 0,
                    },
                    style
                ]}
                placeholderTextColor={theme.icon}
                {...props}
            />
            {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Layout.spacing.md,
    },
    label: {
        marginBottom: Layout.spacing.xs,
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4,
    },
    input: {
        height: 52, // Taller modern inputs
        borderRadius: Layout.radius.lg,
        paddingHorizontal: Layout.spacing.md,
        fontSize: 16,
    },
    error: {
        marginTop: 4,
        fontSize: 12,
        marginLeft: 4,
    },
});
