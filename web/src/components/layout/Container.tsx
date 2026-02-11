import React from 'react';

interface ContainerProps {
    children: React.ReactNode;
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({ children, className = '' }) => {
    const style: React.CSSProperties = {
        maxWidth: 'var(--container-max-width)',
        margin: '0 auto',
        padding: '0 var(--container-padding)',
        width: '100%',
    };

    return (
        <div style={style} className={className}>
            {children}
        </div>
    );
};
