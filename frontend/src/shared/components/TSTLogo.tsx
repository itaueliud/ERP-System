import React from 'react';

/**
 * TechSwiftTrix (TST) Logo Component
 * Recreates the brand logo: dark navy background, electric blue + lime green gradient TST letters,
 * orbital ring, globe icon, and tagline.
 */

interface TSTLogoProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show full wordmark below the emblem */
  showWordmark?: boolean;
  /** Show tagline (WEB · MOBILE · SOLUTIONS) */
  showTagline?: boolean;
  /** Dark background mode (for light backgrounds, use false) */
  dark?: boolean;
  className?: string;
}

const SIZES = {
  sm:  { emblem: 32,  text: 'text-xs',  sub: 'text-[9px]' },
  md:  { emblem: 48,  text: 'text-sm',  sub: 'text-[10px]' },
  lg:  { emblem: 72,  text: 'text-lg',  sub: 'text-xs' },
  xl:  { emblem: 120, text: 'text-2xl', sub: 'text-sm' },
};

/** The TST emblem SVG — orbital ring + gradient TST letters + globe */
export function TSTEmblem({ size = 48, className = '' }: { size?: number; className?: string }) {
  const id = `tst-grad-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        {/* Blue → lime gradient for TST letters */}
        <linearGradient id={`${id}-letters`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#1e90ff" />
          <stop offset="50%"  stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
        {/* Orbital ring gradient */}
        <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#1e90ff" stopOpacity="0.3" />
          <stop offset="50%"  stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#84cc16" stopOpacity="0.3" />
        </linearGradient>
        {/* Glow filter */}
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Dark navy background circle */}
      <circle cx="60" cy="60" r="58" fill="#0a1628" />
      <circle cx="60" cy="60" r="58" fill="url(#tst-bg-radial)" opacity="0.4" />

      {/* Outer orbital ring (ellipse) */}
      <ellipse cx="60" cy="60" rx="54" ry="22" stroke={`url(#${id}-ring)`} strokeWidth="2.5" fill="none"
        transform="rotate(-15 60 60)" filter={`url(#${id}-glow)`} />

      {/* Globe icon at top of ring */}
      <g transform="translate(60, 10)" filter={`url(#${id}-glow)`}>
        <circle cx="0" cy="0" r="6" stroke="#00d4ff" strokeWidth="1.2" fill="none" />
        <ellipse cx="0" cy="0" rx="3.5" ry="6" stroke="#00d4ff" strokeWidth="1" fill="none" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#00d4ff" strokeWidth="1" />
      </g>

      {/* TST letters */}
      <text x="60" y="72" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900" fontSize="38" fill={`url(#${id}-letters)`}
        filter={`url(#${id}-glow)`} letterSpacing="-1">
        TST
      </text>

      {/* Speed lines / circuit traces */}
      <line x1="8"  y1="55" x2="22" y2="55" stroke="#1e90ff" strokeWidth="1" opacity="0.4" />
      <line x1="8"  y1="60" x2="18" y2="60" stroke="#00d4ff" strokeWidth="0.8" opacity="0.3" />
      <line x1="98" y1="55" x2="112" y2="55" stroke="#84cc16" strokeWidth="1" opacity="0.4" />
      <line x1="102" y1="60" x2="112" y2="60" stroke="#84cc16" strokeWidth="0.8" opacity="0.3" />

      {/* Sparkle / lens flare at top-right of ring */}
      <circle cx="95" cy="32" r="3" fill="#eab308" opacity="0.9" filter={`url(#${id}-glow)`} />
      <circle cx="95" cy="32" r="6" fill="#eab308" opacity="0.2" />
    </svg>
  );
}

/** Full logo: emblem + wordmark + optional tagline */
export default function TSTLogo({ size = 'md', showWordmark = true, showTagline = false, dark = true, className = '' }: TSTLogoProps) {
  const s = SIZES[size];
  const textColor = dark ? 'text-white' : 'text-gray-900';
  const subColor  = dark ? 'text-white/60' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <TSTEmblem size={s.emblem} />
      {showWordmark && (
        <div>
          <div className={`font-black leading-none tracking-tight ${s.text} ${textColor}`}
            style={{ background: 'linear-gradient(90deg, #1e90ff, #00d4ff, #84cc16)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TechSwiftTrix
          </div>
          {showTagline && (
            <div className={`${s.sub} ${subColor} tracking-widest uppercase mt-0.5`}>
              Web · Mobile · Solutions
            </div>
          )}
        </div>
      )}
    </div>
  );
}
