import React, { useState } from 'react'

export function ProductImage({
  src,
  alt = 'Nông sản FreshLink',
  size = 56,
  className = '',
  style = {},
  showBadge = true,
}: {
  src?: string | null
  alt?: string
  size?: number | string
  className?: string
  style?: React.CSSProperties
  showBadge?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const defaultFallback = '/images/default-produce.svg'
  const isFallback = !src || imgError
  const displaySrc = isFallback ? defaultFallback : src

  const dim = typeof size === 'number' ? `${size}px` : size

  return (
    <div
      className={`product-image-container ${className}`}
      style={{
        width: dim,
        height: dim,
        minWidth: dim,
        minHeight: dim,
        borderRadius: 10,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f6f8f5 0%, #e7fff3 100%)',
        border: '1px solid rgba(23, 107, 69, 0.12)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 1px 4px rgba(5, 32, 24, 0.04)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        ...style,
      }}
    >
      <img
        src={displaySrc}
        alt={alt}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        loading="lazy"
      />
      {isFallback && showBadge && (
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            fontSize: 8.5,
            lineHeight: 1,
            background: 'rgba(0, 81, 49, 0.85)',
            color: '#ffffff',
            padding: '2px 4px',
            borderRadius: 4,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            pointerEvents: 'none',
            backdropFilter: 'blur(2px)',
          }}
        >
          Minh họa
        </span>
      )}
    </div>
  )
}
