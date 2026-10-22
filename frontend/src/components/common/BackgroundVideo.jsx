import React, { useRef, useEffect } from 'react';

export default function BackgroundVideo({ videoSrc = '/videos/bg-loop.webm' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.85; // Slightly slowed for dreamy cinematic aesthetic
      videoRef.current.play().catch(() => {
        // Handled silently for low-power mode or browser autoplay restrictions
      });
    }
  }, [videoSrc]);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="w-full h-full object-cover opacity-35 filter brightness-75 contrast-125 transition-opacity duration-1000"
      >
        <source src={videoSrc} type="video/webm" />
        <source src={videoSrc.replace('.webm', '.mp4')} type="video/mp4" />
      </video>

      {/* Cinematic dark luxury vignette and overlay for optimal text & UI contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/85 via-[#0a0a0c]/50 to-[#0a0a0c]/90 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#0a0a0c]/40 to-[#0a0a0c]/85 pointer-events-none" />
    </div>
  );
}
