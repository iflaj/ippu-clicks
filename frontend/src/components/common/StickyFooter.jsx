import React from 'react';
import { PhoneIcon, LockIcon } from './Icons';

export default function StickyFooter({ showAdmin = false }) {
  return (
    <footer className="w-full bg-[#141418]/95 backdrop-blur-md border-t border-[#2a2a36] py-2 sm:py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] px-3 sm:px-6 lg:px-8 shadow-[0_-8px_20px_rgba(0,0,0,0.5)] flex-shrink-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 text-xs">
        <div className="flex items-center space-x-2 text-neutral-300">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></div>
          <span className="text-neutral-400 font-medium text-[11px] sm:text-xs">Photography Booking & Inquiries:</span>
        </div>

        <div className="flex items-center space-x-2.5">
          <a
            href="tel:0722136082"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#f7d070] font-bold text-xs hover:bg-[#d4af37]/25 transition active:scale-95 shadow-sm"
          >
            <PhoneIcon className="w-3 h-3" />
            <span>0722136082</span>
          </a>

          <a
            href="https://instagram.com/ippu_clicks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-neutral-400 hover:text-amber-400 transition"
          >
            @ippu_clicks
          </a>

          {/* Admin link hidden from clients; accessible directly via /admin */}
          {showAdmin && (
            <a
              href="/admin"
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition flex items-center gap-1 pl-1"
              title="Photographer Admin Login"
            >
              <LockIcon className="w-3 h-3" />
              <span className="hidden sm:inline">Admin</span>
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
