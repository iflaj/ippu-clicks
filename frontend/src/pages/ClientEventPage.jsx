import React, { useState, useEffect } from 'react';
import BrandHeader from '../components/common/BrandHeader';
import StickyFooter from '../components/common/StickyFooter';
import BackgroundVideo from '../components/common/BackgroundVideo';
import InstagramModal from '../components/client/InstagramModal';
import ClientAccessGate from '../components/client/ClientAccessGate';
import MasonryGallery from '../components/client/MasonryGallery';
import { clientApi } from '../services/api';

export default function ClientEventPage({ slug = 'sample-event' }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Background Video Mood State ('nature' = Stars timelapse, 'bokeh' = Camera optical bokeh)
  const [bgVideo, setBgVideo] = useState(() => {
    return localStorage.getItem('ippu_bg_video') || 'nature';
  });

  const handleToggleBgVideo = () => {
    const next = bgVideo === 'nature' ? 'bokeh' : 'nature';
    setBgVideo(next);
    localStorage.setItem('ippu_bg_video', next);
  };

  // Clean slug
  const cleanSlug = String(slug || '').trim().replace(/\/+$/, '');

  // Instagram Prompt State (Shows immediately upon landing)
  const [showInstagram, setShowInstagram] = useState(true);

  // Gallery Access State - persist across page refresh for the same event slug
  const [accessState, setAccessState] = useState(() => {
    if (!cleanSlug) return null;
    try {
      const cached = sessionStorage.getItem(`ippu_access_${cleanSlug}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  // Keep accessState in sync if slug changes
  useEffect(() => {
    if (!cleanSlug) {
      setAccessState(null);
      return;
    }
    try {
      const cached = sessionStorage.getItem(`ippu_access_${cleanSlug}`);
      setAccessState(cached ? JSON.parse(cached) : null);
    } catch (e) {
      setAccessState(null);
    }
  }, [cleanSlug]);

  useEffect(() => {
    let isCurrent = true;

    async function loadEvent() {
      if (!cleanSlug) {
        setError('No event specified.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const data = await clientApi.getEvent(cleanSlug);
        if (!isCurrent) return;
        setEvent(data);
      } catch (err) {
        if (!isCurrent) return;
        setError(err.message || 'Event not found');
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    }

    loadEvent();

    return () => {
      isCurrent = false;
    };
  }, [cleanSlug]);

  const handleAccessGranted = (grantedData) => {
    setAccessState(grantedData);
    if (cleanSlug) {
      try {
        sessionStorage.setItem(`ippu_access_${cleanSlug}`, JSON.stringify(grantedData));
      } catch (e) {}
    }
  };

  const handleResetAccess = () => {
    setAccessState(null);
    if (cleanSlug) {
      try {
        sessionStorage.removeItem(`ippu_access_${cleanSlug}`);
      } catch (e) {}
    }
  };

  const videoSrc = bgVideo === 'bokeh' ? '/videos/camera-bokeh.webm' : '/videos/nature-stars.webm';

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between bg-[#0a0a0c] text-white relative overflow-x-hidden">
      {/* 0. Ambient Looping Background Video (Photography / Nature) */}
      <BackgroundVideo videoSrc={videoSrc} />

      {/* 1. Brand Header */}
      <div className="relative z-20 flex-shrink-0">
        <BrandHeader
          subtitle={event ? `${event.name}` : 'Event Photography'}
          showBack={Boolean(accessState)}
          onBack={handleResetAccess}
          bgVideo={bgVideo}
          onToggleBgVideo={handleToggleBgVideo}
        />
      </div>

      {/* 2. Instagram Landing Prompt Modal */}
      <InstagramModal
        isOpen={showInstagram && !loading && !error}
        onClose={() => setShowInstagram(false)}
        instagramHandle={event?.branding?.instagramHandle || 'ippu_clicks'}
      />

      {/* 3. Main Body */}
      <main className="flex-1 flex flex-col justify-center relative z-10 py-2 sm:py-4">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-10 h-10 border-3 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-neutral-400">Loading event memories...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800 flex items-center justify-center text-red-400 mb-3 text-xl font-bold">
              ✕
            </div>
            <h3 className="text-lg font-bold text-white">Event Unavailable</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs">{error}</p>
          </div>
        )}

        {!loading && !error && event && (
          <>
            {!accessState ? (
              <ClientAccessGate
                event={event}
                onAccessGranted={handleAccessGranted}
              />
            ) : (
              <MasonryGallery
                eventSlug={cleanSlug}
                photos={accessState.photos}
                accessType={accessState.accessType}
                allowDownloads={accessState.allowDownloads}
                onResetAccess={handleResetAccess}
              />
            )}
          </>
        )}
      </main>

      {/* 4. Globally Pinned Sticky Footer (Admin hidden from clients) */}
      <div className="relative z-10">
        <StickyFooter showAdmin={false} />
      </div>
    </div>
  );
}
