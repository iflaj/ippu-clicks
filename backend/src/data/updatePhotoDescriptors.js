import path from 'path';
import { PhotoDAO, EventDAO, initDatabase } from './db.js';
import { extractAiDescriptors } from '../services/faceService.js';
import { UPLOADS_DIR } from '../config/index.js';

async function updateDescriptors() {
  console.log('🔄 Updating descriptors for existing photos in MySQL with 128-D FaceNet...');
  await initDatabase();

  const events = await EventDAO.getAll();
  let updatedCount = 0;

  for (const event of events) {
    const photos = await PhotoDAO.getByEvent(event.id, true);
    for (const photo of photos) {
      const photoPath = path.join(UPLOADS_DIR, photo.eventId, photo.filename);
      const descs = await extractAiDescriptors(photoPath);
      await PhotoDAO.updateDescriptors(photo.id, descs || []);
      updatedCount++;
    }
  }

  console.log(`✅ Updated FaceNet descriptors for ${updatedCount} photos in MySQL!`);
  process.exit(0);
}

updateDescriptors().catch(err => {
  console.error('Update error:', err);
  process.exit(1);
});
