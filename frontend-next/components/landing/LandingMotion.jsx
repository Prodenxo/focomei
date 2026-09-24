'use client';

import { useEffect, useRef, useState } from 'react';

/** Entrada suave quando o bloco aparece na tela (equivale ao Reveal do Expo). */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  x = 0,
  scale = 1,
  className = '',
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible ? 'true' : 'false'}
      className={`landing-reveal ${className}`}
      style={{
        '--reveal-delay': `${delay}ms`,
        '--reveal-y': `${y}px`,
        '--reveal-x': `${x}px`,
        '--reveal-scale': scale,
      }}
    >
      {children}
    </div>
  );
}

export function PulseDot({ className = '' }) {
  return <span className={`landing-pulse-dot ${className}`} aria-hidden />;
}
