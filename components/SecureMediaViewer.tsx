"use client";

import { useEffect, useState } from "react";

export function SecureMediaViewer({
  url,
  type,
  viewerHandle,
  onClose
}: {
  url: string;
  type: string;
  viewerHandle: string;
  onClose: () => void;
}) {
  const [watermarkPos, setWatermarkPos] = useState({ top: "10%", left: "10%" });

  // Move the watermark randomly every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 80) + 10}%`,
        left: `${Math.floor(Math.random() * 80) + 10}%`
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-full p-4" onClick={(e) => e.stopPropagation()}>
        <button 
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white z-50"
          onClick={onClose}
        >
          Close
        </button>

        {/* The Secure Container */}
        <div className="relative overflow-hidden rounded-lg">
          {type === "video" ? (
            <video 
              src={url} 
              autoPlay 
              controls 
              playsInline
              className="max-h-[85vh] max-w-full object-contain secure-media-flicker"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={url} 
              alt="Secure View Once Media" 
              className="max-h-[85vh] max-w-full object-contain secure-media-flicker pointer-events-none select-none"
            />
          )}

          {/* The Dynamic Watermark */}
          <div 
            className="absolute pointer-events-none select-none text-white/40 text-sm font-bold bg-black/30 px-2 py-1 rounded transition-all duration-1000"
            style={{ top: watermarkPos.top, left: watermarkPos.left }}
          >
            @{viewerHandle} • {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}