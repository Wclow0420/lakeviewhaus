import React from 'react';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
            <Container>
                <FadeIn>
                    <h1 style={{ fontSize: 'var(--font-size-4xl)', marginBottom: '2rem', fontWeight: 700 }}>Privacy Policy</h1>
                    <p style={{ marginBottom: '2rem', color: 'var(--color-text-secondary)' }}>Last updated: {new Date().toLocaleDateString()}</p>
                </FadeIn>

                <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.8' }}>
                    <FadeIn delay={100}>
                        <section style={{ marginBottom: '3rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-primary-black)' }}>1. Introduction</h2>
                            <p>
                                Welcome to Lakeview Haus ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our website and in our app. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our mobile application.
                            </p>
                        </section>
                    </FadeIn>

                    <FadeIn delay={200}>
                        <section style={{ marginBottom: '3rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-primary-black)' }}>2. Information We Collect</h2>
                            <p>
                                We may collect information about you in a variety of ways. The information we may collect via the Application depends on the content and materials you use, and includes:
                            </p>
                            <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem' }}>
                                <li><strong>Personal Data:</strong> Democraphic and other personally identifiable information (such as your name and email address) that you voluntarily give to us when choosing to participate in various activities related to the Application.</li>
                                <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Application, such as your native actions that are integral to the Application.</li>
                            </ul>
                        </section>
                    </FadeIn>

                    <FadeIn delay={300}>
                        <section style={{ marginBottom: '3rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-primary-black)' }}>3. Use of Your Information</h2>
                            <p>
                                Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:
                            </p>
                            <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem' }}>
                                <li>Create and manage your account.</li>
                                <li>Email you regarding your account or order.</li>
                                <li>Fulfill and manage purchases, orders, payments, and other transactions related to the Application.</li>
                                <li>Generate a personal profile about you to make future visits to the Application more personalized.</li>
                            </ul>
                        </section>
                    </FadeIn>

                    <FadeIn delay={400}>
                        <section style={{ marginBottom: '3rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-primary-black)' }}>4. Account Deletion</h2>
                            <p>
                                You have the right to delete your account and all associated personal data at any time. To delete your account:
                            </p>
                            <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem' }}>
                                <li>Open the Lakeview Haus app.</li>
                                <li>Go to <strong>Profile</strong> &rarr; <strong>Settings</strong>.</li>
                                <li>Tap <strong>Delete Account</strong> and confirm your request.</li>
                            </ul>
                            <p style={{ marginTop: '1rem' }}>
                                Upon deletion, your personal data including your name, email address, points, and transaction history will be permanently removed from our systems within 30 days. This action is irreversible. If you have any issues deleting your account, please contact us at support@lakeviewhaus.com.
                            </p>
                        </section>
                    </FadeIn>

                    <FadeIn delay={500}>
                        <section style={{ marginBottom: '3rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--color-primary-black)' }}>5. Contact Us</h2>
                            <p>
                                If you have questions or comments about this Privacy Policy, please contact us at:
                            </p>
                            <div style={{ marginTop: '1rem', padding: '1.5rem', backgroundColor: 'var(--color-card-white)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
                                <p><strong>Lakeview Haus Management</strong></p>
                                <p>Email: support@lakeviewhaus.com</p>
                                <p>Location: Beside Taylor's Lakeside University</p>
                            </div>
                        </section>
                    </FadeIn>

                    <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                        <Button href="/" variant="outline">Back to Home</Button>
                    </div>
                </div>
            </Container>
        </div>
    );
};
