"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";

export function ZoomableAvatar({ 
  src, 
  seed, 
  size, 
  title 
}: { 
  src: string | null; 
  seed: string; 
  size: number; 
  title: string 
}) {
  const [open, setOpen] = useState(false);

  // If there's no photo (or it's private/unauthorized), just render Alama
  if (!src) {
    return <Avatar src={null} seed={seed} size={size} title={title} border />;
  }

  return (
    <>
      <button 
        type="button"
        onClick={() => setOpen(true)} 
        className="block rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand active:scale-95 transition-transform"
        aria-label="View full size photo"
      >
        <Avatar src={src} seed={seed} size={size} title={title} border />
      </button>
      
      {open && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setOpen(false)}
        >
          <button 
            className="absolute top-6 right-6 p-2 text-white/70 hover:text-white"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={src} 
            alt={title} 
            className="max-h-full max-w-full object-contain rounded-lg" 
          />
        </div>
      )}
    </>
  );
}
