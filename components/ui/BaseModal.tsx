import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface BaseModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    scrollable?: boolean;
    contentContainerStyle?: any;
    presentationStyle?: "fullScreen" | "pageSheet" | "formSheet" | "overFullScreen";
    containerStyle?: any;
}

export const BaseModal: React.FC<BaseModalProps> = ({
    visible,
    onClose,
    title,
    children,
    scrollable = true,
    contentContainerStyle,
    presentationStyle,
    containerStyle
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const isAndroid = Platform.OS === 'android';
    const effectivePresentationStyle = presentationStyle ?? (isAndroid ? undefined : "pageSheet");

    const handleClose = () => {
        Haptics.selectionAsync();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle={effectivePresentationStyle}
            transparent={isAndroid || effectivePresentationStyle === 'overFullScreen'}
            statusBarTranslucent={isAndroid}
            onRequestClose={onClose}
        >
            <View style={styles.modalWrapper}>
                {isAndroid && (
                    <View style={styles.backdrop} />
                )}
                <View style={[
                    styles.container,
                    {
                        backgroundColor: theme.background,
                        borderTopLeftRadius: isAndroid ? 20 : 0,
                        borderTopRightRadius: isAndroid ? 20 : 0,
                        marginTop: isAndroid ? 80 : 0,
                    },
                    containerStyle
                ]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                        <TouchableOpacity onPress={handleClose}>
                            <Text style={{ color: theme.primary, fontSize: 16 }}>Close</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {scrollable ? (
                        <ScrollView
                            contentContainerStyle={[{ paddingBottom: 40 }, contentContainerStyle]}
                            showsVerticalScrollIndicator={false}
                        >
                            {children}
                        </ScrollView>
                    ) : (
                        <View style={{ flex: 1 }}>
                            {children}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalWrapper: {
        flex: 1,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        flex: 1,
        paddingTop: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
});
