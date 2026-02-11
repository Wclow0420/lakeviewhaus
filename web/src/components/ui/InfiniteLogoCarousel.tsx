import React from 'react';

interface InfiniteLogoCarouselProps {
    logos: { src: string; alt: string }[];
}

export const InfiniteLogoCarousel: React.FC<InfiniteLogoCarouselProps> = ({ logos }) => {
    // Quadruple the logos to ensure seamless looping and full width coverage
    const displayLogos = [...logos, ...logos, ...logos, ...logos];

    return (
        <div className="carousel-container">
            {/* Gradient Masks for fade effect */}
            <div className="carousel-fade-left" />
            <div className="carousel-fade-right" />

            <div className="carousel-track">
                {displayLogos.map((logo, index) => (
                    <div key={index} className="carousel-item">
                        <img
                            src={logo.src}
                            alt={logo.alt}
                        />
                    </div>
                ))}
            </div>

            <style>{`
        .carousel-container {
          width: 100%;
          padding: 3rem 0;
          background: rgba(255, 255, 255, 0.5); /* Subtle transparent white */
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-top: 1px solid rgba(0,0,0,0.05);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          overflow: hidden;
          position: relative;
        }

        .carousel-fade-left {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 100px;
          background: linear-gradient(to right, #F2F1EC, transparent);
          z-index: 2;
          pointer-events: none;
        }
        
        .carousel-fade-right {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 100px;
          background: linear-gradient(to left, #F2F1EC, transparent);
          z-index: 2;
          pointer-events: none;
        }

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); } /* Move exactly 1 set (1/4 of total) */
        }

        .carousel-track {
          display: flex;
          width: max-content; /* Allow it to be as wide as needed */
          gap: 5rem;
          animation: scroll 40s linear infinite;
          will-change: transform;
        }
        
        .carousel-track:hover {
          animation-play-state: paused;
        }

        .carousel-item {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .carousel-item img {
          height: 6.5rem; /* Increased size significantly */
          width: auto;
          object-fit: contain;
          filter: none; /* Show full original color */
          transition: transform 0.3s ease;
        }

        .carousel-item:hover img {
          transform: scale(1.1);
        }
      `}</style>
        </div>
    );
};
