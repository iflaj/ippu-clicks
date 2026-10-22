import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import archiver from 'archiver';
import { EventDAO, PhotoDAO } from '../data/db.js';
import { matchPhotosByFace, extractAiDescriptors, extractFeatureDescriptors, extractFeatureDescriptor } from '../services/faceService.js';
import { applyWatermark } from '../services/watermarkService.js';
import { UPLOADS_DIR } from '../config/index.js';

/**
 * ADMIN: Bulk Upload Photos to an Event
 */
export async function uploadEventPhotos(req, res) {
  try {
    const { eventId } = req.params;
    const event = EventDAO.getById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files were uploaded.' });
    }

    const eventUploadDir = path.join(UPLOADS_DIR, eventId);
    const rawUploadDir = path.join(eventUploadDir, 'raw');
    const thumbUploadDir = path.join(eventUploadDir, 'thumbs');
    if (!fs.existsSync(rawUploadDir)) {
      fs.mkdirSync(rawUploadDir, { recursive: true });
    }
    if (!fs.existsSync(thumbUploadDir)) {
      fs.mkdirSync(thumbUploadDir, { recursive: true });
    }

    // Determine watermark settings for this event
    const customWatermarkPath = event.watermarkFilename
      ? path.join(eventUploadDir, event.watermarkFilename)
      : (fs.existsSync(path.join(eventUploadDir, 'watermark.png')) ? path.join(eventUploadDir, 'watermark.png') : null);

    const wmConfig = {
      enableWatermark: event.enableWatermark !== undefined ? Boolean(event.enableWatermark) : true,
      watermarkPath: customWatermarkPath,
      watermarkText: event.watermarkText || event.name || '© Ippu Clicks Photography',
      position: event.watermarkPosition || 'bottom-right',
      scalePercent: event.watermarkScale || 22,
      opacityPercent: event.watermarkOpacity || 90
    };

    const photoRecords = [];

    let descriptorsMap = {};
    if (req.body.descriptorsMap) {
      try {
        descriptorsMap = JSON.parse(req.body.descriptorsMap);
      } catch (e) {
        // ignore parsing error
      }
    }

    for (const file of req.files) {
      const photoId = `pho_${uuidv4()}`;
      const thumbFilename = `thumb_${file.filename}`;
      const thumbPath = path.join(thumbUploadDir, thumbFilename);
      const rawPath = path.join(rawUploadDir, file.filename);

      // 1. Preserve untouched raw original
      try {
        fs.copyFileSync(file.path, rawPath);
      } catch (err) {
        console.warn('Failed to copy raw original:', err);
      }

      // 2. Extract real feature descriptors from the photo (AI FaceNet with multi-crop fallback)
      let storedDescriptors = descriptorsMap[file.originalname];
      if (!storedDescriptors) {
        const aiDescs = await extractAiDescriptors(file.path);
        if (aiDescs && aiDescs.length > 0) {
          storedDescriptors = aiDescs;
        } else {
          const descs = await extractFeatureDescriptors(file.path);
          storedDescriptors = descs || [];
        }
      } else if (!Array.isArray(storedDescriptors[0])) {
        storedDescriptors = [storedDescriptors];
      }

      // 3. Apply watermark if enabled
      if (wmConfig.enableWatermark) {
        try {
          await applyWatermark(rawPath, file.path, wmConfig);
        } catch (err) {
          console.warn('Failed to apply watermark on upload:', file.filename, err);
        }
      }

      // 4. Generate optimized mobile thumbnail from final image
      try {
        await sharp(file.path)
          .resize(600, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } catch (err) {
        console.warn('Failed to generate thumbnail for', file.filename, err);
      }

      photoRecords.push({
        id: photoId,
        eventId: event.id,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        url: `/uploads/${eventId}/${file.filename}`,
        thumbnailUrl: `/uploads/${eventId}/thumbs/${thumbFilename}`,
        faceDescriptors: storedDescriptors,
        createdAt: new Date().toISOString()
      });
    }

    PhotoDAO.createMany(photoRecords);

    return res.status(201).json({
      message: `Successfully uploaded ${photoRecords.length} photos.`,
      uploadedCount: photoRecords.length,
      photos: photoRecords
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to process photo uploads.' });
  }
}

/**
 * ADMIN: Delete a single photo
 */
export async function deletePhoto(req, res) {
  try {
    const { photoId } = req.params;
    const photo = PhotoDAO.getById(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });

    // Remove from disk
    const filePath = path.join(UPLOADS_DIR, photo.eventId, photo.filename);
    const rawPath = path.join(UPLOADS_DIR, photo.eventId, 'raw', photo.filename);
    const thumbPath = path.join(UPLOADS_DIR, photo.eventId, 'thumbs', `thumb_${photo.filename}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

    PhotoDAO.delete(photoId);
    return res.json({ message: 'Photo deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete photo.' });
  }
}


/**
 * CLIENT: Match Face from Selfie Descriptor or Image
 * POST /api/client/events/:slug/match-face
 */
export async function matchClientFace(req, res) {
  try {
    const { slug } = req.params;
    const event = EventDAO.getBySlug(slug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    let queryDescriptor = null;

    // Client pre-extracted descriptor
    if (req.body.descriptor) {
      try {
        queryDescriptor = typeof req.body.descriptor === 'string'
          ? JSON.parse(req.body.descriptor)
          : req.body.descriptor;
      } catch (e) {}
    }

    // Extract deep AI descriptor or multi-angle descriptors from uploaded selfie buffer if not provided
    if (!queryDescriptor && req.file && req.file.buffer) {
      const aiDescs = await extractAiDescriptors(req.file.buffer);
      if (aiDescs && aiDescs.length > 0) {
        queryDescriptor = aiDescs;
      } else {
        queryDescriptor = await extractFeatureDescriptors(req.file.buffer);
      }
    }

    const eventPhotos = PhotoDAO.getByEvent(event.id);

    if (eventPhotos.length === 0) {
      return res.json({
        success: false,
        matchedPhotos: [],
        matchedCount: 0,
        message: 'No photos have been uploaded to this event yet.',
        allowDownloads: event.allowDownloads
      });
    }

    if (!queryDescriptor) {
      return res.status(400).json({ error: 'No selfie image or facial descriptor was received.' });
    }

    // Match face against photos using calibrated threshold (default 55% confidence)
    const minConfidence = req.query.minConfidence
      ? parseInt(req.query.minConfidence, 10)
      : (req.body.minConfidence ? parseInt(req.body.minConfidence, 10) : 55);

    const matches = matchPhotosByFace(queryDescriptor, eventPhotos, minConfidence);

    if (matches.length === 0) {
      return res.json({
        success: false,
        accessType: 'FACE_FILTERED',
        matchedCount: 0,
        matchedPhotos: [],
        message: 'No matching photos found for your face in this event.',
        allowDownloads: event.allowDownloads
      });
    }

    return res.json({
      success: true,
      accessType: 'FACE_FILTERED',
      matchedCount: matches.length,
      matchedPhotos: matches.map(p => ({
        id: p.id,
        url: p.url,
        thumbnailUrl: p.thumbnailUrl || p.url,
        originalName: p.originalName,
        matchConfidence: p.matchConfidence
      })),
      allowDownloads: event.allowDownloads
    });
  } catch (error) {
    console.error('Face match error:', error);
    return res.status(500).json({ error: 'Face recognition processing failed.' });
  }
}

/**
 * CLIENT: Multi-photo ZIP Download (Guarded by allowDownloads permission)
 * POST /api/client/events/:slug/download-zip
 */
export async function downloadPhotosZip(req, res) {
  try {
    const { slug } = req.params;
    const { photoIds } = req.body;

    const event = EventDAO.getBySlug(slug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    // Strict Permission Guard
    if (!event.allowDownloads) {
      return res.status(403).json({
        error: 'Downloads are disabled for this event by the photographer.'
      });
    }

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'No photos selected for download.' });
    }

    const photos = PhotoDAO.getByIds(photoIds).filter(p => p.eventId === event.id);

    if (photos.length === 0) {
      return res.status(404).json({ error: 'Selected photos were not found.' });
    }

    // Set streaming ZIP response headers
    const zipName = `${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_IppuClicks_Photos.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    for (const photo of photos) {
      // Prioritize raw pristine original uploaded photo (100% untouched quality, no re-compression)
      const rawPath = path.join(UPLOADS_DIR, photo.eventId, 'raw', photo.filename);
      const standardPath = path.join(UPLOADS_DIR, photo.eventId, photo.filename);
      const downloadPath = fs.existsSync(rawPath) ? rawPath : standardPath;

      if (fs.existsSync(downloadPath)) {
        archive.file(downloadPath, { name: photo.originalName || photo.filename });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('ZIP download error:', error);
    return res.status(500).json({ error: 'Failed to create ZIP package.' });
  }
}

/**
 * CLIENT: Download Single Photo at 100% Original Upload Quality
 * GET /api/client/events/:slug/photos/:photoId/download
 */
export async function downloadSinglePhoto(req, res) {
  try {
    const { slug, photoId } = req.params;
    const event = EventDAO.getBySlug(slug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    if (!event.allowDownloads) {
      return res.status(403).json({ error: 'Downloads are disabled for this event.' });
    }

    const photo = PhotoDAO.getById(photoId);
    if (!photo || photo.eventId !== event.id) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    // Serve the pristine, untouched original uploaded file from raw/ (100% upload quality)
    const rawPath = path.join(UPLOADS_DIR, event.id, 'raw', photo.filename);
    const standardPath = path.join(UPLOADS_DIR, event.id, photo.filename);
    const downloadPath = fs.existsSync(rawPath) ? rawPath : standardPath;

    if (!fs.existsSync(downloadPath)) {
      return res.status(404).json({ error: 'Photo file missing on server.' });
    }

    return res.download(downloadPath, photo.originalName || photo.filename);
  } catch (err) {
    console.error('Download single photo error:', err);
    return res.status(500).json({ error: 'Failed to download photo.' });
  }
}
