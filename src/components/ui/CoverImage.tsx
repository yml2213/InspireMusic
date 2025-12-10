import React, { useEffect, useRef, useState } from 'react';
import { Music } from 'lucide-react';
import { clsx } from 'clsx';

interface CoverImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  iconSize?: number | string;
  /** Optional class name for the underlying <img> */
  imageClassName?: string;
  /** How long to wait before showing the fallback when loading is slow */
  fallbackDelayMs?: number;
}

export const CoverImage = React.forwardRef<HTMLImageElement, CoverImageProps>(
  (
    {
      src,
      alt,
      className,
      iconSize = "40%",
      imageClassName,
      fallbackDelayMs = 10000,
      ...props
    },
    ref
  ) => {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showFallback, setShowFallback] = useState(false);
    const fallbackTimer = useRef<number | undefined>(undefined);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const setImageRef = (node: HTMLImageElement | null) => {
      imageRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLImageElement | null>).current = node;
      }
    };

    useEffect(() => {
      setHasError(false);
      setIsLoaded(false);
      setShowFallback(false);

      if (!src) return;

      if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
        setIsLoaded(true);
        return;
      }

      fallbackTimer.current = window.setTimeout(
        () => setShowFallback(true),
        fallbackDelayMs
      );

      return () => {
        if (fallbackTimer.current !== undefined) {
          window.clearTimeout(fallbackTimer.current);
          fallbackTimer.current = undefined;
        }
      };
    }, [src, fallbackDelayMs]);

    if (!src || hasError) {
      return (
        <div
          className={clsx(
            "relative flex items-center justify-center bg-gray-900 text-gray-600 overflow-hidden",
            className
          )}
          role="img"
          aria-label={alt}
        >
          <Music size={iconSize} />
        </div>
      );
    }

    return (
      <div
        className={clsx(
          "relative overflow-hidden bg-gray-900/80",
          className
        )}
        role="img"
        aria-label={alt}
        aria-busy={!isLoaded}
      >
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />
            {showFallback && <Music size={iconSize} className="relative" />}
          </div>
        )}

        <img
          ref={setImageRef}
          src={src}
          alt={alt}
          className={clsx(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            imageClassName
          )}
          onLoad={() => {
            setIsLoaded(true);
            setHasError(false);

            if (fallbackTimer.current !== undefined) {
              window.clearTimeout(fallbackTimer.current);
              fallbackTimer.current = undefined;
            }
          }}
          onError={() => {
            setHasError(true);

            if (fallbackTimer.current !== undefined) {
              window.clearTimeout(fallbackTimer.current);
              fallbackTimer.current = undefined;
            }
          }}
          {...props}
        />
      </div>
    );
  }
);

CoverImage.displayName = 'CoverImage';
