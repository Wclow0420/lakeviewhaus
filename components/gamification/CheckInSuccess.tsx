import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';

interface CheckInSuccessProps {
    visible: boolean;
    streakDays: number;
    pointsEarned: number;
    prizeDescription?: string;
    isLuckyDraw?: boolean;
    onClose: () => void;
}

export const CheckInSuccess = ({ visible, streakDays, pointsEarned, prizeDescription, isLuckyDraw, onClose }: CheckInSuccessProps) => {
    // Flow State: 'box' -> 'prize' -> 'streak'
    // Normal days start directly at 'streak'
    const [flowState, setFlowState] = useState<'box' | 'prize' | 'streak'>('box');

    // Shared Animations
    const backdropOpacity = useSharedValue(0);
    const contentScale = useSharedValue(0);

    // Box Animations
    const boxShake = useSharedValue(0);
    const boxScale = useSharedValue(0);

    // Streak Animations
    const fireScale = useSharedValue(0);
    const fireTranslateY = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const [displayStreak, setDisplayStreak] = useState(streakDays > 1 ? streakDays - 1 : 0);

    const hasTriggered = React.useRef(false);

    // --- State Management ---
    const handleClose = useCallback(() => {
        backdropOpacity.value = withTiming(0, { duration: 300 });
        contentScale.value = withTiming(0, { duration: 200 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, backdropOpacity, contentScale]);

    const transitionToStreak = useCallback(() => {
        // Animate Out Prize
        contentScale.value = withTiming(0, { duration: 150 }, () => {
            runOnJS(setFlowState)('streak');
        });
    }, [contentScale]);

    // Initial Setup Trigger
    useEffect(() => {
        if (visible) {
            if (hasTriggered.current) return;
            hasTriggered.current = true;

            // Reset
            backdropOpacity.value = 0;
            contentScale.value = 0;

            // Start Entrance
            backdropOpacity.value = withTiming(1, { duration: 300 });

            // Set Initial State
            const initialState = isLuckyDraw ? 'box' : 'streak';
            setFlowState(initialState);
        } else {
            hasTriggered.current = false;
        }
    }, [visible, isLuckyDraw]);

    // Flow State Reaction - Triggers Entry Animations
    useEffect(() => {
        if (!visible) return;

        // Reset content scale for new entry (except for lucky draw box start which handles itself)
        // Actually, we can just use contentScale for all "Center Content" entrances.

        if (flowState === 'box') {
            boxScale.value = 0;
            boxScale.value = withSpring(1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        else if (flowState === 'prize') {
            contentScale.value = 0;
            contentScale.value = withSpring(1);
        }
        else if (flowState === 'streak') {
            // Reset Streak Values
            fireScale.value = 0;
            fireTranslateY.value = 0;
            textOpacity.value = 0;
            setDisplayStreak(streakDays > 1 ? streakDays - 1 : 0);

            // Start Animation
            contentScale.value = withSpring(1);
            fireScale.value = withSpring(1, { damping: 12 });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            fireTranslateY.value = withDelay(1000, withTiming(-50, { duration: 500, easing: Easing.out(Easing.quad) }));
            textOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));

            // Increment Number
            const timer = setTimeout(() => {
                setDisplayStreak(streakDays);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [flowState, visible, streakDays]);

    // --- Interactions ---
    const handleBoxPress = () => {
        if (flowState !== 'box') return;

        boxShake.value = withSequence(
            withTiming(15, { duration: 100 }), withTiming(-15, { duration: 100 }),
            withTiming(15, { duration: 100 }), withTiming(-15, { duration: 100 }),
            withTiming(0, { duration: 100 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Pivot -> Prize
            boxScale.value = withTiming(0, { duration: 200 }, () => {
                runOnJS(setFlowState)('prize');
            });
        }, 600);
    };

    const handlePrizeClick = () => {
        if (flowState !== 'prize') return;
        transitionToStreak();
    };

    // --- Styles ---
    const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
    const boxStyle = useAnimatedStyle(() => ({
        transform: [{ scale: boxScale.value }, { rotate: `${boxShake.value}deg` }],
        opacity: boxScale.value > 0.1 ? 1 : 0
    }));
    const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: contentScale.value }] }));
    const fireStyle = useAnimatedStyle(() => ({
        transform: [{ scale: fireScale.value }, { translateY: fireTranslateY.value }]
    }));
    const statsStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            {/* Overlay handles close ONLY if we are at the end ('streak') */}
            <Pressable style={styles.overlay} onPress={() => {
                if (flowState === 'streak') handleClose();
                else if (flowState === 'prize') handlePrizeClick();
            }}>
                <Animated.View style={[styles.backdrop, backdropStyle]} />

                <View style={styles.contentContainer}>

                    {/* 1. MYSTERY BOX STATE */}
                    {flowState === 'box' && (
                        <Pressable style={styles.containerFill} onPress={handleBoxPress}>
                            <Animated.View style={[styles.centerContent, boxStyle]}>
                                <LottieView
                                    source={require('../../assets/lottie/Gift.json')}
                                    autoPlay loop
                                    style={{ width: 250, height: 250 }}
                                />
                                <Text style={styles.mysteryText}>Tap to Open!</Text>
                            </Animated.View>
                        </Pressable>
                    )}

                    {/* 2. PRIZE REVEAL STATE */}
                    {flowState === 'prize' && (
                        <Pressable style={styles.containerFill} onPress={handlePrizeClick}>
                            {/* Light Burst Background */}
                            <View style={{ position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
                                <LottieView
                                    source={require('../../assets/lottie/Reward light effect.json')}
                                    autoPlay loop
                                    style={{ width: '100%', height: '100%', transform: [{ scale: 1.2 }] }}
                                    resizeMode="contain"
                                />
                            </View>

                            <Animated.View style={[styles.centerContent, contentStyle]}>
                                {/* Gift Icon Animation */}
                                <LottieView
                                    source={require('../../assets/lottie/Gifts and rewards.json')}
                                    autoPlay loop
                                    style={{ width: 350, height: 350, marginBottom: -20 }}
                                />

                                <Text style={styles.title}>You Won!</Text>
                                <Text style={[styles.points, { fontSize: 32, marginBottom: 20 }]}>{prizeDescription || `+${pointsEarned} Points`}</Text>
                                <Text style={styles.closeHint}>Tap anywhere to see streak</Text>
                            </Animated.View>
                        </Pressable>
                    )}

                    {/* 3. STREAK CELEBRATION STATE (Shared with Normal Day) */}
                    {flowState === 'streak' && (
                        <Pressable style={styles.containerFill} onPress={handleClose}>
                            <View style={styles.centerContent}>
                                {/* Confetti Background */}
                                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                                    <LottieView
                                        source={require('../../assets/lottie/Confetti.json')}
                                        autoPlay loop={false}
                                        resizeMode="cover"
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </View>

                                <Animated.View style={fireStyle}>
                                    <LottieView
                                        source={require('../../assets/lottie/Fire.json')}
                                        autoPlay loop
                                        style={{ width: 200, height: 200 }}
                                    />
                                </Animated.View>

                                <Animated.View style={[styles.normalContent, statsStyle]}>
                                    <Text style={styles.bigStreakNumber}>{displayStreak}</Text>
                                    <Text style={styles.streakLabel}>Day Streak</Text>
                                    <Text style={styles.pointsLabel}>+{pointsEarned} Points</Text>
                                    <Text style={[styles.closeHint, { marginTop: 40 }]}>Tap anywhere to continue</Text>
                                </Animated.View>
                            </View>
                        </Pressable>
                    )}

                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
    contentContainer: { width: '100%', height: '100%' },
    containerFill: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    centerContent: { justifyContent: 'center', alignItems: 'center' },

    mysteryText: { color: '#FCD259', fontSize: 18, fontWeight: '700', marginTop: 16 },

    title: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    points: { fontSize: 24, fontWeight: '600', color: '#FCD259', marginBottom: 16 },

    normalContent: { alignItems: 'center' },
    bigStreakNumber: { fontSize: 80, fontWeight: '900', color: '#FFF', includeFontPadding: false, lineHeight: 90 },
    streakLabel: { fontSize: 24, fontWeight: '600', color: '#FF4500', marginTop: -10 },
    pointsLabel: { fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginTop: 12 },
    closeHint: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 20 },
});
