import React, { useState, useEffect } from 'react';
import {
  QrCodeIcon,
  TrashIcon,
  DownloadIcon
} from '../../components/common/Icons';
import BulkUploader from '../../components/admin/BulkUploader';
import { adminApi } from '../../services/api';


export default function AdminDashboard({ onLogout, onNavigateToEvent }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected event for management
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventPhotos, setEventPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // New Event Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEventDetails, setNewEventDetails] = useState('');
  const [newEventPin, setNewEventPin] = useState('');
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // New Event Watermark State
  const [newEnableWatermark, setNewEnableWatermark] = useState(true);
  const [newWatermarkPreview, setNewWatermarkPreview] = useState(null);
  const [newWatermarkPosition, setNewWatermarkPosition] = useState('bottom-right');
  const [newWatermarkScale, setNewWatermarkScale] = useState(22);
  const [newWatermarkOpacity, setNewWatermarkOpacity] = useState(90);
  const [newWatermarkText, setNewWatermarkText] = useState('© Ippu Clicks Photography • 0759125207');

  // Selected Event Watermark Management State
  const [isReapplying, setIsReapplying] = useState(false);
  const [watermarkMessage, setWatermarkMessage] = useState('');
  const [editWatermarkText, setEditWatermarkText] = useState('');
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // QR Preview Modal State
  const [activeQrModal, setActiveQrModal] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);

  const handleCopyLink = (slug) => {
    const link = `${window.location.origin}/event/${slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
      }).catch(() => {});
    }
  };

  // Database Backup & Restore Modal State
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState('');
  const [backupErrorMessage, setBackupErrorMessage] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const handleDownloadBackup = async (format = 'json') => {
    setIsBackingUp(true);
    setBackupSuccessMessage('');
    setBackupErrorMessage('');
    try {
      await adminApi.downloadBackup(format);
      setBackupSuccessMessage(`Successfully downloaded ${format.toUpperCase()} database backup!`);
      setTimeout(() => setBackupSuccessMessage(''), 4000);
    } catch (err) {
      setBackupErrorMessage(err.message || 'Failed to download database backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Are you sure you want to restore the database from "${file.name}"? This will sync all events, photos, and face descriptors.`)) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    setBackupSuccessMessage('');
    setBackupErrorMessage('');

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await adminApi.restoreBackup(json);
      setBackupSuccessMessage(`Database restored successfully! (${res.result?.restoredEvents || 0} events, ${res.result?.restoredPhotos || 0} photos)`);
      await loadEvents();
      setTimeout(() => setBackupSuccessMessage(''), 5000);
    } catch (err) {
      setBackupErrorMessage(err.message || 'Failed to parse and restore database backup file.');
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  // Mobile navigation tab state: 'events' | 'photos'
  const [mobileTab, setMobileTab] = useState('events');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getEvents();
      setEvents(data.events || []);
      if (data.events?.length > 0 && !selectedEventId) {
        selectEvent(data.events[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const selectEvent = async (eventId, switchToPhotosOnMobile = false) => {
    setSelectedEventId(eventId);
    if (switchToPhotosOnMobile) {
      setMobileTab('photos');
    }
    try {
      setLoadingPhotos(true);
      const data = await adminApi.getEvent(eventId);
      setEventPhotos(data.photos || []);
      if (data.event) {
        setEditWatermarkText(data.event.watermarkText || '© Ippu Clicks Photography • 0759125207');
      }
    } catch (err) {
      console.error('Failed to load event photos', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventName) return;

    setIsCreating(true);
    try {
      const data = await adminApi.createEvent({
        name: newEventName,
        date: newEventDate,
        details: newEventDetails,
        customPin: newEventPin || undefined,
        allowDownloads,
        enableWatermark: newEnableWatermark,
        watermarkPosition: newWatermarkPosition,
        watermarkScale: newWatermarkScale,
        watermarkOpacity: newWatermarkOpacity,
        watermarkText: newWatermarkText || undefined,
        watermarkBase64: newWatermarkPreview || undefined,
      });

      setShowCreateModal(false);
      setNewEventName('');
      setNewEventDetails('');
      setNewEventPin('');
      setNewEnableWatermark(true);
      setNewWatermarkPreview(null);
      setNewWatermarkPosition('bottom-right');
      setNewWatermarkScale(22);
      setNewWatermarkOpacity(90);
      setNewWatermarkText('© Ippu Clicks Photography • 0759125207');
      await loadEvents();
      selectEvent(data.event.id);
    } catch (err) {
      alert(err.message || 'Failed to create event');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateWatermark = async (eventId, updates, shouldReapply = false) => {
    try {
      if (shouldReapply) setIsReapplying(true);
      const res = await adminApi.updateEvent(eventId, {
        ...updates,
        reapplyImmediately: shouldReapply
      });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...res.event } : e)));
      setWatermarkMessage(shouldReapply ? 'Watermark saved & applied to all photos!' : 'Watermark preferences updated.');
      setCacheBuster(Date.now());
      if (shouldReapply) {
        await selectEvent(eventId);
      }
      setTimeout(() => setWatermarkMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update watermark setting');
    } finally {
      setIsReapplying(false);
    }
  };

  const handleRemoveWatermarkPng = async (eventId) => {
    if (!window.confirm('Remove the custom PNG logo and switch to the Brand Label badge?')) return;
    try {
      setIsReapplying(true);
      setWatermarkMessage('Switching to Brand Label badge and applying to photos...');
      const res = await adminApi.updateEvent(eventId, {
        removeWatermarkPng: true,
        watermarkType: 'badge',
        reapplyImmediately: true
      });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...res.event } : e)));
      setWatermarkMessage('PNG removed! Brand Label badge applied to all photos.');
      setCacheBuster(Date.now());
      await selectEvent(eventId);
      setTimeout(() => setWatermarkMessage(''), 4500);
    } catch (err) {
      alert(err.message || 'Failed to remove PNG watermark');
    } finally {
      setIsReapplying(false);
    }
  };

  const handleUploadWatermarkPng = async (eventId, file) => {
    if (!file) return;
    try {
      setIsReapplying(true);
      setWatermarkMessage('Uploading PNG & applying watermark to all photos...');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const res = await adminApi.uploadWatermark(eventId, {
            watermarkBase64: base64,
            enableWatermark: true,
          });
          setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...res.event } : e)));
          setWatermarkMessage('Custom PNG uploaded and applied to all photos!');
          setCacheBuster(Date.now());
          await selectEvent(eventId);
          setTimeout(() => setWatermarkMessage(''), 5000);
        } catch (err) {
          alert(err.message || 'Failed to upload PNG watermark');
        } finally {
          setIsReapplying(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsReapplying(false);
      alert(err.message || 'Failed to upload PNG watermark');
    }
  };

  const handleReapplyWatermark = async (eventId) => {
    try {
      setIsReapplying(true);
      setWatermarkMessage('Re-applying watermark to all event photos...');
      const res = await adminApi.reapplyWatermark(eventId);
      setWatermarkMessage(res.message || 'Watermark reapplied successfully!');
      setCacheBuster(Date.now());
      await selectEvent(eventId);
      setTimeout(() => setWatermarkMessage(''), 5000);
    } catch (err) {
      alert(err.message || 'Failed to reapply watermark');
    } finally {
      setIsReapplying(false);
    }
  };


  const handleToggleDownload = async (event) => {
    try {
      const updated = await adminApi.toggleDownloads(event.id, !event.allowDownloads);
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, allowDownloads: updated.allowDownloads } : e))
      );
    } catch (err) {
      alert(err.message || 'Failed to toggle download permission');
    }
  };

  const handleDeleteEvent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete event "${name}" and all uploaded photos?`)) {
      return;
    }
    try {
      await adminApi.deleteEvent(id);
      if (selectedEventId === id) setSelectedEventId(null);
      await loadEvents();
    } catch (err) {
      alert(err.message || 'Failed to delete event');
    }
  };

  const handleDeletePhoto = async (photoId) => {
    try {
      await adminApi.deletePhoto(photoId);
      setEventPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedEventId ? { ...e, photoCount: Math.max(0, e.photoCount - 1) } : e
        )
      );
    } catch (err) {
      alert(err.message || 'Failed to delete photo');
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#141418] border-b border-[#2a2a36] px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-[#d4af37]/60 p-0.5 bg-white flex-shrink-0">
            <img src="/brand-logo.jpg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white leading-tight">Ippu Clicks Admin Console</h1>
            <p className="text-[9px] sm:text-[10px] text-neutral-400">Events, Photos & QR Codes</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBackupModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1c1c24] hover:bg-[#252532] border border-[#2a2a36] hover:border-[#d4af37]/40 text-[11px] sm:text-xs text-neutral-300 hover:text-white transition flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="Database Backup & Recovery Center"
          >
            <DownloadIcon className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="hidden sm:inline">Backup DB</span>
            <span className="sm:hidden">Backup</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-bold text-[11px] sm:text-xs shadow hover:opacity-90 active:scale-95 transition"
          >
            + Create Event
          </button>
          <button
            onClick={onLogout}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-[11px] sm:text-xs text-neutral-400 hover:text-white transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden bg-[#141418] p-1 rounded-xl border border-[#2a2a36] mb-4 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileTab('events')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mobileTab === 'events'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>📅 Events List ({events.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('photos')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mobileTab === 'photos'
                ? 'bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>📸 Manage Event</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
          {/* Left Column: Events List */}
          <div className={`lg:col-span-5 space-y-3 ${mobileTab === 'events' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Active Events ({events.length})
              </h2>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            {loading && <p className="text-xs text-neutral-500">Loading events...</p>}

            {events.map((evt) => {
              const isSelected = evt.id === selectedEventId;
              return (
                <div
                  key={evt.id}
                  onClick={() => selectEvent(evt.id, true)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1c1c24] border-[#d4af37] shadow-lg shadow-amber-500/10'
                      : 'bg-[#141418] border-[#242430] hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-[#d4af37] uppercase tracking-wider">
                        {evt.date}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{evt.name}</h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* QR Preview Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveQrModal(evt);
                        }}
                        className="p-1.5 rounded-lg bg-[#242430] hover:bg-[#d4af37]/20 text-neutral-300 hover:text-[#f7d070] transition"
                        title="View Logo QR Code"
                      >
                        <QrCodeIcon className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(evt.id, evt.name);
                        }}
                        className="p-1.5 rounded-lg bg-[#242430] hover:bg-red-900/40 text-neutral-400 hover:text-red-400 transition"
                        title="Delete Event"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#242430] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-black/40 border border-neutral-700 font-mono text-[11px] text-amber-300">
                        PIN: {evt.pin}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {evt.photoCount || 0} photos
                      </span>
                    </div>

                    {/* Download Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleDownload(evt);
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                        evt.allowDownloads
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      Downloads: {evt.allowDownloads ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Event Detail & Media Manager */}
          <div className={`lg:col-span-7 space-y-5 ${mobileTab === 'photos' ? 'block' : 'hidden lg:block'}`}>
          {selectedEvent ? (
            <>
              {/* Event Card Header */}
              <div className="p-5 rounded-2xl bg-[#141418] border border-[#2a2a36] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">
                      {selectedEvent.date}
                    </span>
                    <h2 className="text-xl font-bold text-white">{selectedEvent.name}</h2>
                    <p className="text-xs text-neutral-400 mt-1">{selectedEvent.details}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(selectedEvent.publicSlug)}
                      className="px-3 py-1.5 rounded-xl bg-[#242430] hover:bg-[#323242] text-neutral-200 font-semibold text-xs transition flex items-center gap-1.5"
                      title="Copy Public Event URL"
                    >
                      <span>{copiedSlug === selectedEvent.publicSlug ? '✓ Copied' : '📋 Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => onNavigateToEvent(selectedEvent.publicSlug)}
                      className="px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition"
                    >
                      Open Client View ↗
                    </button>
                    <button
                      onClick={() => setActiveQrModal(selectedEvent)}
                      className="px-3 py-1.5 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#f7d070] font-bold text-xs hover:bg-[#d4af37]/30 transition flex items-center gap-1.5"
                    >
                      <QrCodeIcon className="w-3.5 h-3.5" />
                      <span>Print QR</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#242430] text-xs">
                  <div className="text-neutral-400">
                    Host Access PIN: <strong className="text-white font-mono">{selectedEvent.pin}</strong>
                  </div>
                  <span className="text-neutral-600">•</span>
                  <div className="text-neutral-400">
                    Public Slug: <code className="text-neutral-300 font-mono text-[11px]">{selectedEvent.publicSlug}</code>
                  </div>
                </div>
              </div>

              {/* Event Watermark & Branding Manager */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#141418] border border-[#2a2a36] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#242430]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">Event Watermark & Brand Label</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      selectedEvent.enableWatermark !== false
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}>
                      {selectedEvent.enableWatermark !== false ? 'Active' : 'Disabled'}
                    </span>
                    {selectedEvent.enableWatermark !== false && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#d4af37]/20 text-[#f7d070] font-semibold">
                        {selectedEvent.watermarkUrl ? 'PNG Logo Mode' : 'Brand Label Mode'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateWatermark(selectedEvent.id, {
                        enableWatermark: selectedEvent.enableWatermark === false ? true : false
                      }, true)}
                      className="px-3 py-1.5 rounded-xl bg-[#1f1f28] border border-[#333344] text-xs font-semibold text-neutral-300 hover:text-white transition"
                    >
                      {selectedEvent.enableWatermark !== false ? 'Turn Off' : 'Turn On'}
                    </button>
                    <button
                      type="button"
                      disabled={isReapplying}
                      onClick={() => handleReapplyWatermark(selectedEvent.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50 flex items-center gap-1.5"
                      title="Re-apply watermark onto all existing photos using clean raw masters"
                    >
                      <span>{isReapplying ? '⚡ Applying...' : '⚡ Re-apply to Photos'}</span>
                    </button>
                  </div>
                </div>

                {watermarkMessage && (
                  <div className="p-3 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#f7d070] text-xs font-medium flex items-center justify-between">
                    <span>{watermarkMessage}</span>
                  </div>
                )}

                {selectedEvent.enableWatermark !== false && (
                  <div className="space-y-4 pt-1">
                    {/* Mode Tabs: Brand Label vs Custom PNG */}
                    <div className="flex bg-[#0c0c10] p-1 rounded-xl border border-[#2a2a36] text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedEvent.watermarkUrl) {
                            handleRemoveWatermarkPng(selectedEvent.id);
                          }
                        }}
                        className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                          !selectedEvent.watermarkUrl
                            ? 'bg-[#d4af37] text-black shadow-sm'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span>🏷️ Brand Label Badge</span>
                        {!selectedEvent.watermarkUrl && (
                          <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">Active</span>
                        )}
                      </button>

                      <label
                        className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedEvent.watermarkUrl
                            ? 'bg-[#d4af37] text-black shadow-sm'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span>🖼️ Custom PNG Logo</span>
                        {selectedEvent.watermarkUrl ? (
                          <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">Active</span>
                        ) : (
                          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-neutral-300">Upload</span>
                        )}
                        <input
                          type="file"
                          accept="image/png"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadWatermarkPng(selectedEvent.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Brand Label Editor */}
                    {!selectedEvent.watermarkUrl ? (
                      <div className="p-3.5 rounded-xl bg-[#0e0e14] border border-[#262634] space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-neutral-300">
                              Photographer / Brand Label Text
                            </label>
                            <span className="text-[10px] text-neutral-500">Rendered with gold trim & drop shadow</span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editWatermarkText}
                              onChange={(e) => setEditWatermarkText(e.target.value)}
                              placeholder="e.g. © Ippu Clicks Photography • 0759125207"
                              className="flex-1 px-3 py-2 rounded-xl bg-[#14141c] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={isReapplying}
                              onClick={() => handleUpdateWatermark(selectedEvent.id, {
                                watermarkText: editWatermarkText,
                                watermarkType: 'badge'
                              }, true)}
                              className="px-4 py-2 rounded-xl bg-[#d4af37] text-black font-extrabold text-xs hover:bg-[#e5be48] active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
                            >
                              Save & Apply
                            </button>
                          </div>
                        </div>

                        {/* Live Badge Preview */}
                        <div>
                          <div className="text-[10px] font-semibold text-neutral-400 mb-1.5">Live Badge Preview on Photo</div>
                          <div className="h-14 rounded-xl bg-[radial-gradient(#2a2a3a_1px,transparent_1px)] [background-size:8px_8px] bg-[#08080c] border border-[#22222e] flex items-center justify-center p-2 overflow-hidden">
                            <div className="px-4 py-1.5 rounded-full bg-[#0e0e14]/90 border border-[#d4af37] text-white text-xs font-semibold shadow-lg shadow-black/80 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
                              <span>{editWatermarkText || '© Ippu Clicks Photography • 0759125207'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Custom PNG Editor */
                      <div className="p-3.5 rounded-xl bg-[#0e0e14] border border-[#262634] space-y-3">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-14 rounded-xl bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:6px_6px] bg-[#08080c] border border-[#333] flex items-center justify-center p-1.5 overflow-hidden">
                              <img
                                src={`${selectedEvent.watermarkUrl}?t=${cacheBuster}`}
                                alt="Custom PNG Watermark"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>Custom Transparent PNG</span>
                                <span className="text-[10px] text-emerald-400 font-semibold">✓ Active</span>
                              </div>
                              <div className="text-[10px] text-neutral-400 mt-0.5">Applied onto all uploaded event photos</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-[#20202c] hover:bg-[#2a2a3a] border border-[#333] hover:border-[#d4af37] text-xs text-neutral-200 font-semibold transition">
                              <span>Replace PNG</span>
                              <input
                                type="file"
                                accept="image/png"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleUploadWatermarkPng(selectedEvent.id, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveWatermarkPng(selectedEvent.id)}
                              className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 text-xs font-semibold transition"
                              title="Remove custom PNG and use Brand Label text badge"
                            >
                              Remove PNG (Use Brand Label)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Position, Size, and Opacity Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Position on Photo</label>
                        <select
                          value={selectedEvent.watermarkPosition || 'bottom-right'}
                          onChange={(e) => handleUpdateWatermark(selectedEvent.id, { watermarkPosition: e.target.value }, true)}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#14141c] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                        >
                          <option value="bottom-right">Bottom Right (Standard)</option>
                          <option value="bottom-center">Bottom Center</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                          <option value="center">Center</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Watermark Size</label>
                        <select
                          value={selectedEvent.watermarkScale || 22}
                          onChange={(e) => handleUpdateWatermark(selectedEvent.id, { watermarkScale: Number(e.target.value) }, true)}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#14141c] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                        >
                          <option value={15}>Small (15% photo width)</option>
                          <option value={22}>Medium (22% photo width)</option>
                          <option value={32}>Large (32% photo width)</option>
                          <option value={50}>Extra Large (50% photo width)</option>
                          <option value={100}>Fit on Photo (Full Width Fit)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Watermark Opacity</label>
                        <select
                          value={selectedEvent.watermarkOpacity || 90}
                          onChange={(e) => handleUpdateWatermark(selectedEvent.id, { watermarkOpacity: Number(e.target.value) }, true)}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#14141c] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                        >
                          <option value={100}>100% Solid</option>
                          <option value={90}>90% Standard (Recommended)</option>
                          <option value={75}>75% Balanced</option>
                          <option value={50}>50% Semi-Transparent</option>
                          <option value={30}>30% Subtle</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bulk Uploader */}

              <BulkUploader
                eventId={selectedEvent.id}
                onUploadSuccess={(newPhotos) => {
                  setEventPhotos((prev) => [...prev, ...newPhotos]);
                  setEvents((prev) =>
                    prev.map((e) =>
                      e.id === selectedEvent.id
                        ? { ...e, photoCount: e.photoCount + newPhotos.length }
                        : e
                    )
                  );
                }}
              />

              {/* Photos Grid */}
              <div className="p-4 rounded-2xl bg-[#141418] border border-[#2a2a36]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Event Photos ({eventPhotos.length})
                  </h3>
                </div>

                {loadingPhotos ? (
                  <p className="text-xs text-neutral-500 py-6 text-center">Loading gallery...</p>
                ) : eventPhotos.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-6 text-center">
                    No images uploaded yet. Use the bulk uploader above to add photos.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {eventPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative rounded-xl overflow-hidden border border-[#2a2a36] group aspect-square bg-black"
                      >
                        <img
                          src={`${photo.thumbnailUrl || photo.url}?t=${cacheBuster}`}
                          alt={photo.originalName}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
                          title="Delete photo"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-[#141418] border border-[#2a2a36] text-center text-neutral-500">
              Select or create an event to manage media.
            </div>
          )}
        </div>
      </div>
    </div>

      {/* CREATE EVENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[#181820] border border-[#2e2e3e] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Create Photography Event</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Enter event details. A branded QR code will be generated with your custom logo.
            </p>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g., Sarah & John's Wedding"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Event Details / Location
                </label>
                <textarea
                  rows={2}
                  value={newEventDetails}
                  onChange={(e) => setNewEventDetails(e.target.value)}
                  placeholder="e.g., Safari Park Hotel, Nairobi"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#141418] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Unique Numeric PIN (Optional)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={newEventPin}
                  onChange={(e) => setNewEventPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Leave empty to auto-generate (e.g. 583921)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141418] border border-[#2e2e3e] text-white text-xs font-mono focus:border-[#d4af37] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#141418] border border-[#2e2e3e]">
                <div>
                  <div className="text-xs font-bold text-white">Allow Client Downloads</div>
                  <div className="text-[10px] text-neutral-400">
                    If disabled, clients can view photos but cannot download them.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowDownloads}
                  onChange={(e) => setAllowDownloads(e.target.checked)}
                  className="w-4 h-4 accent-[#d4af37]"
                />
              </div>

              {/* Photo Watermark & Label Section */}
              <div className="p-3.5 rounded-xl bg-[#141418] border border-[#2e2e3e] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Photo Watermark / Label</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[#f7d070] font-semibold">PNG</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Apply brand logo or custom PNG watermark to event photos.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newEnableWatermark}
                    onChange={(e) => setNewEnableWatermark(e.target.checked)}
                    className="w-4 h-4 accent-[#d4af37]"
                  />
                </div>

                {newEnableWatermark && (
                  <div className="space-y-3 pt-2 border-t border-[#22222d] text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                        Upload Transparent PNG Watermark
                      </label>
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setNewWatermarkPreview(reader.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-xs text-neutral-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#d4af37] file:text-black hover:file:opacity-90 cursor-pointer"
                      />
                    </div>

                    {newWatermarkPreview ? (
                      <div className="relative p-2 rounded-lg bg-[#0e0e12] border border-[#2e2e3e] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-8 rounded bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:6px_6px] bg-[#1a1a24] flex items-center justify-center p-1 border border-[#333]">
                            <img src={newWatermarkPreview} alt="Preview" className="max-w-full max-h-full object-contain" />
                          </div>
                          <span className="text-[11px] text-emerald-400 font-semibold">✓ Transparent PNG Loaded</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewWatermarkPreview(null)}
                          className="text-[11px] text-neutral-400 hover:text-red-400 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1">
                          Fallback Label (If no PNG uploaded)
                        </label>
                        <input
                          type="text"
                          value={newWatermarkText}
                          onChange={(e) => setNewWatermarkText(e.target.value)}
                          placeholder="e.g., © Ippu Clicks Photography"
                          className="w-full px-3 py-1.5 rounded-lg bg-[#181820] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1">Position</label>
                        <select
                          value={newWatermarkPosition}
                          onChange={(e) => setNewWatermarkPosition(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-[#181820] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                        >
                          <option value="bottom-right">Bottom Right (Default)</option>
                          <option value="bottom-center">Bottom Center</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="center">Center</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-1">Watermark Size</label>
                        <select
                          value={newWatermarkScale}
                          onChange={(e) => setNewWatermarkScale(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg bg-[#181820] border border-[#2e2e3e] text-white text-xs focus:border-[#d4af37] focus:outline-none"
                        >
                          <option value={15}>Small (15% width)</option>
                          <option value={22}>Medium (22% width)</option>
                          <option value={32}>Large (32% width)</option>
                          <option value={50}>Extra Large (50% width)</option>
                          <option value={100}>Fit on Photo (Full Fit / Frame)</option>
                        </select>
                      </div>

                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50"
                >
                  {isCreating ? 'Creating & Generating QR...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR PREVIEW & PRINT DOWNLOAD MODAL */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in no-print">
          <div className="w-full max-w-sm rounded-3xl bg-[#181820] border border-[#2e2e3e] p-6 text-center shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">{activeQrModal.name}</h3>
            <p className="text-xs text-neutral-400">
              High-resolution QR code with embedded Ippu Clicks brand logo.
            </p>

            <div className="p-3 bg-white rounded-2xl inline-block shadow-inner">
              <img
                src={activeQrModal.qrCodeDataUrl}
                alt="Branded QR Code"
                className="w-56 h-56 mx-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-300 font-mono bg-[#141418] p-2.5 rounded-xl border border-[#242430]">
              <span>PIN: <strong className="text-amber-400 font-bold">{activeQrModal.pin}</strong></span>
              <button
                type="button"
                onClick={() => handleCopyLink(activeQrModal.publicSlug)}
                className="px-2.5 py-1 rounded bg-[#242430] hover:bg-[#d4af37]/20 text-[#d4af37] text-[11px] font-sans font-semibold transition"
              >
                {copiedSlug === activeQrModal.publicSlug ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-white text-black font-extrabold text-xs shadow flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-95 transition"
              >
                <span>🖨️ Print Table Standee / Sign</span>
              </button>

              <a
                href={activeQrModal.qrCodeDataUrl}
                download={`${activeQrModal.name.replace(/[^a-zA-Z0-9]/g, '_')}_IppuClicks_QR.png`}
                className="w-full py-2.5 rounded-xl bg-[#d4af37] text-black font-extrabold text-xs shadow flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition"
              >
                <DownloadIcon className="w-4 h-4" />
                <span>Download Print-Ready QR (PNG)</span>
              </a>

              <button
                onClick={() => setActiveQrModal(null)}
                className="w-full py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PRINTABLE STANDEE (Active during window.print()) */}
      {activeQrModal && (
        <div className="printable-standee hidden">
          <div style={{ maxWidth: '440px', textAlign: 'center', margin: '0 auto', border: '3px solid #111', borderRadius: '24px', padding: '36px 28px', fontFamily: 'sans-serif' }}>
            <div style={{ textTransform: 'uppercase', letterSpacing: '3px', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>
              Official Event Photo Gallery
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111', margin: '4px 0 8px 0' }}>
              {activeQrModal.name}
            </h1>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>
              {activeQrModal.date}
            </div>

            <div style={{ background: '#fff', border: '2px solid #ddd', borderRadius: '16px', padding: '16px', display: 'inline-block', margin: '0 auto 20px auto' }}>
              <img
                src={activeQrModal.qrCodeDataUrl}
                alt="QR Code"
                style={{ width: '260px', height: '260px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '12px', padding: '10px 16px', margin: '0 0 20px 0', fontSize: '15px', fontWeight: 'bold' }}>
              Event Access PIN: <span style={{ color: '#b45309', letterSpacing: '2px', fontSize: '17px' }}>{activeQrModal.pin}</span>
            </div>

            <div style={{ fontSize: '12px', color: '#333', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              <strong>How to Find Your Photos:</strong><br />
              1. Open your phone camera and scan the QR code.<br />
              2. Use <strong>Live AI Face Search</strong> with a quick selfie.<br />
              3. View & download your high-resolution photos instantly!
            </div>

            <div style={{ borderTop: '1px dashed #ccc', paddingTop: '16px', fontSize: '11px', color: '#777' }}>
              <strong>Ippu Clicks Photography</strong> • 0759125207 • @ippu_clicks
            </div>
          </div>
        </div>
      )}
      {/* DATABASE BACKUP & RESTORE MODAL */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in no-print">
          <div className="w-full max-w-md rounded-3xl bg-[#181820] border border-[#2e2e3e] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2a36]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                  <DownloadIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Database Backup & Recovery</h3>
                  <p className="text-[11px] text-neutral-400">Export backups or restore gallery data</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBackupModal(false);
                  setBackupSuccessMessage('');
                  setBackupErrorMessage('');
                }}
                className="w-7 h-7 rounded-lg bg-[#22222e] text-neutral-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Success / Error Alerts */}
            {backupSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>{backupSuccessMessage}</span>
              </div>
            )}
            {backupErrorMessage && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
                <span>⚠</span>
                <span>{backupErrorMessage}</span>
              </div>
            )}

            {/* Backup Export Options */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Download Database Backup</div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isBackingUp || isRestoring}
                  onClick={() => handleDownloadBackup('json')}
                  className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1c1c26] border border-[#2e2e3e] hover:border-[#d4af37]/50 text-left transition disabled:opacity-50 group flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[#d4af37] flex items-center justify-between">
                      <span>Full JSON Backup</span>
                      <span className="text-[10px] text-amber-400 font-mono">.json</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                      Portable snapshot of events, photo metadata & 128-D descriptors.
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-bold text-[#d4af37] flex items-center gap-1">
                    <span>{isBackingUp ? 'Exporting...' : '⬇ Download JSON'}</span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isBackingUp || isRestoring}
                  onClick={() => handleDownloadBackup('sql')}
                  className="p-3.5 rounded-2xl bg-[#141418] hover:bg-[#1c1c26] border border-[#2e2e3e] hover:border-[#d4af37]/50 text-left transition disabled:opacity-50 group flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[#d4af37] flex items-center justify-between">
                      <span>MySQL SQL Dump</span>
                      <span className="text-[10px] text-emerald-400 font-mono">.sql</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                      Native SQL INSERT script for phpMyAdmin & MySQL CLI import.
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <span>{isBackingUp ? 'Exporting...' : '⬇ Download SQL'}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Restore Section */}
            <div className="pt-2 border-t border-[#2a2a36] space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Restore Database from Backup</div>
              <div className="p-3.5 rounded-2xl bg-[#141418] border border-[#262634] space-y-2">
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Upload an exported <code className="text-amber-400">.json</code> backup to restore all events, PINs, and face recognition data.
                </p>

                <label className="cursor-pointer block text-center py-2.5 px-4 rounded-xl bg-[#20202c] hover:bg-[#282838] border border-[#3a3a4c] hover:border-[#d4af37] text-xs font-bold text-neutral-200 hover:text-white transition active:scale-95">
                  <span>{isRestoring ? 'Restoring Database...' : '📁 Choose JSON Backup File to Restore'}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={isRestoring || isBackingUp}
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowBackupModal(false);
                  setBackupSuccessMessage('');
                  setBackupErrorMessage('');
                }}
                className="w-full py-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
