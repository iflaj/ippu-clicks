import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR, ASSETS_DIR } from '../config/index.js';
import { PhotoDAO } from '../data/db.js';

/**
 * Apply a transparent PNG watermark image (or fallback text/logo) onto a photo.
 *
 * @param {string} inputPath - Path to original unwatermarked photo
 * @param {string} outputPath - Path to write the watermarked photo
 * @param {object} config - Watermark configuration
 * @param {boolean} [config.enableWatermark=true] - Whether watermarking is active
 * @param {string} [config.watermarkPath] - Absolute path to uploaded transparent PNG watermark
 * @param {string} [config.watermarkText] - Optional fallback text watermark
 * @param {string} [config.position='bottom-right'] - 'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
 * @param {number} [config.scalePercent=22] - Watermark width as % of photo width (10-40)
 * @param {number} [config.opacityPercent=90] - Opacity percentage (10-100)
 */
export async function applyWatermark(inputPath, outputPath, config = {}) {
  const {
    enableWatermark = true,
    watermarkPath,
    watermarkText = '© Ippu Clicks Photography • 0759125207',
    position = 'bottom-right',
    scalePercent = 22,
    opacityPercent = 90
  } = config;

  if (!enableWatermark) {
    // If watermark disabled, simply copy or re-encode
    if (inputPath !== outputPath) {
      fs.copyFileSync(inputPath, outputPath);
    }
    return;
  }

  const baseImage = sharp(inputPath);
  const meta = await baseImage.metadata();
  const imgWidth = meta.width || 1200;
  const imgHeight = meta.height || 800;

  const isFitOnPhoto = Number(scalePercent) >= 95;
  let watermarkOverlayBuffer = null;
  let wmWidth;
  let wmHeight = 0;


  if (isFitOnPhoto) {
    wmWidth = imgWidth;
  } else {
    const clampedScale = Math.min(80, Math.max(10, Number(scalePercent) || 22));
    wmWidth = Math.max(120, Math.round(imgWidth * (clampedScale / 100)));
  }

  // Case A: Custom transparent PNG file provided and exists
  if (watermarkPath && fs.existsSync(watermarkPath)) {
    try {
      const resizeConfig = isFitOnPhoto
        ? { width: imgWidth, height: imgHeight, fit: 'inside' }
        : { width: wmWidth, height: null, fit: 'inside' };

      const resizedWm = await sharp(watermarkPath)
        .resize(resizeConfig.width, resizeConfig.height, { fit: resizeConfig.fit })
        .png()
        .toBuffer();

      const wmMeta = await sharp(resizedWm).metadata();
      wmWidth = wmMeta.width;
      wmHeight = wmMeta.height;

      const opacity = Math.min(1, Math.max(0.1, opacityPercent / 100));
      if (opacity < 0.99) {
        const b64 = resizedWm.toString('base64');
        watermarkOverlayBuffer = Buffer.from(
          `<svg width="${wmWidth}" height="${wmHeight}" xmlns="http://www.w3.org/2000/svg">` +
          `<image href="data:image/png;base64,${b64}" width="${wmWidth}" height="${wmHeight}" opacity="${opacity.toFixed(2)}"/>` +
          `</svg>`
        );
      } else {
        watermarkOverlayBuffer = resizedWm;
      }
    } catch (err) {
      console.warn('Failed to load custom PNG watermark, falling back to brand badge:', err);
    }
  }

  // Case B: Fallback brand SVG badge if no custom PNG provided or failed to load
  if (!watermarkOverlayBuffer) {
    const textStr = (watermarkText && watermarkText.trim()) || '© Ippu Clicks Photography';
    const textLen = textStr.length;
    const fontSize = isFitOnPhoto
      ? Math.max(22, Math.round(imgWidth * 0.04))
      : Math.max(14, Math.round(imgWidth * 0.024));
    const paddingX = Math.round(fontSize * 1.4);
    wmWidth = isFitOnPhoto
      ? Math.round(imgWidth * 0.88)
      : Math.round(fontSize * 0.62 * textLen + paddingX * 2);
    wmHeight = Math.round(fontSize * 2.4);

    const opacity = Math.min(1, Math.max(0.1, opacityPercent / 100));
    watermarkOverlayBuffer = Buffer.from(`
      <svg width="${wmWidth}" height="${wmHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.8"/>
          </filter>
        </defs>
        <rect x="2" y="2" width="${wmWidth - 4}" height="${wmHeight - 4}" rx="${Math.round(wmHeight * 0.35)}" fill="rgba(12, 12, 16, ${Math.min(0.85, opacity * 0.9).toFixed(2)})" stroke="rgba(212, 175, 55, ${opacity.toFixed(2)})" stroke-width="1.5" filter="url(#shadow)"/>
        <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="${fontSize}px" font-family="system-ui, -apple-system, sans-serif" font-weight="600" opacity="${opacity.toFixed(2)}">
          ${textStr}
        </text>
      </svg>
    `);
  }

  // Calculate coordinates with margin
  const margin = isFitOnPhoto ? 0 : Math.max(16, Math.round(imgWidth * 0.025));
  let left = 0;
  let top = 0;

  switch (position) {
    case 'bottom-center':
      left = Math.round((imgWidth - wmWidth) / 2);
      top = imgHeight - wmHeight - margin;
      break;
    case 'bottom-left':
      left = margin;
      top = imgHeight - wmHeight - margin;
      break;
    case 'top-right':
      left = imgWidth - wmWidth - margin;
      top = margin;
      break;
    case 'top-left':
      left = margin;
      top = margin;
      break;
    case 'center':
      left = Math.round((imgWidth - wmWidth) / 2);
      top = Math.round((imgHeight - wmHeight) / 2);
      break;
    case 'bottom-right':
    default:
      left = isFitOnPhoto ? Math.round((imgWidth - wmWidth) / 2) : imgWidth - wmWidth - margin;
      top = imgHeight - wmHeight - margin;
      break;
  }


  // Clamp within bounds
  left = Math.max(0, Math.min(imgWidth - wmWidth, left));
  top = Math.max(0, Math.min(imgHeight - wmHeight, top));

  // Composite and save
  const tempOutput = `${outputPath}.tmp.jpg`;
  await sharp(inputPath)
    .composite([
      {
        input: watermarkOverlayBuffer,
        left,
        top
      }
    ])
    .jpeg({ quality: 90 })
    .toFile(tempOutput);

  // Replace target atomically
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  fs.renameSync(tempOutput, outputPath);
}

