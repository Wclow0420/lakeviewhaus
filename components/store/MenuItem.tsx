import { ProductBadge } from '@/components/ui/ProductBadge';
import { Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';

interface Product {
    id: number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    is_new?: boolean;
    is_recommended?: boolean;
    is_active?: boolean;
}

interface MenuItemProps {
    item: Product;
    onPress?: (item: Product) => void;
    onAddPress?: (item: Product) => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const MenuItem = React.memo(({ item, onPress, onAddPress }: MenuItemProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const isInactive = item.is_active === false;

    const scale = useSharedValue(1);
    const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const handlePressIn = () => {
        if (!isInactive) scale.value = withSpring(0.97, { damping: 15 });
    };
    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15 });
    };

    const handlePress = () => {
        if (isInactive) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        Haptics.selectionAsync();
        onPress?.(item);
    };

    const handleAddPress = (e: any) => {
        e.stopPropagation();
        if (isInactive) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        (onAddPress ?? onPress)?.(item);
    };

    return (
        <AnimatedTouchable
            style={[
                styles.card,
                { backgroundColor: theme.card },
                isInactive && { opacity: 0.55 },
                cardStyle,
            ]}
            activeOpacity={0.9}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isInactive}
        >
            {/* Image */}
            <View style={styles.imageWrapper}>
                {item.image_url ? (
                    <Image
                        source={{ uri: item.image_url.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}` }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.placeholder, { backgroundColor: theme.border }]}>
                        <Ionicons name="cafe-outline" size={32} color={theme.icon} />
                    </View>
                )}

                {/* Sold-out overlay */}
                {isInactive && (
                    <View style={styles.inactiveOverlay}>
                        <View style={styles.unavailableBadge}>
                            <Text style={styles.unavailableText}>Sold Out</Text>
                        </View>
                    </View>
                )}

                {/* Recommended / New badges */}
                {!isInactive && item.is_recommended && (
                    <View style={styles.lottieBadge}>
                        <LottieView
                            source={require('@/assets/lottie/recomended.json')}
                            autoPlay
                            loop
                            style={{ width: 40, height: 40 }}
                        />
                    </View>
                )}
                {!isInactive && item.is_new && !item.is_recommended && (
                    <ProductBadge type="new" style={{ top: 6, left: 6 }} />
                )}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={[styles.title, { color: isInactive ? theme.icon : theme.text }]} numberOfLines={2}>
                    {item.name}
                </Text>

                {item.description ? (
                    <Text style={[styles.description, { color: theme.icon }]} numberOfLines={2}>
                        {item.description}
                    </Text>
                ) : null}

                <View style={styles.bottomRow}>
                    <Text style={[styles.price, { color: isInactive ? theme.icon : theme.text }]}>
                        RM {item.price.toFixed(2)}
                    </Text>

                    {!isInactive && (
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: theme.primary }]}
                            onPress={handleAddPress}
                            activeOpacity={0.8}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="add" size={20} color={theme.secondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </AnimatedTouchable>
    );
});

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        borderRadius: Layout.radius.md,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    imageWrapper: {
        width: 104,
        height: 104,
        borderRadius: Layout.radius.md,
        overflow: 'hidden',
        marginRight: 14,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottieBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        zIndex: 10,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    title: {
        fontSize: 15,
        fontFamily: Fonts.bold,
        letterSpacing: -0.1,
    },
    description: {
        fontSize: 12,
        fontFamily: Fonts.medium,
        marginTop: 4,
        lineHeight: 16,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    price: {
        fontSize: 15,
        fontFamily: Fonts.bold,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    inactiveOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    unavailableBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#000',
    },
    unavailableText: {
        color: '#fff',
        fontSize: 10,
        fontFamily: Fonts.bold,
        letterSpacing: 0.5,
    },
});
