import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * SUNMI sticker-label printer service.
 *
 * The native module `@mitsuharu/react-native-sunmi-printer-library` only
 * connects on actual SUNMI hardware (AIDL-binds to the SUNMI printer service
 * which is missing on regular Android phones / iOS / web). On non-SUNMI
 * devices, `prepare()` throws and `isAvailable()` returns false, so every
 * print call becomes a no-op. The Print Station setting on the merchant
 * profile additionally gates whether THIS device should print at all (in case
 * multiple SUNMIs are at one branch and only one should print).
 *
 * Idempotency: each print is keyed by order id. AsyncStorage tracks printed
 * IDs with a 24-hour TTL — covers socket replays and app reloads on the same
 * device. Failed prints push to a retry queue surfaced as a banner on the
 * merchant dashboard.
 */

// ---------- Native module loader (graceful degradation) ----------

type SunmiPrinterAPI = typeof import('@mitsuharu/react-native-sunmi-printer-library');

let SunmiPrinter: SunmiPrinterAPI | null = null;
try {
    if (Platform.OS === 'android') {
        SunmiPrinter = require('@mitsuharu/react-native-sunmi-printer-library');
    }
} catch {
    SunmiPrinter = null;
}

const PRINT_STATION_KEY = 'print_station_enabled';
const PRINTED_ORDERS_KEY = 'printed_orders';
const FAILED_PRINTS_KEY = 'failed_prints';
const TTL_HOURS = 24;

type PrintedRecord = { id: string; ts: number };

class PrinterService {
    private printStationEnabled: boolean = false;
    private nativeAvailable: boolean | null = null;

    /** Probe the native module once via prepare(); cached. */
    async probeNative(): Promise<boolean> {
        if (this.nativeAvailable !== null) return this.nativeAvailable;
        if (!SunmiPrinter) {
            this.nativeAvailable = false;
            return false;
        }
        try {
            await SunmiPrinter.prepare();
            this.nativeAvailable = true;
            return true;
        } catch {
            this.nativeAvailable = false;
            return false;
        }
    }

    /** True if this device has a SUNMI printer (independent of the toggle). */
    async isAvailable(): Promise<boolean> {
        return this.probeNative();
    }

    /** Read persisted toggle (call once on app start; cached on instance). */
    async loadPrintStation(): Promise<boolean> {
        const v = await AsyncStorage.getItem(PRINT_STATION_KEY);
        this.printStationEnabled = v === 'true';
        return this.printStationEnabled;
    }

    isPrintStation(): boolean {
        return this.printStationEnabled;
    }

    async setPrintStation(on: boolean): Promise<void> {
        this.printStationEnabled = on;
        await AsyncStorage.setItem(PRINT_STATION_KEY, on ? 'true' : 'false');
    }

    /** True if order id has been printed recently (within TTL). */
    async hasPrinted(orderId: string): Promise<boolean> {
        const records = await this.getPrintedRecords();
        return records.some(r => r.id === orderId);
    }

    async markPrinted(orderId: string): Promise<void> {
        const records = await this.getPrintedRecords();
        if (records.some(r => r.id === orderId)) return;
        records.push({ id: orderId, ts: Date.now() });
        await AsyncStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(records));
    }

    private async getPrintedRecords(): Promise<PrintedRecord[]> {
        try {
            const raw = await AsyncStorage.getItem(PRINTED_ORDERS_KEY);
            if (!raw) return [];
            const cutoff = Date.now() - TTL_HOURS * 60 * 60 * 1000;
            const parsed: PrintedRecord[] = JSON.parse(raw);
            const fresh = parsed.filter(r => r.ts > cutoff);
            if (fresh.length !== parsed.length) {
                await AsyncStorage.setItem(PRINTED_ORDERS_KEY, JSON.stringify(fresh));
            }
            return fresh;
        } catch {
            return [];
        }
    }

    // ---------- Failed-print queue ----------

    async pushFailed(orderId: string): Promise<void> {
        const queue = await this.getFailedQueue();
        if (queue.includes(orderId)) return;
        queue.push(orderId);
        await AsyncStorage.setItem(FAILED_PRINTS_KEY, JSON.stringify(queue));
    }

    async getFailedQueue(): Promise<string[]> {
        try {
            const raw = await AsyncStorage.getItem(FAILED_PRINTS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    async clearFailed(): Promise<void> {
        await AsyncStorage.removeItem(FAILED_PRINTS_KEY);
    }

    async removeFromFailedQueue(orderId: string): Promise<void> {
        const queue = await this.getFailedQueue();
        const next = queue.filter(id => id !== orderId);
        await AsyncStorage.setItem(FAILED_PRINTS_KEY, JSON.stringify(next));
    }

    // ---------- Printing primitives ----------

    /**
     * Print stickers for an order — one sticker per item × quantity.
     * Continuous-roll mode: each sticker is content + a fixed paper feed
     * (lineWrap) so the previous content clears the head and there's room
     * to tear by hand. Tune STICKER_FEED_LINES if the gap is wrong.
     * Throws if the native print fails so the caller can push to retry queue.
     */
    async printOrderStickers(order: any): Promise<void> {
        if (!SunmiPrinter) throw new Error('SUNMI printer not available on this device');
        if (!(await this.probeNative())) throw new Error('SUNMI printer service not running');

        const items: any[] = order.items || [];
        const totalCups = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

        await SunmiPrinter.prepare();

        let cupIndex = 1;
        for (const item of items) {
            const qty = item.quantity || 1;
            for (let q = 0; q < qty; q++) {
                await this.renderOneSticker(order, item, cupIndex, totalCups);
                cupIndex++;
            }
        }
    }

    private async renderOneSticker(order: any, item: any, indexN: number, totalN: number): Promise<void> {
        if (!SunmiPrinter) return;

        const fmtTime = (iso: string) => {
            try {
                const d = new Date(iso);
                return d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
            } catch {
                return '';
            }
        };

        const headerLine = `#${order.order_number}    ${indexN} of ${totalN}    ${fmtTime(order.created_at)}`;
        const optionsText = (item.selected_options || [])
            .map((o: any) => o.option_name)
            .filter(Boolean)
            .join(' · ');
        const customer = order.user?.username || '—';
        const where = order.order_type === 'pickup'
            ? 'Pickup'
            : `Table ${order.table_number || '-'}`;

        // Header: small, left-aligned
        await SunmiPrinter.setAlignment('left');
        await SunmiPrinter.setFontSize(20);
        await SunmiPrinter.printText(`${headerLine}\n`);

        // Item name: large + bold
        await SunmiPrinter.setTextStyle('bold', true);
        await SunmiPrinter.setFontSize(36);
        await SunmiPrinter.printText(`${(item.product_name || '').toUpperCase()}\n`);
        await SunmiPrinter.setTextStyle('bold', false);

        // Customizations
        if (optionsText) {
            await SunmiPrinter.setFontSize(22);
            await SunmiPrinter.printText(`${optionsText}\n`);
        }
        if (item.special_instructions) {
            await SunmiPrinter.setFontSize(22);
            await SunmiPrinter.printText(`★ ${item.special_instructions}\n`);
        }

        // Footer: customer · where
        await SunmiPrinter.setFontSize(20);
        await SunmiPrinter.printText(`${customer}  ·  ${where}\n`);

        // Feed past head + tear room (~25mm). Tune if too much / too little.
        await SunmiPrinter.lineWrap(6);
    }
}

export const printerService = new PrinterService();
