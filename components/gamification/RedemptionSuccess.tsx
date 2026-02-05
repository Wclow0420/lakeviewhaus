import React, { useEffect, useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

interface RedemptionSuccessProps {
    visible: boolean;
    rewardName: string;
    onClose: () => void;
}

export const RedemptionSuccess = ({ visible, rewardName, onClose }: RedemptionSuccessProps) => {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0);

    const handleClose = useCallback(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0, { duration: 200 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, opacity, scale]);

    useEffect(() => {
        if (visible) {
            opacity.value = 0;
            scale.value = 0;

            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withSpring(1);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }]
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <Pressable style={styles.overlay} onPress={handleClose}>
                <View style={styles.backdrop} />

                {/* Confetti (One-shot) */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <LottieView
                        source={require('../../assets/lottie/Confetti.json')}
                        autoPlay
                        loop={false}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                    />
                </View>

                <Animated.View style={[styles.content, animatedStyle]}>
                    <LottieView
                        source={require('../../assets/lottie/Coupon.json')}
                        autoPlay
                        loop={false}
                        style={{ width: 250, height: 250 }}
                    />

                    <Text style={styles.title}>Redeemed!</Text>
                    <Text style={styles.subtitle}>Congrats on redeeming</Text>
                    <Text style={styles.rewardName}>{rewardName}</Text>

                    <Text style={styles.hint}>Tap anywhere to continue</Text>
                </Animated.View>
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
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFF',
        marginTop: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
    rewardName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FCD259', // Gold
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 30,
        textShadowColor: 'rgba(252, 210, 89, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    hint: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    }
});
