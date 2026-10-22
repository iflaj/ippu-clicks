import express from 'express';
import { loginAdmin, getAdminProfile, downloadDatabaseBackup } from '../controllers/authController.js';
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  uploadEventWatermark,
  reapplyEventWatermark,
  toggleDownloads,
  deleteEvent
} from '../controllers/eventController.js';
import {
  uploadEventPhotos,
  deletePhoto
} from '../controllers/mediaController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';
import { handleBulkImagesUpload, handleSingleWatermarkUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public auth endpoint
router.post('/login', loginAdmin);

// Protected Admin Endpoints
router.use(requireAdminAuth);

router.get('/me', getAdminProfile);
router.get('/database/backup', downloadDatabaseBackup);
router.get('/events', getAllEvents);
router.post('/events', createEvent);
router.get('/events/:id', getEventById);
router.put('/events/:id', updateEvent);
router.post('/events/:id/watermark', handleSingleWatermarkUpload, uploadEventWatermark);
router.post('/events/:id/reapply-watermark', reapplyEventWatermark);
router.patch('/events/:id/toggle-downloads', toggleDownloads);
router.delete('/events/:id', deleteEvent);

// Media Endpoints
router.post('/events/:eventId/photos', handleBulkImagesUpload, uploadEventPhotos);
router.delete('/photos/:photoId', deletePhoto);


export default router;
