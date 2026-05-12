import {
    HelpCircle,
    Lock,
    Receipt,
    RefreshCcw,
    Smartphone,
    Wallet,
} from 'lucide-react';
import React from 'react';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';

import step1Image from '../assets/payment/1.png';
import step2Image from '../assets/payment/2.png';
import step3Image from '../assets/payment/3.png';
import step4Image from '../assets/payment/4.png';
import step5Image from '../assets/payment/5.png';

type Step = {
    title: string;
    body: string;
    image: string;
    alt: string;
};

const STEPS: Step[] = [
    {
        title: '1. Browse the menu & add to cart',
        body: 'Open the Lakeview Haus app, pick your branch, and add what you want. Customise drinks (ice level, sweetness), confirm quantity, and add notes for the kitchen.',
        image: step1Image,
        alt: 'Browsing the menu and adding items in the Lakeview Haus app',
    },
    {
        title: '2. Confirm pickup or dine-in',
        body: 'Pick "Pickup" or "Dine-in" and review the final total. If your voucher covers the whole order, the button switches to "Place Free Order" and skips payment entirely.',
        image: step2Image,
        alt: 'Checkout screen showing pickup / dine-in choice and final total',
    },
    {
        title: '3. Review cart & apply a voucher',
        body: 'Open the cart to see every item, modifiers, and subtotal. Active vouchers auto-apply for the biggest savings — or pick one yourself. The line-item discount is shown before you commit.',
        image: step3Image,
        alt: 'Cart review with voucher applied and line-item discount',
    },
    {
        title: '4. Pay securely via Billplz',
        body: 'Tap "Pay Now" — we hand you off to Billplz, Malaysia\'s licensed payment gateway. Choose your preferred e-wallet (Touch \'n Go, GrabPay, Boost, or ShopeePay) and confirm. We never see or store your wallet credentials.',
        image: step4Image,
        alt: 'Billplz payment method selection',
    },
    {
        title: '5. Get your order — live status',
        body: 'When payment clears, the app jumps straight to the live order screen. Track Confirmed → Preparing → Ready in real time. If anything fails, the order auto-cancels within 5 minutes and any voucher is refunded back to your account.',
        image: step5Image,
        alt: 'Order confirmation with live status progress',
    },
];

const METHODS: { label: string; sub: string }[] = [
    { label: 'Touch \'n Go eWallet', sub: 'Quick QR / wallet pay' },
    { label: 'GrabPay', sub: 'Pay with your Grab balance' },
    { label: 'Boost', sub: 'One-tap wallet checkout' },
    { label: 'ShopeePay', sub: 'Pay from your Shopee wallet' },
];

