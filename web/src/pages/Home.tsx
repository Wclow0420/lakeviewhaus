import { Instagram, Laptop, MapPin, Waves, Wind } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';
import { InfiniteLogoCarousel } from '../components/ui/InfiniteLogoCarousel';
import { SlotCounter } from '../components/ui/SlotCounter';

// Assets
import StoreImage from '../assets/images/store.png';
import StoreLogo10 from '../assets/store/10.png';
import StoreLogo11 from '../assets/store/11.png';
import StoreLogo12 from '../assets/store/12.png';
import StoreLogo13 from '../assets/store/13.png';
import StoreLogo14 from '../assets/store/14.png';
import StoreLogo15 from '../assets/store/15.png';
import StoreLogo7 from '../assets/store/7.png';
import StoreLogo8 from '../assets/store/8.png';
import StoreLogo9 from '../assets/store/9.png';

// Real Store Logos
const LOGOS = [
    { src: StoreLogo7, alt: 'Store 7' },
    { src: StoreLogo8, alt: 'Store 8' },
    { src: StoreLogo9, alt: 'Store 9' },
    { src: StoreLogo10, alt: 'Store 10' },
    { src: StoreLogo11, alt: 'Store 11' },
    { src: StoreLogo12, alt: 'Store 12' },
    { src: StoreLogo13, alt: 'Store 13' },
    { src: StoreLogo14, alt: 'Store 14' },
    { src: StoreLogo15, alt: 'Store 15' },
];

