import { alamaFrom, ATTIRE_PATH, HEADWEAR_PATH } from "@/lib/alama";

type AlamaProps = {
  seed: string;
  size?: number;
  title?: string;
};

function Eyes({ expression, color }: { expression: number; color: string }) {
  if (expression === 2) {
    // Wink — left eye open, right eye closed
    return (
      <g stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="41" cy="52" r="2" fill={color} stroke="none" />
        <path d="M56 52 Q59 50 62 52" />
      </g>
    );
  }
  if (expression === 1) {
    // Smile — closed happy eyes
    return (
      <g stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M38 52 Q41 49 44 52" />
        <path d="M56 52 Q59 49 62 52" />
      </g>
    );
  }
  // Calm — two open eyes
  return (
    <g fill={color}>
      <circle cx="41" cy="52" r="2.2" />
      <circle cx="59" cy="52" r="2.2" />
    </g>
  );
}

function Mouth({ expression, color }: { expression: number; color: string }) {
  if (expression === 1) {
    // Smile
    return <path d="M43 63 Q50 68 57 63" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />;
  }
  // Calm / wink — flat
  return <path d="M45 64 L55 64" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />;
}

export function Alama({ seed, size = 48, title }: AlamaProps) {
  const a = alamaFrom(seed);
  const safeSeed = typeof seed === "string" && seed.length > 0 ? seed : "anon";
  const uid = safeSeed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "anon";
  const bgId = `al-bg-${uid}`;
  const auraId = `al-aura-${uid}`;
  const clipId = `al-clip-${uid}`;
  const faceShadow = "rgba(0,0,0,0.18)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a.bgColor} />
          <stop offset="100%" stopColor={a.bgColor2} />
        </linearGradient>
        <radialGradient id={auraId} cx="50%" cy="45%" r="55%">
          <stop offset="55%" stopColor={a.auraColor} stopOpacity="0" />
          <stop offset="85%" stopColor={a.auraColor} stopOpacity={a.aura === 3 ? 0.55 : 0.32} />
          <stop offset="100%" stopColor={a.auraColor} stopOpacity={a.aura === 3 ? 0.9 : 0.55} />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* 1. Background */}
        <rect width="100" height="100" fill={`url(#${bgId})`} />

        {/* 2. Background geometry — Adire spirals / Nsibidi lines / clean */}
        {a.bg === 0 || a.bg === 3 || a.bg === 5 ? (
          <g stroke={a.auraColor === "transparent" ? "#ffffff" : a.auraColor} strokeWidth="0.6" opacity="0.09" fill="none">
            {[20, 35, 50, 65, 80].map((r) => (
              <circle key={r} cx="50" cy="55" r={r} />
            ))}
          </g>
        ) : null}
        {a.bg === 1 || a.bg === 4 ? (
          <g stroke="#ffffff" strokeWidth="0.5" opacity="0.06">
            {[-20, 0, 20, 40, 60, 80, 100, 120].map((x) => (
              <line key={x} x1={x} y1="0" x2={x + 60} y2="100" />
            ))}
          </g>
        ) : null}
        {a.bg === 2 ? (
          <g stroke="#ffffff" strokeWidth="0.5" opacity="0.08" fill="none">
            {[30, 45, 60, 75].map((y) => (
              <path key={y} d={`M0 ${y} Q25 ${y - 8} 50 ${y} T100 ${y}`} />
            ))}
          </g>
        ) : null}

        {/* 3. Aura ring (uncommon+ rarities) */}
        {a.aura > 0 ? (
          <>
            <rect width="100" height="100" fill={`url(#${auraId})`} />
            <circle cx="50" cy="50" r="47" fill="none" stroke={a.auraColor} strokeWidth={a.aura === 3 ? 2 : 1.2} opacity={a.aura === 3 ? 1 : 0.7} />
            {a.aura === 3 ? (
              <circle cx="50" cy="50" r="44" fill="none" stroke={a.auraColor} strokeWidth="0.6" opacity="0.5" />
            ) : null}
          </>
        ) : null}

        {/* 4. Attire (shoulders + chest) */}
        <path d={ATTIRE_PATH[a.attire]} fill={a.attireColor} />
        {/* Neckline detail */}
        <path
          d={a.attire === 0 ? "M38 72 L50 84 L62 72" : "M42 76 L50 82 L58 76"}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* 5. Neck */}
        <rect x="45" y="58" width="10" height="14" fill={a.skinColor} />

        {/* 6. Head */}
        <ellipse cx="50" cy="48" rx="16" ry="18" fill={a.skinColor} />
        {/* Soft shadow on one side for depth */}
        <path d="M60 34 Q66 46 60 62 Q56 60 56 48 Q56 38 60 34 Z" fill={faceShadow} opacity="0.5" />

        {/* 7. Ears */}
        <ellipse cx="34" cy="50" rx="2.5" ry="4" fill={a.skinColor} />
        <ellipse cx="66" cy="50" rx="2.5" ry="4" fill={a.skinColor} />

        {/* 8. Headwear */}
        <path d={HEADWEAR_PATH[a.headwear]} fill={a.headwearColor} />
        {a.headwear === 3 ? (
          // Crown jewels
          <g fill="#8B1A1A">
            <circle cx="50" cy="11" r="1.4" />
            <circle cx="36" cy="17" r="1.2" />
            <circle cx="64" cy="17" r="1.2" />
          </g>
        ) : null}
        {a.headwear === 1 ? (
          // Gele fold hint
          <path d="M32 24 Q50 18 68 24" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        ) : null}

        {/* 9. Face */}
        <Eyes expression={a.expression} color="#1B1B1B" />
        <Mouth expression={a.expression} color="#1B1B1B" />
        {/* Brow hint */}
        <g stroke="#1B1B1B" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
          <path d="M37 46 Q41 44 45 46" />
          <path d="M55 46 Q59 44 63 46" />
        </g>

        {/* 10. Accessory */}
        {a.accessory === 0 ? (
          // Beads across the chest
          <g fill={a.accessoryColor}>
            {[40, 45, 50, 55, 60].map((x) => (
              <circle key={x} cx={x} cy="80" r="1.4" />
            ))}
          </g>
        ) : null}
        {a.accessory === 1 ? (
          // Single pendant
          <circle cx="50" cy="83" r="2.5" fill={a.accessoryColor} />
        ) : null}
        {a.accessory === 2 ? (
          // Collar stripe
          <path d="M38 78 L62 78" stroke={a.accessoryColor} strokeWidth="1.6" strokeLinecap="round" />
        ) : null}
        {a.accessory === 3 ? null : null}

        {/* 11. Rarity flourish — legendary gets a top-right star */}
        {a.rarity === "legendary" ? (
          <g transform="translate(82 18)">
            <path d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" fill="#D4AF37" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}