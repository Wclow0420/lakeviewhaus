import { Colors, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    withScrollView?: boolean; // Option to enable scrolling if content overflows
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style, withScrollView = true }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const Content = withScrollView ? (
        <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {children}
        </ScrollView>
    ) : children;

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                style={[styles.container, style]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                {Content}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: Layout.spacing.lg,
    },
});
