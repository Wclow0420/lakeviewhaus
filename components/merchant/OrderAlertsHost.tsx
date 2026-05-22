import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { socketService } from '@/services/socket';
import { printerService } from '@/services/printer';
import { soundService } from '@/services/sound';
import { Colors, Fonts, Layout } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AcknowledgeOrdersModal } from '@/components/modals/merchant/AcknowledgeOrdersModal';

/**
 * Mounts inside the merchant tab layout. Owns all the cross-tab order-alert
 * behavior so it works regardless of which merchant tab the user is currently
 * on:
 *   1. Listens to `order_update` socket events
 *   2. When a paid order arrives that we haven't already printed:
 *      a. Print stickers (if Print Station is enabled)
 *      b. Push to ack queue
 *      c. Start the looping alarm
 *   3. Renders the floating "New orders" banner + Acknowledge modal
 *   4. Tracks failed prints; shows a yellow retry banner
 */

export function OrderAlertsHost() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    // Loaded once on mount so we don't poll AsyncStorage on every event
    const [printStationOn, setPrintStationOn] = useState(false);
    const [printerAvailable, setPrinterAvailable] = useState(false);

    // Pending acknowledgements (paid orders that haven't been ack'd yet)
    const [ackQueue, setAckQueue] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Failed prints — shown as a separate retry banner
    const [failedCount, setFailedCount] = useState(0);

    // Refresh the failed count periodically (cheap; Map-backed)
    const refreshFailedCount = useCallback(async () => {
        const q = await printerService.getFailedQueue();
        setFailedCount(q.length);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [enabled, available] = await Promise.all([
                printerService.loadPrintStation(),
                printerService.isAvailable(),
            ]);
            if (!cancelled) {
                setPrintStationOn(enabled);
                setPrinterAvailable(available);
            }
            await refreshFailedCount();
        })();
        return () => { cancelled = true; };
    }, [refreshFailedCount]);

    // Re-check toggle on every order_update so the user can flip the switch
    // mid-shift and have it take effect immediately on the next order.
    const reloadStation = useCallback(async () => {
        const enabled = await printerService.loadPrintStation();
        setPrintStationOn(enabled);
    }, []);

    useEffect(() => {
        const handler = async (data: any) => {
            if (!data || !data.id) return;
            // Only paid orders trigger print + alarm
            if (data.payment_status !== 'paid' || data.status === 'cancelled') return;

            // Idempotency: don't re-process orders we've already handled
            const already = await printerService.hasPrinted(data.id);
            if (already) return;

            // Re-read the toggle in case it was just turned on
            await reloadStation();
            const isStation = printerService.isPrintStation();
            const canPrint = printerAvailable && isStation;

            // Mark before any side effect to avoid races on rapid duplicate emits
            await printerService.markPrinted(data.id);

            // 1) PRINT
            if (canPrint) {
                try {
                    await printerService.printOrderStickers(data);
                } catch (e: any) {
                    console.warn('[alerts] print failed', e?.message || e);
                    await printerService.pushFailed(data.id);
                    await refreshFailedCount();
                }
            }

            // 2) Push to ack queue + start alarm — only on the print station
            // (other devices stay silent; they still see updates via the dashboard)
            if (isStation) {
                setAckQueue((prev) =>
                    prev.find((o) => o.id === data.id) ? prev : [...prev, data]
                );
                soundService.startAlarm().catch(() => { });
                try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch { }
            }
        };

        socketService.on('order_update', handler);
        return () => socketService.off('order_update', handler);
    }, [printerAvailable, reloadStation, refreshFailedCount]);

    const acknowledgeAll = useCallback(() => {
        soundService.stopAlarm().catch(() => { });
        setAckQueue([]);
        setModalVisible(false);
    }, []);

    const retryFailed = useCallback(async () => {
        const queue = await printerService.getFailedQueue();
        if (queue.length === 0) return;
        // We don't have full order objects here — best-effort: re-print from any
        // queued ack-pending order matching the IDs. Otherwise, leave queued.
        const remaining: string[] = [];
        for (const id of queue) {
            const orderInQueue = ackQueue.find((o) => o.id === id);
            if (!orderInQueue) {
                remaining.push(id);
                continue;
            }
            try {
                await printerService.printOrderStickers(orderInQueue);
                await printerService.removeFromFailedQueue(id);
            } catch {
                remaining.push(id);
            }
        }
        await refreshFailedCount();
        if (remaining.length > 0) {
            // eslint-disable-next-line no-console
            console.log('[alerts] some failed prints remain — open the order detail and tap Reprint');
        }
    }, [ackQueue, refreshFailedCount]);

    const showAckBanner = ackQueue.length > 0;
    const showFailedBanner = failedCount > 0;

    return (
        <>
            {/* Floating banners stacked at the top */}
            <View style={styles.bannerStack} pointerEvents="box-none">
                {showAckBanner && (
                    <TouchableOpacity
                        style={[styles.banner, styles.ackBanner]}
                        onPress={() => setModalVisible(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="notifications" size={20} color="#FFFFFF" />
                        <Text style={styles.bannerText}>
                            🔔 {ackQueue.length} new order{ackQueue.length !== 1 ? 's' : ''} — tap to acknowledge
                        </Text>
                    </TouchableOpacity>
                )}
                {showFailedBanner && (
                    <TouchableOpacity
                        style={[styles.banner, styles.failedBanner]}
                        onPress={retryFailed}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="warning" size={20} color="#000000" />
                        <Text style={[styles.bannerText, { color: '#000000' }]}>
                            {failedCount} sticker{failedCount !== 1 ? 's' : ''} failed to print — tap to retry
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <AcknowledgeOrdersModal
                visible={modalVisible}
                orders={ackQueue}
                onAcknowledgeAll={acknowledgeAll}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
}

const TOP_INSET = Platform.OS === 'ios' ? 56 : 36;

const styles = StyleSheet.create({
    bannerStack: {
        position: 'absolute',
        top: TOP_INSET,
        left: 12,
        right: 12,
        zIndex: 1000,
        gap: 8,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: Layout.radius.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 6,
    },
    ackBanner: {
        backgroundColor: '#E53935',
    },
    failedBanner: {
        backgroundColor: '#FFC107',
    },
    bannerText: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.bold,
        color: '#FFFFFF',
        letterSpacing: -0.1,
    },
});
