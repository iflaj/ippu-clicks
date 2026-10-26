import path from 'path';
import { EventDAO, PhotoDAO } from '../data/db.js';
import { extractAiDescriptors } from '../services/faceService.js';

async function reindex() {
  console.log('🔄 Re-indexing photos with AI FaceNet descriptors...');
  const event = await EventDAO.getBySlug('sample-event');
  const photos = await PhotoDAO.getByEvent(event.id, true);

  for (const photo of photos) {
    const dim = photo.faceDescriptors?.[0]?.length;
    if (dim !== 128) {
      const pPath = path.join(process.cwd(), 'uploads', event.id, photo.filename);
      console.log(`Extracting FaceNet for ${photo.filename}...`);
      const aiDescs = await extractAiDescriptors(pPath);
      console.log(`Found ${aiDescs.length} face(s) for ${photo.filename}`);
      await PhotoDAO.updateDescriptors(photo.id, aiDescs);
    }
  }

  console.log('✅ Re-indexing completed successfully!');
  process.exit(0);
}

reindex().catch((err) => {
  console.error(err);
  process.exit(1);
});
