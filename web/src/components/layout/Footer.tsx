import React from 'react';
import Logo from '../../assets/images/logo.png';
import { Container } from './Container';

export const Footer: React.FC = () => {
    return (
        <footer style={{
            backgroundColor: 'var(--color-primary-black)',
            color: 'var(--color-card-white)',
            padding: '4rem 0 2rem',
            marginTop: '4rem'
        }}>
            <Container>
                <div className="flex flex-col gap-lg" style={{
                    marginBottom: '3rem',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    flexDirection: 'row'
                }}>
                    <div>
                        <div style={{ marginBottom: '1rem' }}>
                            <img
                                src={Logo}
                                alt="Lakeview Haus"
                                style={{
                                    height: '2.5rem',
                                    width: 'auto',
                                    filter: 'invert(1) brightness(2)' // Make logo white for dark footer
                                }}
                            />
                        </div>
                        <p style={{ opacity: 0.7, maxWidth: '300px' }}>
                            High class standard indoor foodcourt beside Taylor's Lakeside University.
                        </p>
                    </div>

                    <div className="flex flex-col gap-sm">
                        <h4 style={{ fontWeight: 600 }}>Links</h4>
                        <a href="/" style={{ opacity: 0.7 }}>Home</a>
                        <a href="/privacy-policy" style={{ opacity: 0.7 }}>Privacy Policy</a>
                        <a href="https://www.instagram.com/lakeview.haus/" target="_blank" rel="noopener noreferrer" style={{ opacity: 0.7 }}>Instagram</a>
                    </div>

                    <div className="flex flex-col gap-sm">
                        <h4 style={{ fontWeight: 600 }}>Download</h4>
                        <a href="#" style={{ opacity: 0.7 }}>App Store (iOS)</a>
                        <a href="#" style={{ opacity: 0.7 }}>Play Store (Android)</a>
                    </div>
                </div>

                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    fontSize: '0.875rem',
                    opacity: 0.5
                }}>
                    <p>&copy; {new Date().getFullYear()} Lakeview Haus. All rights reserved.</p>
                    <p>Designed for excellence.</p>
                </div>
            </Container>
        </footer>
    );
};
