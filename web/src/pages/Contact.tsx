import React, { useState } from 'react';
import { Container } from '../components/layout/Container';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/FadeIn';
import { api } from '../services/api';

export const Contact: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
        honeypot: '' // Hidden field for bot trap
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            await api.post('/contact/send', formData);

            setStatus('success');
            setFormData({ name: '', email: '', message: '', honeypot: '' });
        } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message);
        }
    };

    return (
        <Container>
            <FadeIn>
                <div style={{ padding: '8rem 0 4rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: 'var(--font-size-4xl)', marginBottom: '1.5rem', fontWeight: 700 }}>
                        Get in Touch
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', maxWidth: '600px', margin: '0 auto 3rem' }}>
                        Have a question or feedback? We'd love to hear from you.
                    </p>
                </div>

                <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderRadius: '2rem', boxShadow: 'var(--shadow-floating)' }}>
                    {status === 'success' ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Message Sent!</h3>
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                                Thank you for reaching out. We'll get back to you shortly.
                            </p>
                            <Button onClick={() => setStatus('idle')} variant="secondary">Send Another</Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Hidden Honeypot Field */}
                            <div style={{ display: 'none' }}>
                                <label>Leave this field empty</label>
                                <input type="text" name="honeypot" value={formData.honeypot} onChange={handleChange} />
                            </div>

                            <div>
                                <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: 'rgba(255,255,255,0.5)',
                                        fontSize: '1rem'
                                    }}
                                    placeholder="Your Name"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: 'rgba(255,255,255,0.5)',
                                        fontSize: '1rem'
                                    }}
                                    placeholder="your@email.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    required
                                    value={formData.message}
                                    onChange={handleChange}
                                    rows={5}
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        background: 'rgba(255,255,255,0.5)',
                                        fontSize: '1rem',
                                        fontFamily: 'inherit'
                                    }}
                                    placeholder="How can we help you?"
                                />
                            </div>

                            {status === 'error' && (
                                <p style={{ color: 'red', textAlign: 'center' }}>Error: {errorMessage}</p>
                            )}

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                disabled={status === 'loading'}
                                style={{
                                    width: '100%',
                                    marginTop: '2rem',
                                    height: '3.5rem',
                                    fontSize: '1.125rem'
                                }}
                            >
                                {status === 'loading' ? 'Sending...' : 'Send Message'}
                            </Button>
                        </form>
                    )}
                </div>
            </FadeIn>
        </Container>
    );
};
