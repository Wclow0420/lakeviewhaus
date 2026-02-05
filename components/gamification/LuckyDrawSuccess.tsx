import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { Button } from '@/components/ui/Button';

interface LuckyDrawSuccessProps {
    visible: boolean;
    prizeName?: string;
    prizeType?: 'points' | 'reward';
    pointsEarned?: number;
    onClose: () => void;
}

export const LuckyDrawSuccess = ({ visible, prizeName, prizeType, pointsEarned, onClose }: LuckyDrawSuccessProps) => {
    // Flow State: 'box' -> 'prize'
    const [flowState, setFlowState] = useState<'box' | 'prize'>('box');

    // Shared Animations
    const backdropOpacity = useSharedValue(0);
    const contentScale = useSharedValue(0);

    // Box Animations
    const boxShake = useSharedValue(0);
    const boxScale = useSharedValue(0);

    const hasTriggered = React.useRef(false);

    // --- State Management ---
    const handleClose = useCallback(() => {
        backdropOpacity.value = withTiming(0, { duration: 300 });
        contentScale.value = withTiming(0, { duration: 200 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, backdropOpacity, contentScale]);

    // Initial Setup Trigger
    useEffect(() => {
        if (visible) {
            if (hasTriggered.current) return;
            hasTriggered.current = true;

            // Reset
            backdropOpacity.value = 0;
            contentScale.value = 0;
            setFlowState('box');

            // Start Entrance
            backdropOpacity.value = withTiming(1, { duration: 300 });
        } else {
            hasTriggered.current = false;
        }
    }, [visible]);

    // Flow State Reaction
    useEffect(() => {
        if (!visible) return;

        if (flowState === 'box') {
            boxScale.value = 0;
            boxScale.value = withSpring(1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        else if (flowState === 'prize') {
            contentScale.value = 0;
            contentScale.value = withSpring(1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [flowState, visible]);

    // --- Interactions ---
    const handleBoxPress = () => {
        if (flowState !== 'box') return;

        // Shake Effect
        boxShake.value = withSequence(
            withTiming(15, { duration: 100 }), withTiming(-15, { duration: 100 }),
            withTiming(15, { duration: 100 }), withTiming(-15, { duration: 100 }),
            withTiming(0, { duration: 100 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Transition after shake
        setTimeout(() => {
            boxScale.value = withTiming(0, { duration: 200 }, () => {
                runOnJS(setFlowState)('prize');
            });
        }, 600);
    };

    // --- Styles ---
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
    const boxStyle = useAnimatedStyle(() => ({
        transform: [{ scale: boxScale.value }, { rotate: `${boxShake.value}deg` }],
        opacity: boxScale.value > 0.1 ? 1 : 0
    }));
    const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: contentScale.value }] }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            {/* Overlay */}
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />

                <View style={styles.contentContainer}>

                    {/* 1. MYSTERY BOX STATE */}
                    {flowState === 'box' && (
                        <Pressable style={styles.containerFill} onPress={handleBoxPress}>
                            <Animated.View style={[styles.centerContent, boxStyle]}>
                                <LottieView
                                    source={require('@/assets/lottie/Gift.json')}
                                    autoPlay loop
                                    style={{ width: 280, height: 280 }}
                                />
                                <Text style={styles.mysteryText}>Tap to Open!</Text>
                            </Animated.View>
                        </Pressable>
                    )}

                    {/* 2. PRIZE REVEAL STATE */}
                    {flowState === 'prize' && (
                        <View style={styles.containerFill}>
                            {/* Light Burst Background */}
                            <View style={styles.burstBackground} pointerEvents="none">
                                <LottieView
                                    source={require('@/assets/lottie/Reward light effect.json')}
                                    autoPlay loop
                                    style={{ width: '100%', height: '100%', transform: [{ scale: 1.2 }] }}
                                    resizeMode="contain"
                                />
                            </View>

                            <Animated.View style={[styles.centerContent, contentStyle]}>
                                {/* Prize Icon or Animation */}
                                <LottieView
                                    source={require('@/assets/lottie/Gifts and rewards.json')}
                                    autoPlay loop
                                    style={{ width: 300, height: 300, marginBottom: -20 }}
                                />

                                <Text style={styles.title}>Congratulations!</Text>

                                <Text style={styles.prizeName}>
                                    {prizeName}
                                </Text>

                                {prizeType === 'points' && pointsEarned && (
                                    <Text style={styles.pointsValue}>+{pointsEarned} Points</Text>
                                )}

                                <Button
                                    title="Collect Prize"
                                    onPress={handleClose}
                                    style={styles.collectButton}
                                    textStyle={{ color: '#000', fontWeight: '700' }}
                                />
                            </Animated.View>
                        </View>
                    )}

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)' },
    contentContainer: { width: '100%', height: '100%' },
    containerFill: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    centerContent: { justifyContent: 'center', alignItems: 'center', width: '100%', paddingHorizontal: 30 },

    burstBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
    },

    mysteryText: {
        color: '#FCD259',
        fontSize: 22,
        fontWeight: '800',
        marginTop: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 10
    },

    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFF',
        marginBottom: 12,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 10
    },
    prizeName: {
        fontSize: 20,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 8,
        textAlign: 'center'
    },
    pointsValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FCD259',
        marginBottom: 24,
    },

    collectButton: {
        marginTop: 30,
        backgroundColor: '#FCD259',
        width: '70%',
        borderRadius: 25,
        height: 50
    }
});
