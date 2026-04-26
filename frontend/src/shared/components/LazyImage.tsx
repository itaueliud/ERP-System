/**
 * LazyImage — lazy-loads images using the native loading="lazy" attribute
 * with an IntersectionObserver fallback for older browsers (Req 37.3, 37.10).
 *
 * Also accepts an optional `cdnBase` prop so callers can prefix the src with
 * the CDN origin without changing every call site (Req 37.6).
 */
import React, { useRef, useState, useEffect, ImgHTMLAttributes } from 'react';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Optional CDN base URL — prepended to relative src values */
  cdnBase?: string;
  /** Low-quality placeholder shown while the real image loads */
  placeholder?: string;
  /** Tailwind / CSS class applied to the wrapper div */
  wrapperClassName?: string;
}

const supportsNativeLazy =
  typeof window !== 'undefined' && 'loading' in HTMLImageElement.prototype;

export function LazyImage({
  src,
  alt,
  cdnBase,
  placeholder,
  wrapperClassName,
  className,
  ...rest
}: LazyImageProps) {
  const resolvedSrc =
    cdnBase && !src.startsWith('http') ? `${cdnBase.replace(/\/$/, '')}/${src.replace(/^\//, '')}` : src;

  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(
    supportsNativeLazy ? resolvedSrc : (placeholder ?? '')
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // IntersectionObserver fallback for browsers without native lazy loading
  useEffect(() => {
    if (supportsNativeLazy) return;

    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCurrentSrc(resolvedSrc);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [resolvedSrc]);

  return (
    <div className={wrapperClassName ?? 'relative overflow-hidden'}>
      {!loaded && placeholder && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover blur-sm ${className ?? ''}`}
        />
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`${className ?? ''} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        {...rest}
      />
    </div>
  );
}

export default LazyImage;
