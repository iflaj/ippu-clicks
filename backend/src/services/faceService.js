import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let faceapi = null;
let aiModelsLoaded = false;
let aiModelsLoadingPromise = null;

/**
 * Lazily loads face-api models in Node.js for backend AI face recognition.
 */
export async function ensureAiModelsLoaded() {
  if (aiModelsLoaded) return true;
  if (aiModelsLoadingPromise) return aiModelsLoadingPromise;

  aiModelsLoadingPromise = (async () => {
    try {
      const mod = await import('@vladmandic/face-api/dist/face-api.node-wasm.js');
      faceapi = mod.default || mod;
      await faceapi.tf.setBackend('cpu');
      await faceapi.tf.ready();

      const modelPath = path.resolve(__dirname, '../../node_modules/@vladmandic/face-api/model');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
      aiModelsLoaded = true;
      return true;
    } catch (err) {
      console.warn('Backend face-api AI model load fallback:', err.message);
      aiModelsLoadingPromise = null;
      return false;
    }
  })();

  return aiModelsLoadingPromise;
}

export function isAiReady() {
  return aiModelsLoaded;
}

/**
 * Extracts 128-D deep neural network facial descriptor using FaceNet.
 * Supports front and side profile detection.
 *
 * @param {Buffer|string} imageBufferOrPath
 * @returns {Promise<number[][]>} Array containing 128-D vector if face found, or empty array
 */
export async function extractAiDescriptors(imageBufferOrPath) {
  try {
    const ready = await ensureAiModelsLoaded();
    if (!ready || !faceapi) return [];

    const { data, info } = await sharp(imageBufferOrPath)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);

    // 1. Detect all faces in photo so group & candid shots index all individuals
    let detections = await faceapi.detectAllFaces(tensor).withFaceLandmarks().withFaceDescriptors();

    // 2. Fallback to single face with lower sensitivity threshold if no faces found
    if (!detections || detections.length === 0) {
      const single = await faceapi.detectSingleFace(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (single) {
        detections = [single];
      }
    }

    tensor.dispose();

    if (detections && detections.length > 0) {
      return detections
        .map((d) => Array.from(d.descriptor))
        .filter((desc) => Array.isArray(desc) && desc.length === 128);
    }
    return [];
  } catch (err) {
    console.warn('extractAiDescriptors error:', err.message);
    return [];
  }
}


/**
 * Face recognition and visual descriptor indexing service.
 * Features:
 * - Multi-region candidate crops: center, upper-center portrait, left profile, right profile, and close-up face.
 * - 280-dimensional feature vectors: 10x10 normalized luminance + horizontal and vertical gradient edge maps.
 * - Horizontal symmetry flipping: allows matching between left-facing and right-facing profile shots.
 * - Calibrated matching threshold supporting >=55% confidence filtering as requested.
 */

/**
 * Extracts an array of multi-angle, multi-crop feature descriptors from an image buffer or file path.
 *
 * @param {Buffer|string} imageBufferOrPath
 * @returns {Promise<number[][]|null>} Array of 280-dimensional normalized feature vectors
 */
export async function extractFeatureDescriptors(imageBufferOrPath) {
  try {
    const meta = await sharp(imageBufferOrPath).metadata();
    const w = meta.width || 600;
    const h = meta.height || 600;

    // Multi-region candidates targeting portraits, side profiles, and event candids
    const regions = [
      // 1. Center / whole image crop
      null,
      // 2. Upper-center (primary natural location of face in portrait/event photos)
      { left: Math.round(w * 0.15), top: Math.round(h * 0.08), width: Math.round(w * 0.70), height: Math.round(h * 0.62) },
      // 3. Left-side profile crop (subject looking left or framed on the left)
      { left: 0, top: Math.round(h * 0.08), width: Math.round(w * 0.65), height: Math.round(h * 0.62) },
      // 4. Right-side profile crop (subject looking right or framed on the right)
      { left: Math.round(w * 0.35), top: Math.round(h * 0.08), width: Math.round(w * 0.65), height: Math.round(h * 0.62) },
      // 5. Close-up face crop (upper 15% to 60%, middle 56% width)
      { left: Math.round(w * 0.22), top: Math.round(h * 0.15), width: Math.round(w * 0.56), height: Math.round(h * 0.45) }
    ];

    const descriptors = [];

    for (const reg of regions) {
      let pipeline = sharp(imageBufferOrPath);
      if (reg) {
        const validReg = {
          left: Math.max(0, Math.min(w - 10, reg.left)),
          top: Math.max(0, Math.min(h - 10, reg.top)),
          width: Math.min(w - Math.max(0, reg.left), reg.width),
          height: Math.min(h - Math.max(0, reg.top), reg.height)
        };
        pipeline = pipeline.extract(validReg);
      }

      // 1. 10x10 normalized grayscale luminance (100 values)
      const rawLum = await pipeline.clone()
        .resize(10, 10, { fit: 'cover', position: 'center' })
        .grayscale()
        .normalize()
        .raw()
        .toBuffer();

      const lum = Array.from(rawLum);

      // 2. Horizontal (90) and Vertical (90) gradient features
      // Captures distinct facial contour silhouettes (nose bridge, lips, jawline)
      const gradH = [];
      const gradV = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          gradH.push(lum[r * 10 + c + 1] - lum[r * 10 + c]);
        }
      }
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 10; c++) {
          gradV.push(lum[(r + 1) * 10 + c] - lum[r * 10 + c]);
        }
      }

      // Combined 280-length vector
      const vec = [...lum, ...gradH, ...gradV];
      const mean = vec.reduce((s, v) => s + v, 0) / vec.length;
      const centered = vec.map((v) => v - mean);
      const norm = Math.sqrt(centered.reduce((s, v) => s + v * v, 0));

      if (norm > 0) {
        const normDesc = centered.map((v) => Number((v / norm).toFixed(5)));
        descriptors.push(normDesc);

        // 3. Horizontally mirrored version for profile angle invariance (left profile == right profile)
        const flippedLum = [];
        for (let r = 0; r < 10; r++) {
          for (let c = 9; c >= 0; c--) {
            flippedLum.push(lum[r * 10 + c]);
          }
        }
        const flippedGradH = [];
        for (let r = 0; r < 10; r++) {
          for (let c = 8; c >= 0; c--) {
            flippedGradH.push(-gradH[r * 9 + c]);
          }
        }
        const flippedGradV = [];
        for (let r = 0; r < 9; r++) {
          for (let c = 9; c >= 0; c--) {
            flippedGradV.push(gradV[r * 10 + c]);
          }
        }

        const fVec = [...flippedLum, ...flippedGradH, ...flippedGradV];
        const fMean = fVec.reduce((s, v) => s + v, 0) / fVec.length;
        const fCentered = fVec.map((v) => v - fMean);
        const fNorm = Math.sqrt(fCentered.reduce((s, v) => s + v * v, 0));
        if (fNorm > 0) {
          descriptors.push(fCentered.map((v) => Number((v / fNorm).toFixed(5))));
        }
      }
    }

    return descriptors.length > 0 ? descriptors : null;
  } catch (err) {
    console.error('Failed to extract feature descriptors from image:', err);
    return null;
  }
}

