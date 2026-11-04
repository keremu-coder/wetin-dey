type WetinMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * The Wetin Dey mark.
 *
 * A rounded speech bubble with three voice-note bars inside.
 * The tail points down-left so the mark reads as "someone speaking",
 * not a generic chat icon. Drawn on a 100x100 viewBox so it scales
 * cleanly from 16px (tab icon) to 512px (app icon).
 *
 * Uses currentColor — the parent sets the color.
 */
export function WetinMark({ size = 24, className, title }: WetinMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ display: "block" }}
    >
      {/* Speech bubble */}
      <path
        d="M30 8 H70 A22 22 0 0 1 92 30 V50 A22 22 0 0 1 70 72 H46 L22 90 V72 A22 22 0 0 1 8 50 V30 A22 22 0 0 1 30 8 Z"
        fill="currentColor"
      />
      {/* Voice waveform bars — white, rounded */}
      <g fill="#FFFFFF">
        <rect x="34" y="32" width="6" height="16" rx="3" />
        <rect x="44" y="24" width="6" height="32" rx="3" />
        <rect x="54" y="28" width="6" height="24" rx="3" />
        <rect x="64" y="34" width="6" height="12" rx="3" />
      </g>
    </svg>
  );
}