import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'text';
    size?: 'sm' | 'md' | 'lg';
    href?: string;
    target?: string;
    rel?: string;
    className?: string;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    href,
    className = '',
    children,
    ...props
}) => {

    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-round)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        textDecoration: 'none',
        border: 'none',
        outline: 'none',
    };

    const variantStyles = {
        primary: {
            backgroundColor: 'var(--color-primary-yellow)',
            color: 'var(--color-primary-black)',
        },
        secondary: {
            backgroundColor: 'var(--color-primary-black)',
            color: 'var(--color-card-white)',
        },
        outline: {
            backgroundColor: 'transparent',
            border: '2px solid var(--color-primary-black)',
            color: 'var(--color-primary-black)',
        },
        text: {
            backgroundColor: 'transparent',
            color: 'var(--color-primary-black)',
            padding: 0,
        }
    };

    const sizeStyles = {
        sm: {
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
        },
        md: {
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
        },
        lg: {
            padding: '1rem 2rem',
            fontSize: '1.125rem',
        },
    };

    const combinedStyles = {
        ...baseStyle,
        ...variantStyles[variant],
        ...(variant !== 'text' ? sizeStyles[size] : {}),
    } as React.CSSProperties;

    const { style, ...rest } = props;

    if (href) {
        return (
            <a href={href} style={{ ...combinedStyles, ...style }} className={`button-hover ${className}`}>
                {children}
            </a>
        );
    }

    return (
        <button style={{ ...combinedStyles, ...style }} className={`button-hover ${className}`} {...rest}>
            {children}
        </button>
    );
};