/**
 * Re-apply current event watermark configuration to all photos in an event.
 * Reads clean originals from `uploads/:eventId/raw/` and overwrites display and thumb images.
 *
 * @param {object} event - Event record
 * @returns {Promise<{ total: number, updated: number }>}
 */
export async function reapplyWatermarkToEvent(event) {
  const eventId = event.id;
  const eventDir = path.join(UPLOADS_DIR, eventId);
  const rawDir = path.join(eventDir, 'raw');
  const thumbDir = path.join(eventDir, 'thumbs');

  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
  }
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }

  const photos = PhotoDAO.getByEvent(eventId);
  let updatedCount = 0;

  // Determine watermark PNG path if exists
  const customWatermarkPath = event.watermarkFilename
    ? path.join(eventDir, event.watermarkFilename)
    : (fs.existsSync(path.join(eventDir, 'watermark.png')) ? path.join(eventDir, 'watermark.png') : null);

  const wmConfig = {
    enableWatermark: event.enableWatermark !== undefined ? Boolean(event.enableWatermark) : true,
    watermarkPath: customWatermarkPath,
    watermarkText: event.watermarkText || event.name || '© Ippu Clicks Photography',
    position: event.watermarkPosition || 'bottom-right',
    scalePercent: event.watermarkScale || 22,
    opacityPercent: event.watermarkOpacity || 90
  };

  for (const photo of photos) {
    const rawPhotoPath = path.join(rawDir, photo.filename);
    const finalPhotoPath = path.join(eventDir, photo.filename);
    const thumbPhotoPath = path.join(thumbDir, `thumb_${photo.filename}`);

    // If raw copy doesn't exist yet, backup the current photo to raw/
    if (!fs.existsSync(rawPhotoPath) && fs.existsSync(finalPhotoPath)) {
      fs.copyFileSync(finalPhotoPath, rawPhotoPath);
    }

    if (fs.existsSync(rawPhotoPath)) {
      try {
        // 1. Generate watermarked main image
        await applyWatermark(rawPhotoPath, finalPhotoPath, wmConfig);

        // 2. Generate updated thumbnail from watermarked main image
        await sharp(finalPhotoPath)
          .resize(600, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPhotoPath);

        updatedCount++;
      } catch (err) {
        console.warn(`Failed to reapply watermark to ${photo.filename}:`, err);
      }
    }
  }

  return { total: photos.length, updated: updatedCount };
}
