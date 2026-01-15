import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    SharedValue,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';

interface CheckInSuccessProps {
    visible: boolean;
    streakDays: number;
    pointsEarned: number;
    prizeDescription?: string;
    isLuckyDraw?: boolean;
    onClose: () => void;
}

export const CheckInSuccess = ({ visible, streakDays, pointsEarned, prizeDescription, isLuckyDraw, onClose }: CheckInSuccessProps) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const textTranslateY = useSharedValue(20);
    const textOpacity = useSharedValue(0);
    const ring1 = useSharedValue(0);
    const ring2 = useSharedValue(0);
    const boxShake = useSharedValue(0);
    const boxScale = useSharedValue(0);
    const [showPrize, setShowPrize] = React.useState(false);

    // Determine Theme based on streak
    const getTheme = (days: number) => {
        if (days >= 7) return {
            color: '#E60000', // Special Red
            glow: 'rgba(230, 0, 0, 0.4)',
            icon: 'trophy',
            title: 'Legendary!'
        };
        if (days >= 5) return {
            color: '#FF0055', // Intense Pink/Red
            glow: 'rgba(255, 0, 85, 0.4)',
            icon: 'rocket',
            title: 'Unstoppable!'
        };
        if (days >= 3) return {
            color: '#FF4500', // OrangeRed
            glow: 'rgba(255, 69, 0, 0.3)',
            icon: 'flame',
            title: 'On Fire!'
        };
        return {
            color: '#FCD259', // Gold
            glow: 'rgba(255, 215, 0, 0.2)',
            icon: 'gift',
            title: 'Checked In!'
        };
    };

    const theme = getTheme(streakDays);

    const handleClose = useCallback(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.5, { duration: 300 }, () => {
            runOnJS(setShowPrize)(false); // Reset internal state
            runOnJS(onClose)();
        });
    }, [onClose, opacity, scale]);

    useEffect(() => {
        if (visible) {
            // Reset values
            scale.value = 0;
            opacity.value = 0;
            textTranslateY.value = 20;
            textOpacity.value = 0;
            ring1.value = 0;
            ring2.value = 0;
            setShowPrize(false);

            // Animation Logic
            if (isLuckyDraw) {
                // LUCKY DRAW SEQUENCE
                // 1. Show Box (Scale Up)
                boxScale.value = withSpring(1);

                // 2. Shake Box
                boxShake.value = withDelay(400, withSequence(
                    withTiming(15, { duration: 100 }),
                    withTiming(-15, { duration: 100 }),
                    withTiming(15, { duration: 100 }),
                    withTiming(-15, { duration: 100 }),
                    withTiming(0, { duration: 100 })
                ));

                // 3. Reveal Prize (Box fades/scales down, Main Icon pop up)
                scale.value = 0; // Ensure main icon is hidden initially
                setTimeout(() => {
                    runOnJS(setShowPrize)(true);
                    boxScale.value = withTiming(0, { duration: 200 });
                    scale.value = withSpring(1, { damping: 12 });

                    // Text and Ripples enter AFTER reveal
                    textOpacity.value = withDelay(200, withTiming(1));
                    textTranslateY.value = withDelay(200, withSpring(0));

                    // Ripples
                    ring1.value = withRepeat(withTiming(1, { duration: 2000 }), -1, false);
                    ring2.value = withDelay(1000, withRepeat(withTiming(1, { duration: 2000 }), -1, false));
                }, 1200);

            } else {
                // NORMAL SEQUENCE
                boxScale.value = 0;
                setShowPrize(true); // Show immediately
                opacity.value = withTiming(1, { duration: 300 });
                scale.value = withSpring(1, { damping: 12 });

                // Expanding Ripples
                const duration = 2000;
                ring1.value = withRepeat(
                    withTiming(1, { duration, easing: Easing.out(Easing.ease) }),
                    -1,
                    false
                );
                ring2.value = withDelay(
                    1000,
                    withRepeat(
                        withTiming(1, { duration, easing: Easing.out(Easing.ease) }),
                        -1,
                        false
                    )
                );

                // Text Staggered Entry
                textOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
                textTranslateY.value = withDelay(400, withSpring(0));
            }



            // Auto-close after longer delay for lucky draw
            const timer = setTimeout(() => {
                handleClose();
            }, isLuckyDraw ? 4000 : 2000);

            return () => clearTimeout(timer);
        }
    }, [visible, streakDays, handleClose, isLuckyDraw]);

    const modalContainerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));



    const boxAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: boxScale.value }, { rotate: `${boxShake.value}deg` }],
        opacity: boxScale.value > 0.1 ? 1 : 0
    }));

    const mainIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }]
    }));

    // Ripple Style Generator
    const useRippleStyle = (progress: SharedValue<number>) => useAnimatedStyle(() => ({
        transform: [{ scale: 0.5 + (progress.value * 2.5) }], // Expand from 0.5x to 3x
        opacity: 0.6 * (1 - progress.value), // Fade out
    }));

    const ripple1Style = useRippleStyle(ring1);
    const ripple2Style = useRippleStyle(ring2);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <Pressable style={styles.overlay} onPress={handleClose}>
                <Animated.View style={[styles.backdrop, modalContainerStyle]} />



                <View style={styles.contentContainer} onStartShouldSetResponder={() => true}>

                    {/* MYSTERY BOX (Only for Lucky Draw initial state) */}
                    <Animated.View style={[styles.mysteryBoxContainer, boxAnimatedStyle]}>
                        <Ionicons name="gift-outline" size={100} color="#FCD259" />
                        <Text style={styles.mysteryText}>Opening Mystery Prize...</Text>
                    </Animated.View>

                    {/* REVEAL CONTENT */}
                    {showPrize && (
                        <>
                            {/* Expanded Ripple Background */}
                            <View style={styles.glowContainer}>
                                <Animated.View style={[styles.ripple, { backgroundColor: theme.color }, ripple1Style]} />
                                <Animated.View style={[styles.ripple, { backgroundColor: theme.color }, ripple2Style]} />
                            </View>

                            {/* Main Success Icon */}
                            <Animated.View style={[styles.iconContainer, mainIconStyle, { shadowColor: theme.color }]}>
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.color }]} />
                                <Ionicons name={theme.icon as any} size={60} color="#FFF" />
                            </Animated.View>

                            {/* Text Content */}
                            <Animated.View style={[styles.textWrapper, textStyle]}>
                                <Text style={styles.title}>{theme.title}</Text>

                                {/* Points or Prize Description */}
                                {prizeDescription ? (
                                    <Text style={[styles.points, { color: theme.color, textAlign: 'center' }]}>{prizeDescription}</Text>
                                ) : (
                                    <Text style={[styles.points, { color: theme.color }]}>+{pointsEarned} Points</Text>
                                )}

                                <View style={[styles.streakContainer, styles.highStreakContainer, { backgroundColor: theme.color, shadowColor: theme.color }]}>
                                    <Ionicons name="flame" size={20} color="#FFF" />
                                    <Text style={styles.streakText}>{streakDays} Day Streak</Text>
                                </View>
                            </Animated.View>
                        </>
                    )}
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    contentContainer: {
        width: 300,
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowContainer: {
        position: 'absolute',
        width: 300,
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ripple: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#FFF',
        shadowColor: "#FCD259",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10,
    },
    gradientBg: {
        backgroundColor: '#FCD259', // Fallback / Base color
    },
    textWrapper: {
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 8,
    },
    points: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FCD259',
        marginBottom: 16,
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    highStreakContainer: {
        backgroundColor: '#FF4500', // Solid OrangeRed pill for emphasis
        shadowColor: "#FF4500",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    streakText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },

    closeArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
    },
    mysteryBoxContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    mysteryText: {
        color: '#FCD259',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    }
});
