import React from 'react';
import { CameraIcon } from './Icons';

export default function BrandHeader({ title, subtitle, showBack, onBack, bgVideo, onToggleBgVideo }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#141418]/90 backdrop-blur-md border-b border-[#2a2a36] px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 shadow-lg flex-shrink-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {showBack && (
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-neutral-300 hover:text-white transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
              aria-label="Go back"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Back to Gate</span>
            </button>
          )}

          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-2.5">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-[#d4af37]/60 shadow-md bg-white p-0.5 flex-shrink-0">
              <img
                src="/brand-logo.jpg"
                alt="Ippu Clicks Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1.5 leading-tight">
                <span>Ippu Clicks</span>
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[#f7d070] border border-[#d4af37]/40">
                  PRO
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                {subtitle || "Event Photography Portal"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onToggleBgVideo && (
            <button
              type="button"
              onClick={onToggleBgVideo}
              className="text-[11px] px-2.5 py-1.5 rounded-full bg-[#1c1c24] hover:bg-[#252532] border border-[#2a2a36] hover:border-amber-500/40 text-neutral-300 hover:text-white transition flex items-center gap-1.5 shadow-sm"
              title="Toggle background video: Nature Stars Timelapse vs Camera Optical Bokeh"
            >
              <span>{bgVideo === 'bokeh' ? '📷 Bokeh' : '🌌 Nature'}</span>
            </button>
          )}

          <a
            href="https://wa.me/254759125207"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 font-semibold flex items-center gap-1.5 hover:bg-[#25D366]/20 transition shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
            <span>WhatsApp Support</span>
          </a>
        </div>
      </div>
    </header>
  );
}
