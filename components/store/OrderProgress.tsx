import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STEPS = [
    { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle' as const },
    { key: 'preparing', label: 'Preparing', icon: 'restaurant' as const },
    { key: 'ready', label: 'Ready', icon: 'checkmark-done' as const },
    { key: 'completed', label: 'Completed', icon: 'flag' as const },
];

const STEP_INDEX: Record<string, number> = {
    confirmed: 0,
    preparing: 1,
    ready: 2,
    completed: 3,
};

const DOT_SIZE = 32;
const TRACK_HEIGHT = 3;
// Each step occupies 1/4 of the row width; the dot centers sit at the middle
// of each quarter — i.e. at 12.5%, 37.5%, 62.5%, 87.5%. So the track must be
// inset by 12.5% on each side so it runs only between the first and last dot.
const TRACK_INSET_PCT = 100 / (STEPS.length * 2);

interface OrderProgressProps {
    status: string;
}

export function OrderProgress({ status }: OrderProgressProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme as keyof typeof Colors];

    const activeIdx = STEP_INDEX[status] ?? 0;
    const isComplete = status === 'completed';

    // Fill ratio along the track: 0 (at first dot) → 1 (at last dot)
    const fillProgress = useSharedValue(0);
    useEffect(() => {
        fillProgress.value = withSpring(activeIdx / (STEPS.length - 1), { damping: 18, stiffness: 80 });
    }, [activeIdx]);

    const fillStyle = useAnimatedStyle(() => ({
        width: `${fillProgress.value * 100}%`,
    }));

    // Pulse the active (in-progress) dot
    const pulse = useSharedValue(1);
    useEffect(() => {
        if (isComplete) {
            cancelAnimation(pulse);
            pulse.value = 1;
        } else {
            pulse.value = withRepeat(withTiming(0.55, { duration: 900 }), -1, true);
        }
        return () => cancelAnimation(pulse);
    }, [isComplete]);

    const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

    return (
        <View style={styles.container}>
            <View style={styles.dotsRow}>
                {/* Track lives between first dot center and last dot center */}
                <View
                    style={[
                        styles.track,
                        {
                            backgroundColor: theme.border,
                            top: DOT_SIZE / 2 - TRACK_HEIGHT / 2,
                            left: `${TRACK_INSET_PCT}%`,
                            right: `${TRACK_INSET_PCT}%`,
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.trackFill,
                            { backgroundColor: theme.primary },
                            fillStyle,
                        ]}
                    />
                </View>

                {/* Dots — each step gets 1/N of the row width with the dot centered */}
                {STEPS.map((step, idx) => {
                    const isPast = idx < activeIdx;
                    const isActive = idx === activeIdx;
                    const dotFilled = isPast || isActive || isComplete;
                    return (
                        <View key={step.key} style={styles.stepCol}>
                            <Animated.View
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor: dotFilled ? theme.primary : theme.card,
                                        borderColor: dotFilled ? theme.primary : theme.border,
                                    },
                                    isActive && !isComplete ? pulseStyle : null,
                                ]}
                            >
                                {dotFilled ? (
                                    <Ionicons name={step.icon} size={16} color={theme.secondary} />
                                ) : null}
                            </Animated.View>
                        </View>
                    );
                })}
            </View>

            {/* Labels — share the same flex distribution so each label centers under its dot */}
            <View style={styles.labelRow}>
                {STEPS.map((step, idx) => {
                    const isPast = idx < activeIdx;
                    const isActive = idx === activeIdx;
                    const lit = isPast || isActive || isComplete;
                    return (
                        <View key={step.key} style={styles.labelCol}>
                            <Text
                                style={[
                                    styles.label,
                                    {
                                        color: lit ? theme.text : theme.icon,
                                        fontFamily: isActive && !isComplete ? Fonts.bold : Fonts.medium,
                                    },
                                ]}
                                numberOfLines={1}
                            >
                                {step.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignSelf: 'stretch',           // fill parent width (status section uses alignItems: center)
        paddingVertical: 20,
        paddingHorizontal: 8,
        marginTop: 12,
    },
    dotsRow: {
        flexDirection: 'row',
        position: 'relative',
        height: DOT_SIZE,
    },
    track: {
        position: 'absolute',
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: TRACK_HEIGHT / 2,
    },
    stepCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    labelCol: {
        flex: 1,
        alignItems: 'center',
    },
    label: {
        fontSize: 11,
        textAlign: 'center',
        letterSpacing: -0.1,
    },
});