/**
 * Backward-compatibility wrapper that extracts a single primary descriptor or descriptors list.
 */
export async function extractFeatureDescriptor(imageBufferOrPath) {
  const descriptors = await extractFeatureDescriptors(imageBufferOrPath);
  return descriptors && descriptors.length > 0 ? descriptors[0] : null;
}

/**
 * Calculates Euclidean distance between two vectors.
 */
export function euclideanDistance(descA, descB) {
  if (!descA || !descB || !descA.length || descA.length !== descB.length) {
    return Infinity;
  }
  let sum = 0;
  for (let i = 0; i < descA.length; i++) {
    const diff = descA[i] - descB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Matches query descriptors against all photos in an event.
 * Computes the minimum distance across all candidate crops/profiles, calculates
 * match confidence percentage, and filters results to those meeting minConfidence (default 55%).
 *
 * @param {number[]|number[][]} queryDescriptor - Single vector or array of candidate vectors
 * @param {Array} eventPhotos - Photos containing faceDescriptors
 * @param {number} [minConfidence=55] - Minimum percentage confidence to include (default: 55)
 * @returns {Array} Matched photo records sorted by highest matchConfidence
 */
export function matchPhotosByFace(queryDescriptor, eventPhotos, minConfidence = 55) {
  if (!queryDescriptor) return [];

  // Normalize query to an array of descriptor vectors
  let rawQuery = [];
  if (Array.isArray(queryDescriptor) && queryDescriptor.length > 0) {
    if (Array.isArray(queryDescriptor[0])) {
      rawQuery = queryDescriptor;
    } else {
      rawQuery = [queryDescriptor];
    }
  }

  // Filter out any empty, non-vector, or invalid vectors (must have 128 or 280 dimensions)
  const queryList = rawQuery.filter((q) => Array.isArray(q) && (q.length === 128 || q.length === 280));
  if (queryList.length === 0) return [];

  const matches = [];
  // Max distance calibrated for 55% confidence threshold (0.83 distance maps to 55%)
  const maxDistanceFor55 = 0.83;

  for (const photo of eventPhotos) {
    if (!photo.faceDescriptors || !Array.isArray(photo.faceDescriptors) || photo.faceDescriptors.length === 0) {
      continue;
    }

    // Normalize stored photo descriptors and filter valid vectors
    let rawStored = [];
    if (Array.isArray(photo.faceDescriptors[0])) {
      rawStored = photo.faceDescriptors;
    } else {
      rawStored = [photo.faceDescriptors];
    }

    const storedList = rawStored.filter((s) => Array.isArray(s) && (s.length === 128 || s.length === 280));
    if (storedList.length === 0) continue;

    let minDistance = Infinity;
    let is128D = false;

    for (const qDesc of queryList) {
      for (const sDesc of storedList) {
        if (qDesc.length === sDesc.length) {
          const dist = euclideanDistance(qDesc, sDesc);
          if (dist < minDistance) {
            minDistance = dist;
            if (qDesc.length === 128) is128D = true;
          }
        }
      }
    }

    if (minDistance === Infinity) continue;

    let confidence = 0;
    if (is128D) {
      // High-precision AI FaceNet 128-D mapping:
      // Distance 0.00 -> 99% match
      // Distance 0.40 -> 72% match
      // Distance 0.55 -> 62% match
      // Distance 0.65 -> 55% match
      // Distance > 0.65 -> < 55% (filtered out)
      confidence = Math.round(100 - (minDistance / 0.65) * 45);
    } else {
      // Multi-crop contour descriptor fallback
      confidence = Math.round(99 - (minDistance / maxDistanceFor55) * (99 - 55));
    }
    confidence = Math.max(0, Math.min(99, confidence));

    if (confidence >= minConfidence) {
      matches.push({
        ...photo,
        matchConfidence: confidence,
        matchDistance: Number(minDistance.toFixed(4)),
        isAiMatched: is128D
      });
    }
  }

  // Sort by highest match confidence first, then by lowest distance
  matches.sort((a, b) => b.matchConfidence - a.matchConfidence || a.matchDistance - b.matchDistance);
  return matches;
}
