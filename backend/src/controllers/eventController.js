import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { EventDAO, PhotoDAO } from '../data/db.js';
import { generateBrandedQR } from '../services/qrService.js';
import { reapplyWatermarkToEvent } from '../services/watermarkService.js';
import { CONFIG, UPLOADS_DIR } from '../config/index.js';

function generateRandomPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * ADMIN: Create Event
 */
export async function createEvent(req, res) {
  try {
    const {
      name,
      date,
      details,
      customPin,
      allowDownloads,
      enableWatermark,
      watermarkText,
      watermarkPosition,
      watermarkScale,
      watermarkOpacity,
      watermarkBase64
    } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Event name and date are required.' });
    }

    const pin = (customPin && String(customPin).trim()) ? String(customPin).trim() : generateRandomPin();

    // Check PIN uniqueness
    const existingPin = EventDAO.getByPin(pin);
    if (existingPin) {
      return res.status(409).json({ error: 'This PIN is already assigned to another event. Please choose another.' });
    }

    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const publicSlug = `${slugBase}-${randomSuffix}`;
    const clientEventUrl = `${CONFIG.clientBaseUrl}/event/${publicSlug}`;

    // Generate branded QR code with Ippu Clicks logo
    const { dataUrl: qrCodeDataUrl } = await generateBrandedQR(clientEventUrl);

    const eventId = `evt_${uuidv4()}`;
    const eventUploadDir = path.join(UPLOADS_DIR, eventId);

    let watermarkUrl = null;
    let watermarkFilename = null;

    // Handle transparent PNG watermark if provided as base64
    if (watermarkBase64) {
      if (!fs.existsSync(eventUploadDir)) {
        fs.mkdirSync(eventUploadDir, { recursive: true });
      }
      const base64Data = watermarkBase64.replace(/^data:image\/\w+;base64,/, '');
      const wmBuffer = Buffer.from(base64Data, 'base64');
      const wmPath = path.join(eventUploadDir, 'watermark.png');
      fs.writeFileSync(wmPath, wmBuffer);
      watermarkFilename = 'watermark.png';
      watermarkUrl = `/uploads/${eventId}/watermark.png`;
    }

    const eventRecord = {
      id: eventId,
      name: name.trim(),
      date,
      details: details ? details.trim() : '',
      pin,
      publicSlug,
      clientEventUrl,
      allowDownloads: allowDownloads !== undefined ? Boolean(allowDownloads) : true,
      enableWatermark: enableWatermark !== undefined ? Boolean(enableWatermark) : true,
      watermarkUrl,
      watermarkFilename,
      watermarkPosition: watermarkPosition || 'bottom-right',
      watermarkScale: watermarkScale ? Number(watermarkScale) : 22,
      watermarkOpacity: watermarkOpacity ? Number(watermarkOpacity) : 90,
      watermarkText: watermarkText ? watermarkText.trim() : '© Ippu Clicks Photography • 0759125207',
      qrCodeDataUrl,
      photoCount: 0,
      createdAt: new Date().toISOString()
    };

    const savedEvent = EventDAO.create(eventRecord);

    return res.status(201).json({
      message: 'Event created successfully',
      event: savedEvent
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ error: 'Failed to create event.' });
  }
}


/**
 * ADMIN: Get all events
 */
export async function getAllEvents(req, res) {
  try {
    const events = EventDAO.getAll();
    const enriched = events.map(evt => ({
      ...evt,
      photoCount: PhotoDAO.getByEvent(evt.id).length
    }));
    return res.json({ events: enriched });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve events.' });
  }
}

/**
 * ADMIN: Get single event
 */
export async function getEventById(req, res) {
  try {
    const { id } = req.params;
    const event = EventDAO.getById(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const photos = PhotoDAO.getByEvent(id);
    return res.json({ event, photos });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve event.' });
  }
}

/**
 * ADMIN: Update Event
 */
export async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      date,
      details,
      pin,
      allowDownloads,
      enableWatermark,
      watermarkText,
      watermarkPosition,
      watermarkScale,
      watermarkOpacity,
      watermarkBase64
    } = req.body;

    const existing = EventDAO.getById(id);
    if (!existing) return res.status(404).json({ error: 'Event not found.' });

    const updates = {};
    if (name) updates.name = name.trim();
    if (date) updates.date = date;
    if (details !== undefined) updates.details = details.trim();
    if (pin) updates.pin = String(pin).trim();
    if (allowDownloads !== undefined) updates.allowDownloads = Boolean(allowDownloads);
    if (enableWatermark !== undefined) updates.enableWatermark = Boolean(enableWatermark);
    if (watermarkText !== undefined) updates.watermarkText = watermarkText.trim();
    if (watermarkPosition !== undefined) updates.watermarkPosition = watermarkPosition;
    if (watermarkScale !== undefined) updates.watermarkScale = Number(watermarkScale);
    if (watermarkOpacity !== undefined) updates.watermarkOpacity = Number(watermarkOpacity);

    if (watermarkBase64) {
      const eventUploadDir = path.join(UPLOADS_DIR, id);
      if (!fs.existsSync(eventUploadDir)) {
        fs.mkdirSync(eventUploadDir, { recursive: true });
      }
      const base64Data = watermarkBase64.replace(/^data:image\/\w+;base64,/, '');
      const wmBuffer = Buffer.from(base64Data, 'base64');
      const wmPath = path.join(eventUploadDir, 'watermark.png');
      fs.writeFileSync(wmPath, wmBuffer);
      updates.watermarkFilename = 'watermark.png';
      updates.watermarkUrl = `/uploads/${id}/watermark.png`;
    }

    const updated = EventDAO.update(id, updates);
    return res.json({ message: 'Event updated successfully', event: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update event.' });
  }
}

