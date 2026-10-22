import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { generateBrandedQR } from '../services/qrService.js';
import { DATA_DIR, UPLOADS_DIR, CONFIG } from '../config/index.js';

async function seed() {
  console.log('Seeding initial data...');
  const dbFile = path.join(DATA_DIR, 'database.json');

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('admin123', salt);

  const sampleSlug = 'sample-event';
  const clientUrl = `${CONFIG.clientBaseUrl}/event/${sampleSlug}`;
  const { dataUrl: qrCodeDataUrl } = await generateBrandedQR(clientUrl);

  const eventId = 'evt_sample_01';
  const sampleEvent = {
    id: eventId,
    name: 'Ippu Clicks Royal Gala Night',
    date: '2026-10-15',
    details: 'Grand Ballroom, Safari Park Hotel • Nairobi',
    pin: '882194',
    publicSlug: sampleSlug,
    clientEventUrl: clientUrl,
    allowDownloads: true,
    qrCodeDataUrl,
    photoCount: 4,
    createdAt: new Date().toISOString()
  };

  // Create sample event uploads folder and placeholder photos
  const eventUploadDir = path.join(UPLOADS_DIR, eventId);
  const thumbUploadDir = path.join(eventUploadDir, 'thumbs');
  fs.mkdirSync(thumbUploadDir, { recursive: true });

  // Copy logo as a sample photo if available
  const samplePhotos = [];
  const logoPath = path.resolve(DATA_DIR, '../../assets/logo.jpg');

  for (let i = 1; i <= 6; i++) {
    const photoId = `pho_demo_${i}`;
    const filename = `gala_photo_${i}.jpg`;
    const targetFile = path.join(eventUploadDir, filename);
    const targetThumb = path.join(thumbUploadDir, `thumb_${filename}`);

    if (fs.existsSync(logoPath)) {
      fs.copyFileSync(logoPath, targetFile);
      fs.copyFileSync(logoPath, targetThumb);
    }

    samplePhotos.push({
      id: photoId,
      eventId: eventId,
      filename,
      originalName: `Ippu_Clicks_Gala_Shot_${i}.jpg`,
      size: 245000,
      mimeType: 'image/jpeg',
      url: `/uploads/${eventId}/${filename}`,
      thumbnailUrl: `/uploads/${eventId}/thumbs/thumb_${filename}`,
      faceDescriptors: [
        // Simulated 128D descriptor vector
        Array.from({ length: 128 }, (_, idx) => Math.sin((i + 1) * idx) * 0.15)
      ],
      createdAt: new Date().toISOString()
    });
  }

  const dbData = {
    admins: [
      {
        id: 'admin_primary_01',
        email: 'admin@ippuclicks.com',
        passwordHash,
        role: 'ADMIN',
        createdAt: new Date().toISOString()
      }
    ],
    events: [sampleEvent],
    photos: samplePhotos
  };

  fs.writeFileSync(dbFile, JSON.stringify(dbData, null, 2), 'utf8');
  console.log('✅ Seeding complete!');
  console.log(`Event created: ${sampleEvent.name} (PIN: ${sampleEvent.pin})`);
  console.log(`Public slug: ${sampleSlug}`);
}

seed().catch(console.error);
