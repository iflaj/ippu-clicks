import React, { useState, useEffect, useCallback } from 'react';
import { DownloadIcon, CheckIcon, UserCheckIcon, CameraIcon } from '../common/Icons';
import { clientApi } from '../../services/api';

export default function MasonryGallery({
  eventSlug,
  photos = [],
  accessType,
  allowDownloads,
  onResetAccess,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [activePhoto, setActivePhoto] = useState(null); // Lightbox preview
  const [downloadError, setDownloadError] = useState('');

  // Find active photo index in current photos array
  const activeIndex = activePhoto ? photos.findIndex((p) => p.id === activePhoto.id) : -1;

  // Navigate photos in lightbox
  const navigatePhoto = useCallback(
    (direction) => {
      if (photos.length <= 1 || activeIndex === -1) return;
      const nextIndex = (activeIndex + direction + photos.length) % photos.length;
      setActivePhoto(photos[nextIndex]);
    },
    [activeIndex, photos]
  );

  // Keyboard navigation for desktop PC (Left / Right / Escape)
  useEffect(() => {
    if (!activePhoto) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActivePhoto(null);
      if (e.key === 'ArrowLeft') navigatePhoto(-1);
      if (e.key === 'ArrowRight') navigatePhoto(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhoto, navigatePhoto]);

  const toggleSelect = (photoId) => {
    if (!allowDownloads) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map((p) => p.id)));
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0 || !allowDownloads) return;
    setIsDownloading(true);
    setDownloadError('');
    try {
      await clientApi.downloadZip(eventSlug, Array.from(selectedIds));
    } catch (err) {
      setDownloadError(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!allowDownloads || photos.length === 0) return;
    setIsDownloading(true);
    setDownloadError('');
    try {
      await clientApi.downloadZip(eventSlug, photos.map((p) => p.id));
    } catch (err) {
      setDownloadError(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5 pb-36">
      {/* Access Type & Stats Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-5 rounded-2xl bg-[#16161d] border border-[#2a2a36] shadow-lg">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {accessType === 'FACE_FILTERED' ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                  <UserCheckIcon className="w-3.5 h-3.5" />
                  <span>Your Photos ({photos.length})</span>
                </span>
                <span className="text-[10px] font-semibold text-neutral-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                  55%+ AI Face Match
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-[#f7d070] border border-amber-500/30 shadow-sm">
                <span>Entire Event Album ({photos.length} Photos)</span>
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-neutral-300 mt-1.5">
            {accessType === 'FACE_FILTERED'
              ? 'Showing photos matching 55% or higher with your face scan, sorted by highest similarity.'
              : allowDownloads
              ? 'Click any photo to expand in HD. Select multiple photos to download as a ZIP.'
              : 'Viewing only mode. Direct downloads are managed by the event host.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {allowDownloads && photos.length > 0 && (
            <button
              onClick={selectAll}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold rounded-xl bg-[#22222d] border border-[#2e2e3e] text-neutral-200 hover:text-white hover:border-[#d4af37]/40 transition active:scale-95 shadow-sm"
            >
              {selectedIds.size === photos.length ? 'Deselect All' : `Select All (${photos.length})`}
            </button>
          )}

          <button
            onClick={onResetAccess}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-neutral-300 hover:text-white hover:border-neutral-500 transition active:scale-95"
          >
            Switch Access
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-3 rounded-xl text-center">
          {downloadError}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <div className="text-center py-20 px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
            <CameraIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No Photos Found</h3>
          <p className="text-xs text-neutral-400 mt-1.5 max-w-xs mx-auto">
            {accessType === 'FACE_FILTERED'
              ? 'No matching photos were detected with your selfie. Try scanning in better lighting or enter the Event PIN.'
              : 'No photos have been uploaded to this event album yet.'}
          </p>
          <button
            onClick={onResetAccess}
            className="mt-5 px-5 py-2.5 rounded-xl bg-[#d4af37] text-black font-extrabold text-xs shadow-lg active:scale-95 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Masonry Layout - Fully Responsive for Mobile & Desktop PC */}
      <div className="masonry-grid">
        {photos.map((photo) => {
          const isSelected = selectedIds.has(photo.id);
          const thumbUrl = photo.thumbnailUrl || photo.url;

          return (
            <div
              key={photo.id}
              className={`masonry-item relative rounded-2xl overflow-hidden group border cursor-pointer transition-all duration-300 shadow-md ${
                isSelected
                  ? 'border-[#d4af37] ring-2 ring-[#d4af37] shadow-amber-500/20'
                  : 'border-[#262634] hover:border-[#d4af37]/70 hover:shadow-xl'
              }`}
              onClick={() => setActivePhoto(photo)}
            >
              <img
                src={thumbUrl}
                alt={photo.originalName || 'Event photo'}
                loading="lazy"
                className="w-full h-auto object-cover block group-hover:scale-[1.03] transition-transform duration-500"
              />

              {/* Selection Checkbox Overlay */}
              {allowDownloads && (
                <div
                  className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(photo.id);
                  }}
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      isSelected
                        ? 'bg-[#d4af37] text-black scale-105'
                        : 'bg-black/60 backdrop-blur-md text-transparent border border-white/50 hover:border-white hover:scale-105'
                    }`}
                  >
                    <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
              )}

              {/* Confidence Badge for Face Filtered */}
              {photo.matchConfidence && (
                <div
                  className={`absolute bottom-2 left-2 sm:bottom-3 sm:left-3 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-extrabold shadow-lg ${
                    photo.matchConfidence >= 80
                      ? 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-300'
                      : photo.matchConfidence >= 65
                      ? 'bg-amber-950/90 border border-amber-500/60 text-amber-300'
                      : 'bg-cyan-950/90 border border-cyan-500/60 text-cyan-300'
                  }`}
                >
                  {photo.matchConfidence}% Match
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Action Bar for Downloads (Optimized for PC & Mobile) */}
      {allowDownloads && photos.length > 0 && (
        <div className="fixed bottom-14 sm:bottom-16 left-0 right-0 z-30 px-3 sm:px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto bg-[#181820]/95 backdrop-blur-xl border border-[#333344] rounded-2xl p-2.5 shadow-[0_15px_35px_rgba(0,0,0,0.8)] flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-neutral-300 pl-2">
              {selectedIds.size > 0 ? (
                <>
                  Selected: <strong className="text-white text-sm">{selectedIds.size}</strong> photos
                </>
              ) : (
                <>Ready to download</>
              )}
            </span>

            <div className="flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <button
                  onClick={handleDownloadSelected}
                  disabled={isDownloading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                >
                  <DownloadIcon className="w-4 h-4" />
                  <span>{isDownloading ? 'Packaging...' : `Download (${selectedIds.size})`}</span>
                </button>
              ) : (
                <button
                  onClick={handleDownloadAll}
                  disabled={isDownloading}
                  className="px-4 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50"
                >
                  <DownloadIcon className="w-4 h-4" />
                  <span>{isDownloading ? 'Packaging...' : 'Download All'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Lightbox Modal with PC Keyboard Arrows & Chevron Buttons */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 animate-fade-in select-none"
          onClick={() => setActivePhoto(null)}
        >
          {/* Top Bar */}
          <div className="flex justify-between items-center text-white z-20 px-2 py-1">
            <div className="flex items-center gap-3 truncate">
              <span className="text-xs text-neutral-400 font-mono">
                {activeIndex !== -1 && `Photo ${activeIndex + 1} of ${photos.length}`}
              </span>
              {activePhoto.matchConfidence && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  {activePhoto.matchConfidence}% Match
                </span>
              )}
            </div>

            <button
              onClick={() => setActivePhoto(null)}
              className="w-10 h-10 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-white font-bold flex items-center justify-center transition active:scale-90"
              aria-label="Close Preview"
            >
              ✕
            </button>
          </div>

          {/* Center Image Container with Desktop Chevron Navigation */}
          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            {/* Previous Button */}
            {photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePhoto(-1);
                }}
                className="absolute left-2 sm:left-6 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-[#d4af37] hover:text-black border border-white/20 text-white flex items-center justify-center text-2xl font-light backdrop-blur transition active:scale-90 shadow-2xl"
                title="Previous Photo (Left Arrow Key)"
              >
                ‹
              </button>
            )}

            <img
              src={activePhoto.url}
              alt="Expanded view"
              className="max-h-[78vh] sm:max-h-[82vh] max-w-full object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Next Button */}
            {photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePhoto(1);
                }}
                className="absolute right-2 sm:right-6 z-30 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-[#d4af37] hover:text-black border border-white/20 text-white flex items-center justify-center text-2xl font-light backdrop-blur transition active:scale-90 shadow-2xl"
                title="Next Photo (Right Arrow Key)"
              >
                ›
              </button>
            )}
          </div>

          {/* Bottom Bar: Direct Download & Desktop Keyboard Shortcut Hint */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 pt-2 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[11px] text-neutral-500 hidden sm:inline">
              Tip: Use ← and → keys to browse photos, Esc to close
            </span>

            {allowDownloads && (
              <div className="w-full sm:w-auto flex justify-center">
                <button
                  onClick={() => {
                    clientApi.downloadSinglePhoto(eventSlug, activePhoto.id);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
                >
                  <DownloadIcon className="w-4 h-4" />
                  <span>Download Original Photo (Full Quality)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