/**
 * ADMIN: Upload or update event transparent PNG watermark
 * POST /api/admin/events/:id/watermark
 */
export async function uploadEventWatermark(req, res) {
  try {
    const { id } = req.params;
    const event = EventDAO.getById(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const eventUploadDir = path.join(UPLOADS_DIR, id);
    if (!fs.existsSync(eventUploadDir)) {
      fs.mkdirSync(eventUploadDir, { recursive: true });
    }

    const updates = {};
    if (req.body.enableWatermark !== undefined) {
      updates.enableWatermark = req.body.enableWatermark === 'true' || req.body.enableWatermark === true;
    }
    if (req.body.watermarkPosition) updates.watermarkPosition = req.body.watermarkPosition;
    if (req.body.watermarkScale) updates.watermarkScale = Number(req.body.watermarkScale);
    if (req.body.watermarkOpacity) updates.watermarkOpacity = Number(req.body.watermarkOpacity);
    if (req.body.watermarkText) updates.watermarkText = req.body.watermarkText.trim();

    if (req.file && req.file.buffer) {
      const wmPath = path.join(eventUploadDir, 'watermark.png');
      fs.writeFileSync(wmPath, req.file.buffer);
      updates.watermarkFilename = 'watermark.png';
      updates.watermarkUrl = `/uploads/${id}/watermark.png`;
    } else if (req.body.watermarkBase64) {
      const base64Data = req.body.watermarkBase64.replace(/^data:image\/\w+;base64,/, '');
      const wmPath = path.join(eventUploadDir, 'watermark.png');
      fs.writeFileSync(wmPath, Buffer.from(base64Data, 'base64'));
      updates.watermarkFilename = 'watermark.png';
      updates.watermarkUrl = `/uploads/${id}/watermark.png`;
    }

    const updated = EventDAO.update(id, updates);
    return res.json({
      message: 'Event watermark updated successfully',
      event: updated
    });
  } catch (error) {
    console.error('Error uploading watermark:', error);
    return res.status(500).json({ error: 'Failed to upload watermark.' });
  }
}

/**
 * ADMIN: Re-apply watermark to all existing photos in this event
 * POST /api/admin/events/:id/reapply-watermark
 */
export async function reapplyEventWatermark(req, res) {
  try {
    const { id } = req.params;
    const event = EventDAO.getById(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const result = await reapplyWatermarkToEvent(event);

    return res.json({
      message: `Successfully reapplied watermark to ${result.updated} of ${result.total} photos.`,
      result
    });
  } catch (error) {
    console.error('Error reapplying watermark:', error);
    return res.status(500).json({ error: 'Failed to reapply watermark to event photos.' });
  }
}


/**
 * ADMIN: Toggle Download Permission
 */
export async function toggleDownloads(req, res) {
  try {
    const { id } = req.params;
    const { allowDownloads } = req.body;

    const updated = EventDAO.update(id, { allowDownloads: Boolean(allowDownloads) });
    if (!updated) return res.status(404).json({ error: 'Event not found.' });

    return res.json({
      message: `Downloads ${updated.allowDownloads ? 'allowed' : 'disabled'}`,
      allowDownloads: updated.allowDownloads
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to toggle downloads.' });
  }
}

/**
 * ADMIN: Delete Event
 */
export async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const success = EventDAO.delete(id);
    if (!success) return res.status(404).json({ error: 'Event not found.' });

    return res.json({ message: 'Event and associated media deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete event.' });
  }
}

/**
 * CLIENT: Get event public info for landing gate
 */
export async function getClientEvent(req, res) {
  try {
    const { slug } = req.params;
    const event = EventDAO.getBySlug(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found or has expired.' });
    }

    const photoCount = PhotoDAO.getByEvent(event.id).length;

    // Return safe public fields only
    return res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      details: event.details,
      publicSlug: event.publicSlug,
      allowDownloads: event.allowDownloads,
      photoCount,
      branding: {
        brandName: CONFIG.brandName,
        bookingPhone: CONFIG.bookingPhone,
        whatsappPhone: CONFIG.whatsappPhone,
        instagramHandle: CONFIG.instagramHandle,
        instagramUrl: CONFIG.instagramUrl
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load event data.' });
  }
}

/**
 * CLIENT: Validate PIN and return all photos if valid
 */
export async function verifyClientPin(req, res) {
  try {
    const { slug } = req.params;
    const { pin } = req.body;

    const event = EventDAO.getBySlug(slug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    if (String(event.pin).trim() !== String(pin).trim()) {
      return res.status(401).json({ error: 'Incorrect Event PIN. Please check and try again.' });
    }

    // Return all event photos
    const photos = PhotoDAO.getByEvent(event.id);

    return res.json({
      success: true,
      accessType: 'ALL_PHOTOS',
      eventName: event.name,
      allowDownloads: event.allowDownloads,
      photos: photos.map(p => ({
        id: p.id,
        url: p.url,
        thumbnailUrl: p.thumbnailUrl || p.url,
        originalName: p.originalName
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'PIN verification failed.' });
  }
}