const BubbleBackground: React.FC = () => {
    // Determine bubble count based on screen size (rough check via window is fine for initial render)
    const bubbleCount = 20;

    // Generate static random values so bubbles don't jump around on re-renders
    const bubbles = useMemo(() => {
        return Array.from({ length: bubbleCount }).map((_, i) => ({
            id: i,
            size: Math.random() * 40 + 10, // 10px to 50px
            left: Math.random() * 100, // 0% to 100%
            duration: Math.random() * 10 + 10, // 10s to 20s
            delay: Math.random() * 20, // 0s to 20s
        }));
    }, [bubbleCount]);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                zIndex: 0, // Behind content but in front of gradient background
                pointerEvents: 'none',
            }}
        >
            {bubbles.map((bubble) => (
                <div
                    key={bubble.id}
                    className="bubble"
                    style={{
                        '--bubble-size': `${bubble.size}px`,
                        '--bubble-left': `${bubble.left}%`,
                        '--rise-duration': `${bubble.duration}s`,
                        '--rise-delay': `-${bubble.delay}s`, // Negative delay to start mid-animation
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
};

export const Home: React.FC = () => {
    const heroRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleScroll = () => {
            if (heroRef.current) {
                const scrolled = window.scrollY;
                // Simple parallax effect for hero background
                heroRef.current.style.backgroundPositionY = `${scrolled * 0.5}px`;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <>
            {/* Hero Section */}
            <section
                ref={heroRef}
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: '6rem',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Mouse Tracking Spotlight - Subtle underwater tint */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    // Subtle blueish tint for underwater feel + mouse yellow spotlight
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(252, 210, 89, 0.1), transparent 80%), linear-gradient(180deg, rgba(230, 240, 255, 0.2) 0%, rgba(242, 241, 236, 1) 100%)`,
                    zIndex: -2,
                }} />

                {/* Bubble Effect */}
                <BubbleBackground />

                <Container>
                    <FadeIn>
                        <div style={{ marginBottom: '3rem', position: 'relative', zIndex: 10 }}>
                            <div style={{
                                display: 'inline-block',
                                padding: '0.5rem 1rem',
                                borderRadius: '999px',
                                backgroundColor: 'rgba(255,255,255,0.6)',
                                border: '1px solid rgba(255,255,255,0.4)',
                                marginBottom: '1.5rem',
                                backdropFilter: 'blur(10px)',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: 'var(--color-primary-black)',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
                            }}>
                                ✨ Experience Design & Dining
                            </div>

                            <h1 style={{
                                fontSize: 'var(--font-size-hero)',
                                lineHeight: 1,
                                fontWeight: 800,
                                letterSpacing: '-0.04em',
                                marginBottom: '1.5rem',
                                background: 'linear-gradient(180deg, #111 0%, #444 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                Lakeview Haus.
                            </h1>
                            <p style={{
                                fontSize: 'var(--font-size-2xl)',
                                color: 'var(--color-text-secondary)',
                                maxWidth: '650px',
                                margin: '0 auto',
                                lineHeight: 1.4,
                                fontWeight: 400,
                            }}>
                                A crafted culinary space beside Taylor's Lakeside University. Where aesthetics meet appetite.
                            </p>
                        </div>

                        <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap', marginBottom: '4rem', position: 'relative', zIndex: 10 }}>
                            <Button href="#download" size="lg" className="shadow-floating" style={{ padding: '1rem 3rem', fontSize: '1.25rem' }}>
                                Download App
                            </Button>
                        </div>
                    </FadeIn>
                </Container>
            </section>

            {/* Infinite Logo Carousel */}
            <section style={{ backgroundColor: 'white' }}>
                <InfiniteLogoCarousel logos={LOGOS} />
            </section>

            {/* About Section (Stats & Story) */}
            <section id="about" style={{ padding: '8rem 0', background: '#fff' }}>
                <Container>
                    {/* Stats Row */}
                    <FadeIn>
                        <div className="text-center" style={{ marginBottom: '3rem' }}>
                            <span style={{
                                color: 'var(--color-primary-yellow)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600,
                                fontSize: '0.875rem'
                            }}>
                                By The Numbers
                            </span>
                            <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>Growing Community</h2>
                        </div>

                        <div className="flex justify-center" style={{
                            marginBottom: '6rem',
                            flexWrap: 'wrap',
                            gap: '4rem', // "Closer" than space-between on large screens, but still distinct
                            padding: '0 1rem'
                        }}>
                            <SlotCounter value={100} label="App Downloads" suffix="+" />
                            <SlotCounter value={9} label="Premium Stores" />
                            <SlotCounter value={1000} label="Daily Visitors" suffix="+" />
                        </div>
                    </FadeIn>

                    <div className="bento-grid" style={{ alignItems: 'center' }}>
                        {/* Context Text */}
                        <FadeIn delay={200}>
                            <h2 style={{
                                fontSize: 'var(--font-size-3xl)',
                                marginBottom: '1.5rem',
                                fontWeight: 700
                            }}>
                                More Than Just A Food Court.
                            </h2>
                            <p style={{
                                fontSize: '1.125rem',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 1.6,
                                marginBottom: '2rem'
                            }}>
                                Lakeview Haus redefines the campus dining experience. We've replaced the noise and clutter of traditional cafeterias with a sanctuary of calm, modern design, and curated culinary choices.
                            </p>
                            <p style={{
                                fontSize: '1.125rem',
                                color: 'var(--color-text-secondary)',
                                lineHeight: 1.6,
                            }}>
                                Whether you're grabbing a quick bite between classes or settling in for a study session by the window, our space adapts to your rhythm.
                            </p>
                        </FadeIn>

                        {/* Feature Image */}
                        <FadeIn delay={400}>
                            <div style={{
                                position: 'relative',
                                borderRadius: '2rem',
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-floating)',
                                transform: 'rotate(2deg)',
                                transition: 'transform 0.5s ease',
                            }} className="hover-tilt">
                                <img
                                    src={StoreImage}
                                    alt="Inside Lakeview Haus"
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: 'block',
                                        borderRadius: '2rem',
                                    }}
                                />

                                <style>{`
                  .hover-tilt:hover {
                    transform: rotate(0deg) scale(1.02) !important;
                  }
                `}</style>
                            </div>
                        </FadeIn>
                    </div>
                </Container>
            </section>

            {/* Bento Grid Features Section */}
            <section id="features" style={{ padding: '8rem 0' }}>
                <Container>
                    <FadeIn>
                        <h2 className="text-center" style={{
                            fontSize: 'var(--font-size-4xl)',
                            marginBottom: '1rem',
                            fontWeight: 700
                        }}>
                            Curated for Comfort
                        </h2>
                        <p className="text-center" style={{
                            fontSize: '1.25rem',
                            color: 'var(--color-text-secondary)',
                            maxWidth: '600px',
                            margin: '0 auto 4rem'
                        }}>
                            Every detail of Lakeview Haus is designed to elevate your daily dining ritual.
                        </p>
                    </FadeIn>

                    <div className="bento-grid">
                        {/* Large Card */}
                        <FadeIn className="glass bento-span-2" style={{
                            padding: '3rem',
                            borderRadius: '2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: '300px'
                        }}>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <Waves size={48} color="var(--color-primary-yellow)" style={{ marginBottom: '1.5rem' }} />
                                <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Serenity by the Lake</h3>
                                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-secondary)', maxWidth: '500px' }}>
                                    Escape the campus hustle. Our floor-to-ceiling windows offer an uninterrupted view of the lake, bringing nature into your dining experience.
                                </p>
                            </div>
                            <div style={{
                                position: 'absolute',
                                right: '-10%',
                                bottom: '-20%',
                                width: '300px',
                                height: '300px',
                                background: 'radial-gradient(circle, var(--color-primary-yellow) 0%, transparent 70%)',
                                opacity: 0.2,
                                borderRadius: '50%',
                            }} />
                        </FadeIn>

                        {/* Tall Card */}
                        <FadeIn delay={100} className="glass bento-row-span-2" style={{
                            padding: '2.5rem',
                            borderRadius: '2rem',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <Wind size={40} style={{ marginBottom: '1.5rem' }} />
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Climate Controlled</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                                Tropical heat doesn't exist here. Enjoy a consistent, cool environment perfect for studying or socializing.
                            </p>
                            <div style={{
                                width: '100%',
                                height: '150px',
                                background: 'linear-gradient(135deg, #e0f7fa 0%, #ffffff 100%)',
                                borderRadius: '1.5rem',
                                marginTop: 'auto'
                            }} />
                        </FadeIn>

                        {/* Standard Card */}
                        <FadeIn delay={200} className="glass" style={{ padding: '2.5rem', borderRadius: '2rem' }}>
                            <MapPin size={40} style={{ marginBottom: '1.5rem' }} />
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Beside Taylor's</h3>
                            <p style={{ color: 'var(--color-text-secondary)' }}>
                                Zero commute. We are steps away from the lecture halls, making us the most convenient premium spot.
                            </p>
                        </FadeIn>

                        {/* Standard Card */}
                        <FadeIn delay={300} className="glass" style={{ padding: '2.5rem', borderRadius: '2rem', backgroundColor: '#fff' }}>
                            <Laptop size={40} style={{ marginBottom: '1.5rem' }} />
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Work Friendly</h3>
                            <p style={{ color: 'var(--color-text-secondary)' }}>
                                High-speed WiFi and plentiful power outlets for when you need to grind.
                            </p>
                        </FadeIn>
                    </div>
                </Container>
            </section>

            {/* Social Section */}
            <section style={{ padding: '6rem 0' }}>
                <Container>
                    <FadeIn className="glass-dark" style={{
                        borderRadius: '2.5rem',
                        padding: '5rem 2rem',
                        textAlign: 'center',
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <Instagram size={48} style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
                            <h2 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: '1.5rem' }}>
                                Haus Community
                            </h2>
                            <p style={{ fontSize: '1.25rem', opacity: 0.7, marginBottom: '3rem', maxWidth: '500px', margin: '0 auto 3rem' }}>
                                Join 5,000+ students and foodies. Tag us @lakeview.haus to be featured.
                            </p>
                            <Button
                                href="https://www.instagram.com/lakeview.haus/"
                                target="_blank"
                                variant="primary"
                                size="lg"
                            >
                                Follow on Instagram
                            </Button>
                        </div>

                        {/* Background decoration */}
                        <div style={{
                            position: 'absolute',
                            top: '0',
                            left: '0',
                            width: '100%',
                            height: '100%',
                            background: 'radial-gradient(circle at 100% 100%, #333 0%, transparent 60%)',
                            pointerEvents: 'none',
                        }} />
                    </FadeIn>
                </Container>
            </section>

            {/* App Download Section */}
            <section id="download" style={{ padding: '8rem 0 4rem' }}>
                <Container>
                    <div className="flex flex-col items-center text-center">
                        <FadeIn>
                            <h2 style={{ fontSize: 'var(--font-size-4xl)', marginBottom: '1.5rem' }}>
                                Skip the Queue.
                            </h2>
                            <p style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', marginBottom: '3rem', maxWidth: '500px' }}>
                                Download the Lakeview Haus app to order ahead, collect points, and redeem exclusive student deals.
                            </p>

                            <div className="flex gap-md" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Button
                                    href="#"
                                    variant="secondary"
                                    size="lg"
                                    style={{ minWidth: '220px', borderRadius: '1rem', height: '3.5rem' }}
                                >
                                    <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}></span> App Store
                                </Button>
                                <Button
                                    href="#"
                                    variant="secondary"
                                    size="lg"
                                    style={{ minWidth: '220px', borderRadius: '1rem', height: '3.5rem' }}
                                >
                                    <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>▶</span> Play Store
                                </Button>
                            </div>
                        </FadeIn>
                    </div>
                </Container>
            </section>
        </>
    );
};
