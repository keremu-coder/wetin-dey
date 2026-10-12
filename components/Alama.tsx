import { alamaFrom, SHAPE_PATH } from "@/lib/alama";

type AlamaProps = {
  seed: string;
  size?: number;
  title?: string;
};

/**
 * Alama — the personal mark.
 *
 * Every user without a profile photo gets one. Deterministic from the
 * seed (session id, handle, or slug) so the same person always sees the
 * same mark. Shapes are drawn inside a 100x100 viewBox; the SVG is
 * scaled by `size`. Rarity is baked into the geometry, not the API —
 * the market side comes later, the mark comes first.
 */
export function Alama({ seed, size = 48, title }: AlamaProps) {
  const a = alamaFrom(seed);
  const clipId = `alama-clip-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;

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
        <clipPath id={clipId}>
          <path d={SHAPE_PATH[a.shape]} />
        </clipPath>
      </defs>

      <path d={SHAPE_PATH[a.shape]} fill={a.bg} />

      <g clipPath={`url(#${clipId})`}>
        {a.pattern === 1 ? (
          <g fill={a.fg} opacity="0.55">
            {[20, 40, 60, 80].map((y) =>
              [20, 40, 60, 80].map((x) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
              ))
            )}
          </g>
        ) : null}

        {a.pattern === 2 ? (
          <g stroke={a.fg} strokeWidth="6" opacity="0.5">
            {[-40, -20, 0, 20, 40, 60, 80, 100, 120].map((x) => (
              <line key={x} x1={x} y1="0" x2={x + 60} y2="100" />
            ))}
          </g>
        ) : null}

        {a.pattern === 3 ? (
          <g fill="none" stroke={a.fg} strokeWidth="6" opacity="0.55">
            <circle cx="50" cy="50" r="30" />
            <circle cx="50" cy="50" r="15" />
          </g>
        ) : null}

        {a.pattern === 0 ? (
          <circle cx="50" cy="50" r="34" fill={a.fg} opacity="0.18" />
        ) : null}
      </g>
    </svg>
  );
}