import React from 'react';
import { InstagramIcon } from '../common/Icons';

export default function InstagramModal({ isOpen, onClose, instagramHandle = 'ippu_clicks' }) {
  if (!isOpen) return null;

  const instagramUrl = `https://instagram.com/${instagramHandle}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-[#181820] border border-[#2e2e3e] p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center text-xs font-bold transition z-10"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Brand/Instagram Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 mb-4 transform hover:scale-105 transition-transform">
          <InstagramIcon className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight">
          Welcome to Your Photos!
        </h3>

        <p className="text-xs text-neutral-300 mt-2 px-2 leading-relaxed">
          Stay connected with <strong className="text-amber-400">Ippu Clicks Photography</strong>. Follow our Instagram page for event highlights, behind-the-scenes, and fresh creative stories!
        </p>

        <div className="mt-6 space-y-3">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-red-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 hover:opacity-95 active:scale-95 transition"
          >
            <InstagramIcon className="w-4 h-4" />
            <span>Follow @{instagramHandle}</span>
          </a>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-neutral-400 hover:text-white transition active:scale-95"
          >
            Skip & Continue to Photos →
          </button>
        </div>
      </div>
    </div>
  );
}
