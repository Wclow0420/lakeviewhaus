import { ProductBadge } from '@/components/ui/ProductBadge';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    isLast?: boolean;
}

export const MenuItem = React.memo(({ item, onPress, isLast }: MenuItemProps) => {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const isInactive = item.is_active === false;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isLast && { borderBottomWidth: 0 },
                isInactive && { opacity: 0.5 }
            ]}
            onPress={() => {
                if (!isInactive) {
                    Haptics.selectionAsync();
                    onPress?.(item);
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            }}
            disabled={isInactive}
            activeOpacity={isInactive ? 1 : 0.7}
        >
            {/* Image Section */}
            <View style={styles.imageContainer}>
                {/* Fallback image or activity indicator could be good, but for now simple image */}
                {item.image_url ? (
                    <Image
                        source={{ uri: item.image_url.startsWith('http') ? item.image_url : `${API_URL}${item.image_url}` }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="cafe-outline" size={32} color={theme.icon} />
                    </View>
                )}

                {/* Grayed out overlay for inactive items */}
                {isInactive && (
                    <View style={styles.inactiveOverlay}>
                        <View style={[styles.unavailableBadge, { backgroundColor: '#000' }]}>
                            <Text style={styles.unavailableText}>Sold Out</Text>
                        </View>
                    </View>
                )}

                {/* Badges - Overlay */}
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
                {!isInactive && item.is_new && !item.is_recommended && <ProductBadge type="new" style={{ top: 4, left: 4 }} />}
            </View>

            {/* Content Section */}
            <View style={styles.content}>
                <Text style={[styles.title, { color: isInactive ? theme.icon : theme.text }]} numberOfLines={2}>{item.name}</Text>

                {item.description ? (
                    <Text style={[styles.description, { color: theme.icon }]} numberOfLines={1}>
                        {item.description}
                    </Text>
                ) : null}

                <Text style={[styles.price, isInactive && { color: theme.icon }]}>RM {item.price.toFixed(2)}</Text>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F0F0F0',
        height: 110,
    },
    imageContainer: {
        width: 86,
        height: 86,
        borderRadius: 8,
        overflow: 'visible', // Allow Lottie to overflow if needed, or keep it contained
        marginRight: 12,
    },
    lottieBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        zIndex: 10,
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    placeholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    description: {
        fontSize: 12,
        marginTop: 4,
        color: '#999',
    },
    price: {
        fontSize: 17,
        fontWeight: '700',
        color: '#E53935',
    },
    inactiveOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unavailableBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    unavailableText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    }
});
