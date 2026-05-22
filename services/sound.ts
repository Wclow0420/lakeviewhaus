import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Order alarm sound — looping chime that plays on new paid orders until staff
 * acknowledges. Configured to play even when the device is in silent mode
 * (kitchen environment is loud + this is operationally critical).
 *
 * If the asset is missing or the audio module fails to load (e.g. running on
 * a device without expo-audio linked), all calls become no-ops so the rest
 * of the app keeps working.
 */

let player: AudioPlayer | null = null;
let isLooping = false;
let initialized = false;

const initialize = async () => {
    if (initialized) return;
    try {
        await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: 'mixWithOthers',
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const asset = require('@/assets/sounds/order-alarm.mp3');
        player = createAudioPlayer(asset, { updateInterval: 500 });
        player.loop = true;
        player.volume = 1.0;
        initialized = true;
    } catch (e) {
        console.warn('[sound] Could not initialize order alarm — silent mode only', e);
        player = null;
    }
};

class SoundService {
    async startAlarm(): Promise<void> {
        await initialize();
        if (!player) return;
        if (isLooping) return;
        try {
            player.seekTo(0);
            player.play();
            isLooping = true;
        } catch (e) {
            console.warn('[sound] play failed', e);
        }
    }

    async stopAlarm(): Promise<void> {
        if (!player || !isLooping) return;
        try {
            player.pause();
            player.seekTo(0);
        } catch (e) {
            console.warn('[sound] stop failed', e);
        }
        isLooping = false;
    }

    isPlaying(): boolean {
        return isLooping;
    }
}

export const soundService = new SoundService();
