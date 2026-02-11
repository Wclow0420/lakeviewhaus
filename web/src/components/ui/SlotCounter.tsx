import React, { useEffect, useRef, useState } from 'react';

interface SlotCounterProps {
    value: number;
    label: string;
    suffix?: string;
    duration?: number;
}

export const SlotCounter: React.FC<SlotCounterProps> = ({ value, label, suffix = '', duration = 2000 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;

        let startTime: number | null = null;
        const startValue = 0;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            // Easing function for slot machine effect (easeOutExpo)
            const easeOut = (x: number): number => {
                return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
            };

            const current = Math.floor(easeOut(progress) * (value - startValue) + startValue);
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [isVisible, value, duration]);

    return (
        <div ref={elementRef} className="flex flex-col items-center">
            <div style={{
                fontSize: 'clamp(2.5rem, 4vw, 3.5rem)',
                fontWeight: 800,
                color: 'var(--color-primary-black)',
                lineHeight: 1,
                marginBottom: '0.5rem',
                fontVariantNumeric: 'tabular-nums', // Keeps numbers from jumping width
            }}>
                {displayValue}{suffix}
            </div>
            <div style={{
                fontSize: '1rem',
                color: 'var(--color-text-secondary)',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            }}>
                {label}
            </div>
        </div>
    );
};
