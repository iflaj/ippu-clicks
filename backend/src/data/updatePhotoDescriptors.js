import path from 'path';
import { readDb, writeDb } from './db.js';
import { extractFeatureDescriptors } from '../services/faceService.js';
import { UPLOADS_DIR } from '../config/index.js';

async function updateDescriptors() {
  console.log('Updating descriptors for existing photos with multi-crop/profile descriptors...');
  const db = readDb();

  let updatedCount = 0;
  for (const photo of db.photos) {
    const photoPath = path.join(UPLOADS_DIR, photo.eventId, photo.filename);
    const descs = await extractFeatureDescriptors(photoPath);
    if (descs && descs.length > 0) {
      photo.faceDescriptors = descs;
      updatedCount++;
    }
  }

  writeDb(db);
  console.log(`Updated real multi-crop descriptors for ${updatedCount} of ${db.photos.length} photos!`);
}

updateDescriptors().catch(console.error);
