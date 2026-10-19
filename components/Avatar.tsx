import { Alama } from "./Alama";

type AvatarProps = {
  src?: string | null;
  seed: string;
  size?: number;
  title?: string;
  className?: string;
  border?: boolean;
};

export function Avatar({ src, seed, size = 48, title = "", className = "", border = false }: AvatarProps) {
  const borderClass = border ? "border border-border" : "";
  
  return (
    <div 
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper ${borderClass} ${className}`} 
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} className="h-full w-full object-cover" />
      ) : (
        <Alama seed={seed} size={size} title={title} />
      )}
    </div>
  );
}