export const PaymentFlow: React.FC = () => {
    return (
        <>
            {/* Hero */}
            <section style={{ paddingTop: '9rem', paddingBottom: '4rem', textAlign: 'center' }}>
                <Container>
                    <FadeIn>
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
                            💳 How payment works
                        </div>
                        <h1 style={{
                            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                            lineHeight: 1.05,
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            marginBottom: '1.5rem',
                            background: 'linear-gradient(180deg, #111 0%, #444 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            Pay in five taps.
                        </h1>
                        <p style={{
                            fontSize: '1.25rem',
                            color: 'var(--color-text-secondary)',
                            maxWidth: '640px',
                            margin: '0 auto 2.5rem',
                            lineHeight: 1.5,
                            fontWeight: 400,
                        }}>
                            Every order in the Lakeview Haus app goes through Malaysia&rsquo;s licensed
                            payment gateway, <strong>Billplz</strong>. Here&rsquo;s exactly what your
                            customers see — and how their money moves — from cart to confirmation.
                        </p>
                        <div className="flex gap-md justify-center" style={{ flexWrap: 'wrap' }}>
                            <Button href="#steps" size="lg">See the flow</Button>
                            <Button href="/contact" variant="outline" size="lg">Talk to us</Button>
                        </div>
                    </FadeIn>
                </Container>
            </section>

            {/* Steps */}
            <section id="steps" style={{ padding: '4rem 0', backgroundColor: '#fff' }}>
                <Container>
                    <FadeIn>
                        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                            <span style={{
                                color: 'var(--color-primary-yellow)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                            }}>
                                The Flow
                            </span>
                            <h2 style={{ fontSize: 'var(--font-size-3xl)', marginTop: '0.5rem', fontWeight: 700 }}>
                                Five steps. No surprises.
                            </h2>
                            <p style={{
                                marginTop: '1rem',
                                color: 'var(--color-text-secondary)',
                                fontSize: '1.125rem',
                                maxWidth: '560px',
                                marginInline: 'auto',
                            }}>
                                Each step is intentionally short so you always know what comes next and what we&rsquo;ll charge.
                            </p>
                        </div>
                    </FadeIn>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
                        {STEPS.map((step, i) => {
                            const reversed = i % 2 === 1;
                            return (
                                <FadeIn key={step.title} delay={100}>
                                    <div
                                        className="step-row"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr',
                                            gap: '2.5rem',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div style={{ order: reversed ? 2 : 1 }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.35rem 0.85rem',
                                                borderRadius: '999px',
                                                backgroundColor: 'rgba(252,210,89,0.18)',
                                                color: '#866100',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase',
                                                marginBottom: '1rem',
                                            }}>
                                                Step {i + 1}
                                            </div>
                                            <h3 style={{
                                                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                                                fontWeight: 700,
                                                letterSpacing: '-0.01em',
                                                lineHeight: 1.15,
                                                marginBottom: '1rem',
                                            }}>
                                                {step.title}
                                            </h3>
                                            <p style={{
                                                color: 'var(--color-text-secondary)',
                                                lineHeight: 1.7,
                                                fontSize: '1.0625rem',
                                            }}>
                                                {step.body}
                                            </p>
                                        </div>
                                        <div style={{ order: reversed ? 1 : 2, display: 'flex', justifyContent: 'center' }}>
                                            <PhoneFrame image={step.image} alt={step.alt} />
                                        </div>
                                    </div>
                                </FadeIn>
                            );
                        })}
                        <style>{`
                            @media (min-width: 900px) {
                                .step-row { grid-template-columns: 1fr 1fr !important; }
                            }
                        `}</style>
                    </div>
                </Container>
            </section>

            {/* Accepted methods */}
            <section style={{ padding: '6rem 0' }}>
                <Container>
                    <FadeIn>
                        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                            <span style={{
                                color: 'var(--color-primary-yellow)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                            }}>
                                Accepted Methods
                            </span>
                            <h2 style={{ fontSize: 'var(--font-size-3xl)', marginTop: '0.5rem', fontWeight: 700 }}>
                                Pay the way you already do.
                            </h2>
                        </div>
                    </FadeIn>
                    <FadeIn delay={150}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '1rem',
                            maxWidth: '900px',
                            margin: '0 auto',
                        }}>
                            {METHODS.map((m) => (
                                <div
                                    key={m.label}
                                    className="glass"
                                    style={{
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.25rem 1.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.875rem',
                                    }}
                                >
                                    <div style={{
                                        width: '2.5rem',
                                        height: '2.5rem',
                                        borderRadius: '999px',
                                        backgroundColor: 'rgba(252,210,89,0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Wallet size={18} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.label}</div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{m.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FadeIn>
                </Container>
            </section>

            {/* Trust / Policy */}
            <section style={{ padding: '4rem 0 6rem' }}>
                <Container>
                    <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr', maxWidth: '1000px', margin: '0 auto' }} className="trust-grid">
                        <FadeIn className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-md)' }}>
                            <Lock size={28} color="var(--color-primary-black)" />
                            <h3 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>Secure by design</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                                Payment is processed entirely on Billplz&rsquo;s PCI-DSS-compliant servers.
                                Lakeview Haus never receives or stores your card number or banking
                                credentials.
                            </p>
                        </FadeIn>
                        <FadeIn className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-md)' }} delay={100}>
                            <RefreshCcw size={28} color="var(--color-primary-black)" />
                            <h3 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>5-minute auto-cancel</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                                If payment doesn&rsquo;t complete within 5 minutes, the order is
                                automatically cancelled. Any applied voucher is returned to your account
                                so you can use it on the next try.
                            </p>
                        </FadeIn>
                        <FadeIn className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-md)' }} delay={200}>
                            <Receipt size={28} color="var(--color-primary-black)" />
                            <h3 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>Receipts in-app & by email</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                                Every successful order generates an in-app receipt under
                                <strong> Profile → Orders</strong>. Billplz also emails you a payment
                                confirmation for your records.
                            </p>
                        </FadeIn>
                        <FadeIn className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-md)' }} delay={300}>
                            <HelpCircle size={28} color="var(--color-primary-black)" />
                            <h3 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 700 }}>Refunds & disputes</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                                Charged but didn&rsquo;t get your order? Reach out at{' '}
                                <a href="mailto:justin.app.dev.1@gmail.com" style={{ color: 'var(--color-primary-black)', textDecoration: 'underline' }}>
                                    justin.app.dev.1@gmail.com
                                </a>{' '}
                                with your order number — we&rsquo;ll verify with Billplz and refund within
                                7 working days.
                            </p>
                        </FadeIn>
                    </div>
                    <style>{`
                        @media (min-width: 900px) {
                            .trust-grid { grid-template-columns: 1fr 1fr !important; }
                        }
                    `}</style>
                </Container>
            </section>

            {/* CTA */}
            <section style={{ padding: '4rem 0 6rem' }}>
                <Container>
                    <FadeIn className="glass-dark" style={{
                        borderRadius: '2rem',
                        padding: 'clamp(2.5rem, 5vw, 4rem)',
                        textAlign: 'center',
                        color: 'white',
                    }}>
                        <Smartphone size={40} style={{ marginBottom: '1rem', opacity: 0.85 }} />
                        <h2 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: '1rem' }}>
                            Pay it forward.
                        </h2>
                        <p style={{ fontSize: '1.125rem', opacity: 0.75, maxWidth: '520px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
                            Download the Lakeview Haus app to try the payment flow yourself. First order
                            unlocks a welcome voucher.
                        </p>
                        <div className="flex gap-md" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button href="/#download" size="lg">Download app</Button>
                            <Button href="/contact" variant="outline" size="lg">Contact support</Button>
                        </div>
                    </FadeIn>
                </Container>
            </section>
        </>
    );
};

/* ── Phone frame holding a real app screenshot ────────────────────────────── */

function PhoneFrame({ image, alt }: { image: string; alt: string }) {
    return (
        <div style={{
            width: '260px',
            height: '520px',
            borderRadius: '40px',
            backgroundColor: '#111',
            padding: '12px',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.25), 0 12px 24px -10px rgba(0,0,0,0.15)',
            flexShrink: 0,
        }}>
            <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '28px',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#000',
            }}>
                <img
                    src={image}
                    alt={alt}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            </div>
        </div>
    );
}
