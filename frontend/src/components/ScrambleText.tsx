import React, { useState, useEffect, useRef } from 'react';
import { soundEngine } from '../audio/SoundEngine';

interface ScrambleTextProps {
  text: string;
  className?: string;
  scrambleOnHover?: boolean;
  delay?: number;
  speed?: number;
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'p' | 'div';
}

const GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ//##__++==<<>>$$';

export const ScrambleText: React.FC<ScrambleTextProps> = ({
  text,
  className = '',
  scrambleOnHover = true,
  delay = 0,
  speed = 35,
  as: Component = 'span',
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isScrambling, setIsScrambling] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const hasAnimatedRef = useRef(false);

  const startScramble = () => {
    if (isScrambling) return;
    setIsScrambling(true);

    let iteration = 0;
    const maxIterations = text.length;

    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration) {
              return text[index];
            }
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join('')
      );

      // Trigger subtle mechanical micro-tick audio
      if (Math.random() > 0.4) {
        soundEngine.playScrambleTick();
      }

      iteration += 1 / 3;

      if (iteration >= maxIterations) {
        clearInterval(interval);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, speed);
  };

  // IntersectionObserver: Scramble smoothly on scroll enter
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          setTimeout(() => {
            startScramble();
          }, delay);
        }
      },
      { threshold: 0.2 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [text, delay]);

  const handleMouseEnter = () => {
    if (scrambleOnHover && !isScrambling) {
      soundEngine.playHoverTick();
      startScramble();
    }
  };

  return (
    <Component
      ref={elementRef as any}
      onMouseEnter={handleMouseEnter}
      className={`font-mono tabular-nums inline-block tracking-tight select-none transition-colors duration-150 ${className}`}
    >
      {displayText}
    </Component>
  );
};
