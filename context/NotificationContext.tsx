import { ToastNotification } from '@/components/ui/ToastNotification';
import { api } from '@/services/api';
import { socketService } from '@/services/socket';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from './AuthContext';

type Notification = {
    id: string;
    title: string;
    body: string;
    type: string;
    data?: any;
    is_read: boolean;
    created_at: string;
};

type NotificationContextType = {
    unreadCount: number;
    notifications: Notification[];
    fetchNotifications: (page?: number) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refreshUnreadCount: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType>({
    unreadCount: 0,
    notifications: [],
    fetchNotifications: async () => { },
    markAsRead: async () => { },
    markAllAsRead: async () => { },
    refreshUnreadCount: async () => { },
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, refreshProfile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Toast State
    const [toastVisible, setToastVisible] = useState(false);
    const [toastContent, setToastContent] = useState({ title: '', message: '', type: 'info' as any });

    // Fetch Unread Count
    const refreshUnreadCount = async () => {
        if (!user) return;
        try {
            const res = await api.get('/notifications/unread-count');
            setUnreadCount(res.count);
        } catch (error) {
            console.error('Failed to fetch unread count', error);
        }
    };

    // Fetch Notifications List
    const fetchNotifications = async (page = 1) => {
        try {
            const res = await api.get(`/notifications?page=${page}`);
            if (page === 1) {
                setNotifications(res.notifications);
            } else {
                setNotifications(prev => [...prev, ...res.notifications]);
            }
            // Also update count from this response if available, or fetch
            setUnreadCount(res.unread_count);
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            // Optimistic Update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            await api.post(`/notifications/${id}/read`, {});
        } catch (error) {
            console.error('Failed to mark as read', error);
            refreshUnreadCount(); // Revert on error
        }
    };

    const markAllAsRead = async () => {
        try {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            await api.post('/notifications/read-all', {});
        } catch (error) {
            console.error('Failed to mark all as read', error);
            refreshUnreadCount();
        }
    };

    const showToast = (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
        setToastContent({ title, message, type });
        setToastVisible(true);
    };

    // Socket Listener
    useEffect(() => {
        if (!user) return;

        refreshUnreadCount();

        const setupSocket = async () => {
            // Ensure socket is ready
            await socketService.init();

            const handleNewNotification = (data: any) => {
                console.log('[Notification] New Notification Received:', data);

                // 1. Increment Badge
                setUnreadCount(prev => prev + 1);

                // 2. Add to list if we have it loaded (prepend)
                setNotifications(prev => [data, ...prev]);

                // 3. Show Toast
                showToast(data.title, data.body, 'info');

                // 4. Trigger Profile Refresh if needed
                if (data.type === 'transaction' || data.type === 'lucky_draw' || data.type === 'referral') {
                    refreshProfile();
                }
            };

            socketService.on('new_notification', handleNewNotification);
        };

        setupSocket();

        return () => {
            socketService.off('new_notification');
        };
    }, [user, refreshProfile]);

    return (
        <NotificationContext.Provider value={{
            unreadCount,
            notifications,
            fetchNotifications,
            markAsRead,
            markAllAsRead,
            refreshUnreadCount
        }}>
            <View style={{ flex: 1 }} pointerEvents="box-none">
                {children}
                <ToastNotification
                    visible={toastVisible}
                    title={toastContent.title}
                    message={toastContent.message}
                    type={toastContent.type}
                    onClose={() => setToastVisible(false)}
                />
            </View>
        </NotificationContext.Provider>
    );
};
