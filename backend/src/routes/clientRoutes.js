import express from 'express';
import { getClientEvent, verifyClientPin } from '../controllers/eventController.js';
import { matchClientFace, downloadPhotosZip, downloadSinglePhoto } from '../controllers/mediaController.js';
import { handleSingleSelfieUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public client endpoints accessed by guests
router.get('/events/:slug', getClientEvent);
router.post('/events/:slug/verify-pin', verifyClientPin);
router.post('/events/:slug/match-face', handleSingleSelfieUpload, matchClientFace);
router.get('/events/:slug/photos/:photoId/download', downloadSinglePhoto);
router.post('/events/:slug/download-zip', downloadPhotosZip);

export default router;
