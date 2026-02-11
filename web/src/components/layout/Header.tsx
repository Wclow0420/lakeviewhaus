import React, { useEffect, useState } from 'react';
import Logo from '../../assets/images/logo.png';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show the "pill" style when scrolled down a bit
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const headerContainerStyle: React.CSSProperties = {
        position: 'fixed',
        top: '1.5rem',
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none', // Let clicks pass through the sides
    };

    const navPillStyle: React.CSSProperties = {
        pointerEvents: 'auto', // Re-enable clicks
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: isScrolled ? 'auto' : '100%',
        maxWidth: isScrolled ? '800px' : '1200px', // Shrink width on scroll for pill effect
        padding: '0.5rem 1.5rem',
        borderRadius: '999px',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: isScrolled
            ? '0 10px 40px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.2) inset'
            : 'none',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        margin: '0 1.5rem', // Margin for mobile safety
    };

    const navLinkStyle = {
        fontWeight: 500,
        fontSize: '0.9rem',
        color: 'var(--color-primary-black)',
        padding: '0.5rem 1rem',
        borderRadius: '999px',
        transition: 'background-color 0.2s',
    };

    return (
        <div style={headerContainerStyle}>
            <nav style={navPillStyle}>
                {/* Logo */}
                <a
                    href="/"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: isScrolled ? '2rem' : '0',
                        textDecoration: 'none',
                    }}
                >
                    <img
                        src={Logo}
                        alt="Lakeview Haus"
                        style={{
                            height: '2rem',
                            width: 'auto',
                            objectFit: 'contain',
                            marginRight: '0.75rem'
                        }}
                    />
                    <span style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        color: 'var(--color-primary-black)',
                    }}>
                        Lakeview Haus
                    </span>
                </a>

                {/* Desktop Nav */}
                <div className="desktop-nav" style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }}>
                    <style>{`
            @media (min-width: 768px) {
              .desktop-nav { display: flex !important; }
              .mobile-toggle { display: none !important; }
            }
            .nav-link:hover {
              background-color: rgba(0,0,0,0.05);
            }
          `}</style>
                    <a href="/#about" style={navLinkStyle} className="nav-link">About</a>
                    <a href="/#features" style={navLinkStyle} className="nav-link">Features</a>
                    <a href="/contact" style={navLinkStyle} className="nav-link">Contact Us</a>
                    <div style={{ marginLeft: '1rem' }}></div>
                    <Button variant="primary" size="sm" href="#download">Download App</Button>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="mobile-toggle"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    style={{
                        background: 'rgba(0,0,0,0.05)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '2.5rem',
                        height: '2.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        cursor: 'pointer'
                    }}
                >
                    {isMobileMenuOpen ? '✕' : '☰'}
                </button>
            </nav >

            {/* Mobile Menu Dropdown (Separate from pill for animation) */}
            {
                isMobileMenuOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 1rem)',
                        left: '1.5rem',
                        right: '1.5rem',
                        zIndex: 49,
                        pointerEvents: 'auto',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '2rem',
                        padding: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        alignItems: 'center',
                        boxShadow: 'var(--shadow-floating)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        animation: 'fadeIn 0.3s ease-out forwards',
                    }}>
                        <a href="/#about" onClick={() => setIsMobileMenuOpen(false)} style={{ fontSize: '1.25rem', fontWeight: 600 }}>About</a>
                        <a href="/#features" onClick={() => setIsMobileMenuOpen(false)} style={{ fontSize: '1.25rem', fontWeight: 600 }}>Features</a>
                        <a href="/contact" onClick={() => setIsMobileMenuOpen(false)} style={{ fontSize: '1.25rem', fontWeight: 600 }}>Contact Us</a>
                        <Button variant="primary" size="lg" href="#download" onClick={() => setIsMobileMenuOpen(false)} style={{ width: '100%' }}>Download App</Button>
                    </div>
                )
            }
        </div >
    );
};
