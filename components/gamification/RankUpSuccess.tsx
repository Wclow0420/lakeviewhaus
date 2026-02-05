import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { RANKS } from '@/constants/theme';

interface RankUpSuccessProps {
    visible: boolean;
    newRank: string;
    onClose: () => void;
}

export const RankUpSuccess = ({ visible, newRank, onClose }: RankUpSuccessProps) => {
    const [phase, setPhase] = useState<'ROCKET' | 'BADGE'>('ROCKET');
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0);
    const rocketRef = useRef<LottieView>(null);
    const timeoutRef = useRef<any>(null);

    // Reset phase when opening
    useEffect(() => {
        if (visible) {
            setPhase('ROCKET');
            opacity.value = 1;
        }
    }, [visible]);

    // Rocket Phase Effect: Play & Backup Timer
    useEffect(() => {
        if (visible && phase === 'ROCKET') {
            // Force play
            setTimeout(() => rocketRef.current?.play(), 100);

            // Safety fallback: if lottie doesn't finish in 5s, force move on
            timeoutRef.current = setTimeout(() => {
                onRocketFinish();
            }, 5000);
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [visible, phase]);

    const handleClose = useCallback(() => {
        opacity.value = withTiming(0, { duration: 300 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, opacity]);

    // Handle Rocket Finish
    const onRocketFinish = () => {
        if (phase === 'BADGE') return; // Already triggered

        // Clear backup timer
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Rocket flies up, then we switch to Badge phase
        setPhase('BADGE');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Animate badge in
        scale.value = 0;
        scale.value = withSpring(1, { damping: 12 });
    };

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const badgeAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    if (!visible) return null;

    // Normalize Rank String (Handle 'gold' vs 'Gold')
    const safeRank = newRank ? (newRank.charAt(0).toUpperCase() + newRank.slice(1).toLowerCase()) : 'Bronze';
    const rankKey = safeRank as keyof typeof RANKS;
    const rankTheme = RANKS[rankKey] || RANKS['Bronze'];
    // Use the middle color of the gradient or accent for text
    const rankColor = rankTheme.accent;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, animatedStyle]} />

                {/* PHASE 1: ROCKET */}
                {phase === 'ROCKET' && (
                    <Animated.View
                        entering={FadeIn}
                        exiting={FadeOut}
                        style={StyleSheet.absoluteFill}
                    >
                        <Pressable style={styles.centerContainer} onPress={onRocketFinish}>
                            <LottieView
                                ref={rocketRef}
                                source={require('../../assets/lottie/Rocket.lottie')}
                                autoPlay
                                loop={false}
                                resizeMode="contain"
                                style={{ width: '100%', height: '100%' }}
                                onAnimationFinish={onRocketFinish}
                                speed={1.0}
                            />
                            <Text style={styles.loadingText}>Gathering Power...</Text>
                        </Pressable>
                    </Animated.View>
                )}

                {/* PHASE 2: BADGE & CONFETTI */}
                {phase === 'BADGE' && (
                    <Pressable style={styles.centerContainer} onPress={handleClose}>
                        {/* Confetti Background */}
                        <View style={StyleSheet.absoluteFill} pointerEvents="none">
                            <LottieView
                                source={require('../../assets/lottie/Confetti.lottie')}
                                autoPlay
                                loop={false}
                                resizeMode="cover"
                                style={{ width: '100%', height: '100%' }}
                            />
                        </View>

                        <Animated.View style={[styles.content, badgeAnimatedStyle]}>
                            <LottieView
                                source={require('../../assets/lottie/card_upgrade.lottie')}
                                autoPlay
                                loop
                                style={{ width: 300, height: 300 }}
                            />

                            <Text style={[styles.title, { color: rankColor }]}>LEVEL UP!</Text>
                            <Text style={styles.subtitle}>You are now a</Text>
                            <Text
                                style={[
                                    styles.rankName,
                                    {
                                        color: rankColor,
                                        textShadowColor: `${rankColor}80` // 50% opacity shadow
                                    }
                                ]}
                            >
                                {safeRank} Member
                            </Text>

                            <Text style={styles.hint}>Tap anywhere to continue</Text>
                        </Animated.View>
                    </Pressable>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.9)', // Darker background for space vibe
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        position: 'absolute',
        bottom: 100,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 16,
        letterSpacing: 2,
        fontWeight: '600'
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        marginTop: 0,
        letterSpacing: 2,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
    rankName: {
        fontSize: 32,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 8,
        marginBottom: 30,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
    hint: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    }
});
