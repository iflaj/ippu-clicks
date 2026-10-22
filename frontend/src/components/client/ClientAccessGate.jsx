import React, { useState, useRef, useEffect } from 'react';
import { CameraIcon, KeyIcon, ArrowLeftIcon, LockIcon, UserCheckIcon } from '../common/Icons';
import { clientApi } from '../../services/api';
import {
  loadFaceApiModels,
  detectFaceRealtime,
  extractAiDescriptor,
  extractDescriptorFromFile,
} from '../../services/faceDetection';

export default function ClientAccessGate({ event, onAccessGranted }) {
  // Mode: 'FACE_SCAN' | 'PIN_ENTRY' | 'NO_MATCH'
  const [mode, setMode] = useState('FACE_SCAN');

  // AI & Model States
  const [isAiModelReady, setIsAiModelReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceScore, setFaceScore] = useState(null);

  // Camera & Face Scan States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const captureInputRef = useRef(null);
  const detectionLoopRef = useRef(null);

  // PIN States
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // 1. Preload AI models on component mount
  useEffect(() => {
    let isMounted = true;
    loadFaceApiModels().then((ready) => {
      if (isMounted) setIsAiModelReady(ready);
    });

    // Auto-start camera in FACE_SCAN mode
    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  // 2. Attach camera stream whenever video mounts
  useEffect(() => {
    if (mode === 'FACE_SCAN' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.warn('Video play interrupted:', err);
      });
    }
  }, [mode, cameraActive]);

  // 3. Real-time AI Face Tracking Loop on Live Camera Feed
  useEffect(() => {
    if (detectionLoopRef.current) {
      clearInterval(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }

    if (mode === 'FACE_SCAN' && cameraActive && !selfiePreview && !isProcessingFace) {
      detectionLoopRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          return;
        }

        try {
          const detection = await detectFaceRealtime(videoRef.current);
          if (detection) {
            setFaceDetected(true);
            setFaceScore(Math.round(detection.score * 100));
          } else {
            setFaceDetected(false);
            setFaceScore(null);
          }
        } catch (err) {
          setFaceDetected(false);
        }
      }, 120);
    } else {
      setFaceDetected(false);
      setFaceScore(null);
    }

    return () => {
      if (detectionLoopRef.current) {
        clearInterval(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  }, [mode, cameraActive, selfiePreview, isProcessingFace]);

  const startCamera = async () => {
    setCameraError(null);
    setSelfiePreview(null);

    // Check if getUserMedia is supported in current context
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        'Live stream requires HTTPS or localhost. Tap "Take Selfie with Camera" below to use your native phone camera!'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera stream error:', err);
      setCameraActive(false);
      setCameraError(
        'Camera permission was blocked. Tap "Take Selfie with Camera" below to snap a quick photo!'
      );
    }
  };

  const stopCamera = () => {
    if (detectionLoopRef.current) {
      clearInterval(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleSelectMode = (newMode) => {
    setMode(newMode);
    setCameraError(null);
    setSelfiePreview(null);
    setPinError('');

    if (newMode === 'FACE_SCAN') {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Helper to submit selfie and match
  const processSelfieBlob = async (blob, previewUrl, preExtractedDescriptor = null) => {
    setIsProcessingFace(true);
    setCameraError(null);
    if (previewUrl) setSelfiePreview(previewUrl);

    try {
      const formData = new FormData();
      formData.append('selfie', blob, 'selfie.jpg');

      if (preExtractedDescriptor && Array.isArray(preExtractedDescriptor)) {
        formData.append('descriptor', JSON.stringify(preExtractedDescriptor));
      }
      // Request matches with 55%+ confidence as specified
      formData.append('minConfidence', '55');

      const result = await clientApi.matchFace(event.publicSlug, formData);

      stopCamera();

      if (!result.matchedPhotos || result.matchedPhotos.length === 0) {
        setCameraError(result.message || 'No photos matched your face in this event album.');
        setMode('NO_MATCH');
        return;
      }

      onAccessGranted({
        accessType: 'FACE_FILTERED',
        photos: result.matchedPhotos,
        allowDownloads: result.allowDownloads,
        matchedCount: result.matchedCount,
      });
    } catch (err) {
      setCameraError(err.message || 'Face recognition matching failed. Please try again.');
      setSelfiePreview(null);
    } finally {
      setIsProcessingFace(false);
    }
  };

  // Capture snapshot from live webcam feed
  const captureSelfieAndMatch = async () => {
    if (!videoRef.current) {
      captureInputRef.current?.click();
      return;
    }

    setIsProcessingFace(true);
    setCameraError(null);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 640;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Mirror horizontally for natural selfie orientation
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
      setSelfiePreview(previewUrl);

      // 1. Extract 128-D AI descriptor directly from canvas in browser
      let descriptor = null;
      try {
        descriptor = await extractAiDescriptor(canvas);
      } catch (e) {
        console.warn('Browser descriptor extraction fallback:', e);
      }

      // 2. Convert canvas to blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to capture photo frame'))),
          'image/jpeg',
          0.9
        );
      });

      // 3. Submit matching request
      await processSelfieBlob(blob, previewUrl, descriptor);
    } catch (err) {
      setCameraError(err.message || 'Capture failed. Tap Take Selfie with Camera below.');
      setIsProcessingFace(false);
    }
  };

  // Helper to downscale large phone selfies before uploading (prevents network timeouts / payload errors)
  const compressSelfieForUpload = async (fileOrBlob) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(fileOrBlob);
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob || fileOrBlob),
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(fileOrBlob);
      };
      img.src = url;
    });
  };

  // Handle native camera photo or file picker upload
  const handleNativePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFace(true);
    setCameraError(null);

    try {
      const previewUrl = URL.createObjectURL(file);
      setSelfiePreview(previewUrl);

      // 1. Try extracting descriptor from the uploaded photo file
      let descriptor = null;
      try {
        descriptor = await extractDescriptorFromFile(file);
      } catch (e) {
        console.warn('File descriptor extraction fallback:', e);
      }

      // 2. Downscale huge phone camera files (e.g. 15MB down to ~150KB)
      const uploadBlob = await compressSelfieForUpload(file);

      // 3. Process and submit
      await processSelfieBlob(uploadBlob, previewUrl, descriptor);
    } catch (err) {
      setCameraError(err.message || 'Failed to process selected photo.');
      setIsProcessingFace(false);
    }
  };

  // PIN Form Submission
  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin.trim()) return;

    setIsVerifyingPin(true);
    setPinError('');

    try {
      const result = await clientApi.verifyPin(event.publicSlug, pin.trim());
      onAccessGranted({
        accessType: 'ALL_PHOTOS',
        photos: result.photos,
        allowDownloads: result.allowDownloads,
      });
    } catch (err) {
      setPinError(err.message || 'Incorrect Event PIN');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Touch keypad handlers
  const handleKeypadPress = (val) => {
    if (pin.length < 6) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === 6) {
        setIsVerifyingPin(true);
        clientApi
          .verifyPin(event.publicSlug, nextPin)
          .then((result) => {
            onAccessGranted({
              accessType: 'ALL_PHOTOS',
              photos: result.photos,
              allowDownloads: result.allowDownloads,
            });
          })
          .catch((err) => setPinError(err.message || 'Incorrect Event PIN'))
          .finally(() => setIsVerifyingPin(false));
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-1 md:py-1.5 flex-1 flex flex-col justify-center min-h-0">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-8 items-center">
        {/* LEFT COLUMN: Event Details & Studio Prestige (Expands on PC, Compact on Mobile) */}
        <div className="md:col-span-5 space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-0.5 rounded-full border border-[#d4af37]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
            <span>{event?.date || 'Private Event'}</span>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight leading-tight">
              {event?.name || 'Exclusive Gallery'}
            </h2>
            {event?.details && (
              <p className="text-[11px] sm:text-xs text-neutral-300 mt-1 leading-relaxed line-clamp-2 md:line-clamp-none">
                {event.details}
              </p>
            )}
          </div>

          {/* Desktop Feature Badges (Visible on PC / Tablet, hidden on small mobile) */}
          <div className="pt-0.5 space-y-1.5 hidden md:block">
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#141418]/80 border border-[#262634] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[#f7d070] flex items-center justify-center flex-shrink-0">
                <CameraIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Live AI Face Scanner</p>
                <p className="text-[9px] text-neutral-400">Real-time autofocus with 128-D neural recognition</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#141418]/80 border border-[#262634] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <UserCheckIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Front & Side Profile Match</p>
                <p className="text-[9px] text-neutral-400">Shows all photos matching from 55%+ confidence</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#141418]/80 border border-[#262634] shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 flex items-center justify-center flex-shrink-0">
                <KeyIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Host PIN Code Access</p>
                <p className="text-[9px] text-neutral-400">Unlock and browse the entire event album</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Station (Scanner / PIN) */}
        <div className="md:col-span-7">
          <div className="luxury-glass p-3 sm:p-4 md:p-5 rounded-2xl relative overflow-hidden">
            {/* Quick Mode Toggle (AI Face Scan vs Host PIN) */}
            <div className="flex bg-[#141418] p-0.5 rounded-lg border border-[#2a2a36] mb-2 shadow-inner">
              <button
                type="button"
                onClick={() => handleSelectMode('FACE_SCAN')}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'FACE_SCAN' || mode === 'NO_MATCH'
                    ? 'bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span>AI Face Scan</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                    mode === 'FACE_SCAN' || mode === 'NO_MATCH'
                      ? 'bg-black/20 text-black'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  My Photos
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('PIN_ENTRY')}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'PIN_ENTRY'
                    ? 'bg-white text-black shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <KeyIcon className="w-3.5 h-3.5" />
                <span>Host PIN</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                    mode === 'PIN_ENTRY'
                      ? 'bg-black/20 text-black'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  All Photos
                </span>
              </button>
            </div>

      {/* VIEW 1: REAL-TIME AI FACE SCANNER */}
      {mode === 'FACE_SCAN' && (
        <div className="flex flex-col items-center space-y-1.5 sm:space-y-2 animate-fade-in">
          {/* Real-time AI Tracking Status Badge */}
          <div className="h-5 flex items-center justify-center">
            {cameraActive && !selfiePreview && (
              faceDetected ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/50 px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/10 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>AI Face Locked ({faceScore || 98}%)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span>AI Active • Center face in circle</span>
                </div>
              )
            )}
          </div>

          {/* Camera Viewport Oval with Live AI Target HUD */}
          <div
            onClick={cameraActive ? captureSelfieAndMatch : () => captureInputRef.current?.click()}
            className={`relative w-32 h-32 sm:w-36 sm:h-36 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden border-3 sm:border-4 transition-all duration-300 shadow-2xl bg-black flex items-center justify-center cursor-pointer group ${
              faceDetected
                ? 'border-emerald-400 ring-4 ring-emerald-400/30 shadow-emerald-500/20'
                : cameraActive
                ? 'border-[#d4af37] ring-4 ring-amber-400/20'
                : 'border-neutral-700'
            }`}
            title="Click to capture selfie"
          >
            {selfiePreview ? (
              <img
                src={selfiePreview}
                alt="Selfie Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  cameraActive ? 'block' : 'hidden'
                }`}
              />
            )}

            {/* If camera is inactive and no preview, show placeholder */}
            {!cameraActive && !selfiePreview && (
              <div className="text-center p-2">
                <div className="w-8 h-8 mx-auto rounded-full bg-[#d4af37]/20 text-[#f7d070] flex items-center justify-center mb-1">
                  <CameraIcon className="w-4 h-4" />
                </div>
                <p className="text-[11px] font-semibold text-neutral-300">Tap to start camera</p>
              </div>
            )}

            {/* Real-time Autofocus Viewfinder Target Markers (Shown when face detected) */}
            {cameraActive && faceDetected && !selfiePreview && (
              <div className="absolute inset-4 pointer-events-none transition-all">
                {/* Top-left corner */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl"></div>
                {/* Top-right corner */}
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr"></div>
                {/* Bottom-left corner */}
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl"></div>
                {/* Bottom-right corner */}
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br"></div>
              </div>
            )}

            {/* Overlay Guide Ring */}
            <div className="absolute inset-2.5 rounded-full border border-dashed border-white/30 pointer-events-none"></div>

            {/* Active Scanning / Neural Matching Spinner */}
            {isProcessingFace && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white p-2">
                <div className="w-7 h-7 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-1.5"></div>
                <p className="text-[11px] font-bold text-amber-300">AI Matching...</p>
                <p className="text-[9px] text-neutral-300 mt-0.5">Scanning 55%+ match</p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-neutral-300 text-center max-w-xs leading-tight">
            {cameraActive
              ? faceDetected
                ? 'Face locked! Tap the Capture button below.'
                : 'Center your face (front or side profile) inside circle.'
              : 'Tap "Take Selfie" or upload below to view your photos.'}
          </p>

          {cameraError && (
            <div className="w-full text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 p-1.5 rounded-xl text-center">
              {cameraError}
            </div>
          )}

          {/* Hidden Native Camera & File Pickers */}
          <input
            type="file"
            ref={captureInputRef}
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleNativePhotoUpload}
          />
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleNativePhotoUpload}
          />

          {/* PRIMARY CAPTURE ACTION BUTTON - ALWAYS VISIBLE IN ONE VIEW */}
          <div className="w-full pt-0.5 space-y-1.5">
            {cameraActive ? (
              <button
                type="button"
                onClick={captureSelfieAndMatch}
                disabled={isProcessingFace}
                className={`w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/25 hover:brightness-105 active:scale-95 disabled:opacity-50 transition flex items-center justify-center gap-2 ${
                  faceDetected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black animate-pulse' : ''
                }`}
              >
                <CameraIcon className="w-4 h-4 text-black" />
                <span>{isProcessingFace ? 'AI Matching...' : 'Capture & Find My Photos 📸'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => captureInputRef.current?.click()}
                disabled={isProcessingFace}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/25 hover:brightness-105 active:scale-95 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                <CameraIcon className="w-4 h-4 text-black" />
                <span>{isProcessingFace ? 'AI Matching...' : 'Take Selfie with Camera 📸'}</span>
              </button>
            )}

            {/* Quick helper links below the capture button */}
            <div className="flex items-center justify-center gap-3 pt-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFace}
                className="text-neutral-400 hover:text-white transition flex items-center gap-1 underline underline-offset-4 decoration-neutral-700 hover:decoration-amber-400"
              >
                <span>📁 Upload from gallery</span>
              </button>
              <span className="text-neutral-700">•</span>
              <button
                type="button"
                onClick={() => handleSelectMode('PIN_ENTRY')}
                className="text-neutral-400 hover:text-[#f7d070] transition flex items-center gap-1 underline underline-offset-4 decoration-neutral-700 hover:decoration-amber-400"
              >
                <span>🔑 Enter Event PIN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: PIN ENTRY (OLD OPTION - FULL ALBUM ACCESS) */}
      {mode === 'PIN_ENTRY' && (
        <div className="space-y-3 animate-fade-in">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 mb-1">
              <KeyIcon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Enter Event PIN</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Enter the 6-digit numeric access code to browse the <strong>entire gallery</strong>.
            </p>
          </div>

          {/* PIN Display Boxes */}
          <div className="flex justify-center space-x-2 my-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className={`w-9 h-11 rounded-lg border flex items-center justify-center text-lg font-black font-mono transition-all ${
                  pin[idx]
                    ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f7d070] shadow-md shadow-amber-500/10'
                    : 'border-[#2a2a36] bg-[#141418] text-neutral-600'
                }`}
              >
                {pin[idx] ? '●' : ''}
              </div>
            ))}
          </div>

          {pinError && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2 rounded-xl text-center">
              {pinError}
            </div>
          )}

          {/* Touch-Friendly Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="py-2.5 rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-white font-bold text-base hover:bg-neutral-800 active:scale-95 transition shadow"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleSelectMode('FACE_SCAN')}
              className="py-2.5 rounded-xl bg-[#141418] border border-[#2a2a36] text-amber-400 font-medium text-xs hover:bg-neutral-800 active:scale-95 transition flex items-center justify-center"
            >
              Scan Face
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="py-2.5 rounded-xl bg-[#1c1c24] border border-[#2a2a36] text-white font-bold text-base hover:bg-neutral-800 active:scale-95 transition shadow"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="py-2.5 rounded-xl bg-[#141418] border border-[#2a2a36] text-neutral-300 font-bold text-sm hover:bg-neutral-800 active:scale-95 transition flex items-center justify-center"
            >
              ⌫
            </button>
          </div>

          <button
            onClick={handlePinSubmit}
            disabled={pin.length < 4 || isVerifyingPin}
            className="w-full py-3 rounded-xl bg-white text-black hover:bg-neutral-200 disabled:opacity-40 font-bold text-sm transition active:scale-95 shadow-md"
          >
            {isVerifyingPin ? 'Verifying PIN...' : 'Unlock Entire Gallery'}
          </button>

          {/* Quick link back to AI Face Scan */}
          <button
            type="button"
            onClick={() => handleSelectMode('FACE_SCAN')}
            className="w-full py-1 text-xs text-neutral-400 hover:text-amber-400 transition text-center flex items-center justify-center gap-1.5"
          >
            <CameraIcon className="w-3.5 h-3.5" />
            <span>Prefer to find only photos of yourself? Use AI Face Scan →</span>
          </button>
        </div>
      )}

      {/* VIEW 3: NO MATCH FOUND */}
      {mode === 'NO_MATCH' && (
        <div className="space-y-5 animate-fade-in text-center">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <CameraIcon className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">No Matching Photos Found</h3>
            <p className="text-xs text-neutral-400 mt-2 max-w-xs mx-auto leading-relaxed">
              We couldn't find photos matching at least 55% of your facial features. Try taking another selfie with good lighting, or enter the Event PIN to view all photos.
            </p>
          </div>

          {selfiePreview && (
            <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-neutral-700">
              <img src={selfiePreview} alt="Selfie taken" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleSelectMode('FACE_SCAN')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-extrabold text-sm shadow-md hover:opacity-95 active:scale-95 transition"
            >
              Try Another Selfie 📸
            </button>

            <button
              onClick={() => handleSelectMode('PIN_ENTRY')}
              className="w-full py-3.5 rounded-2xl bg-[#1c1c24] border border-[#2a2a36] text-white font-bold text-sm hover:bg-[#242430] active:scale-95 transition flex items-center justify-center gap-2"
            >
              <KeyIcon className="w-4 h-4 text-[#f7d070]" />
              <span>Enter Event PIN (View All Photos)</span>
            </button>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}
