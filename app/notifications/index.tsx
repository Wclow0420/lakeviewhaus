import { Badge } from '@/components/ui/Badge';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/theme';
import { useNotifications } from '@/context/NotificationContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Stack, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];
    const { notifications, fetchNotifications, markAsRead, markAllAsRead, refreshUnreadCount } = useNotifications();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        await fetchNotifications(1);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchNotifications(1),
            refreshUnreadCount()
        ]);
        setRefreshing(false);
    };

    const handlePress = async (item: any) => {
        if (!item.is_read) {
            await markAsRead(item.id);
        }
        // Navigate based on type if needed
        if (item.type === 'transaction') {
            // maybe open history modal?
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isRead = item.is_read;
        const iconName = item.type === 'lucky_draw' ? 'gift' : item.type === 'transaction' ? 'card' : 'notifications';
        const iconColor = item.type === 'lucky_draw' ? '#FFD700' : item.type === 'transaction' ? theme.primary : theme.text;

        return (
            <TouchableOpacity
                style={[
                    styles.itemContainer,
                    { backgroundColor: isRead ? theme.background : theme.card + '40' } // Dim background if read? Or highlight if unread
                ]}
                onPress={() => handlePress(item)}
            >
                <View style={[
                    styles.itemContent,
                    !isRead && { backgroundColor: theme.card } // Highlight unread
                ]}>
                    <View style={styles.leftCol}>
                        <View style={[styles.iconBox, { backgroundColor: theme.background }]}>
                            <Ionicons name={iconName} size={24} color={iconColor} />
                        </View>
                    </View>
                    <View style={styles.rightCol}>
                        <View style={styles.headerRow}>
                            <Text style={[styles.title, { color: theme.text, fontWeight: isRead ? '600' : '800' }]}>
                                {item.title}
                            </Text>
                            <Text style={[styles.date, { color: theme.icon }]}>
                                {format(new Date(item.created_at), 'MMM d, h:mm a')}
                            </Text>
                        </View>
                        <Text style={[styles.body, { color: theme.text }]} numberOfLines={2}>
                            {item.body}
                        </Text>
                        {!isRead && (
                            <View style={styles.unreadDot} />
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenWrapper withScrollView={false} style={{ paddingHorizontal: 0 }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
                <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={[styles.readAll, { color: theme.primary }]}>Read All</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={64} color={theme.icon} />
                            <Text style={[styles.emptyText, { color: theme.text }]}>No notifications yet</Text>
                        </View>
                    }
                />
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    readAll: {
        fontSize: 14,
        fontWeight: '600',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    itemContainer: {
        marginBottom: 8,
        paddingHorizontal: 12,
    },
    itemContent: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    leftCol: {
        marginRight: 16,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightCol: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
    },
    date: {
        fontSize: 12,
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
    },
    unreadDot: {
        position: 'absolute',
        top: 0,
        right: -8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'red',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
    }
});
