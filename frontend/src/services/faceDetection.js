import * as faceapi from '@vladmandic/face-api';

let modelsLoadedPromise = null;
let modelsReady = false;

/**
 * Loads face-api models from /models/ directory.
 * Uses TinyFaceDetector and FaceRecognitionNet for fast real-time inference in browser.
 */
export async function loadFaceApiModels() {
  if (modelsReady) return true;
  if (modelsLoadedPromise) return modelsLoadedPromise;

  modelsLoadedPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsReady = true;
      return true;
    } catch (err) {
      console.warn('Failed to load face-api models from /models:', err);
      modelsLoadedPromise = null;
      return false;
    }
  })();

  return modelsLoadedPromise;
}

/**
 * Fast real-time detection on a video stream or image element.
 * Optimized for 15-30 FPS UI tracking overlay.
 */
export async function detectFaceRealtime(videoElement) {
  if (!modelsReady || !videoElement || videoElement.readyState < 2) return null;

  try {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.35,
    });

    const detection = await faceapi.detectSingleFace(videoElement, options);
    if (!detection) return null;

    return {
      box: detection.box,
      score: detection.score,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Extracts 128-D FaceNet descriptor from an HTML element (video, canvas, or image).
 */
export async function extractAiDescriptor(mediaElement) {
  const loaded = await loadFaceApiModels();
  if (!loaded) return null;

  try {
    // 1. Try TinyFaceDetector with higher resolution input for precision
    const tinyOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.3,
    });

    let detection = await faceapi
      .detectSingleFace(mediaElement, tinyOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (detection && detection.descriptor) {
      return Array.from(detection.descriptor);
    }

    // 2. Retry with lower threshold for side angles / low lighting
    const sensitiveOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.2,
    });

    detection = await faceapi
      .detectSingleFace(mediaElement, sensitiveOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (detection && detection.descriptor) {
      return Array.from(detection.descriptor);
    }

    return null;
  } catch (err) {
    console.warn('AI descriptor extraction error:', err);
    return null;
  }
}

/**
 * Extracts descriptor directly from an image File or Blob.
 */
export async function extractDescriptorFromFile(fileOrBlob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const descriptor = await extractAiDescriptor(img);
        URL.revokeObjectURL(url);
        resolve(descriptor);
      } catch (e) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
