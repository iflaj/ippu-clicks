import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../config/index.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const eventId = req.params.eventId || 'general';
    const targetDir = path.join(UPLOADS_DIR, eventId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow all image types without restriction
  const allowedExts = /\.(jpe?g|png|webp|heic|avif|tiff?|bmp|dng|raw|cr2|nef|arw)$/i;
  const isImage = file.mimetype.startsWith('image/') || allowedExts.test(file.originalname);

  if (isImage) {
    cb(null, true);
  } else {
    cb(new Error('Please upload valid image files.'), false);
  }
};

/**
 * Bulk image uploader with ZERO limits on file size or batch quantity.
 * Allows photographer to upload unlimited high-resolution photos in original quality.
 */
export const uploadBulkImages = multer({
  storage,
  fileFilter
  // Uncapped: No fileSize limit, no batch count limit
}).array('photos');

/**
 * Selfie uploader with unconstrained limits.
 */
export const uploadSingleSelfie = multer({
  storage: multer.memoryStorage()
}).single('selfie');

export const uploadSingleWatermark = multer({
  storage: multer.memoryStorage()
}).single('watermark');

/**
 * Safe Express middleware wrapper for single selfie upload.
 */
export function handleSingleSelfieUpload(req, res, next) {
  uploadSingleSelfie(req, res, (err) => {
    if (err) {
      console.warn('Selfie upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Failed to process uploaded selfie.' });
    }
    next();
  });
}

/**
 * Safe Express middleware wrapper for bulk photo upload (unlimited size & count).
 */
export function handleBulkImagesUpload(req, res, next) {
  uploadBulkImages(req, res, (err) => {
    if (err) {
      console.warn('Bulk photos upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Failed to process photo uploads.' });
    }
    next();
  });
}

/**
 * Safe Express middleware wrapper for watermark upload.
 */
export function handleSingleWatermarkUpload(req, res, next) {
  uploadSingleWatermark(req, res, (err) => {
    if (err) {
      console.warn('Watermark upload error:', err.message);
      return res.status(400).json({ error: err.message || 'Failed to process watermark upload.' });
    }
    next();
  });
}
