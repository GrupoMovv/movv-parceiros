import { useEffect, useRef, useState } from 'react';

// Fade-in + slight rise quando o elemento entra na viewport. Usado nas
// seções da home pra dar uma sensação de "carregamento" sem dado assíncrono real.
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${className}`}
      style={{
        opacity: visivel ? 1 : 0,
        transform: visivel ? 'translateY(0)' : 'translateY(16px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
