import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { generateBrandedQR } from '../services/qrService.js';
import { DATA_DIR, UPLOADS_DIR, CONFIG } from '../config/index.js';
import { initDatabase, EventDAO, PhotoDAO, AdminDAO, closePool } from './db.js';

async function seed() {
  console.log('Seeding initial data directly to MySQL...');

  // Ensure database tables are created
  await initDatabase();

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('admin123', salt);

  // 1. Seed primary admin if not already present
  const adminEmail = 'admin@ippuclicks.com';
  const existingAdmin = await AdminDAO.findByEmail(adminEmail);
  if (!existingAdmin) {
    await AdminDAO.create({
      id: 'admin_primary_01',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN'
    });
    console.log(` Admin created: ${adminEmail}`);
  } else {
    console.log(` Admin already exists: ${adminEmail}`);
  }

  // 2. Prepare sample event
  const sampleSlug = 'sample-event';
  const clientUrl = `${CONFIG.clientBaseUrl}/event/${sampleSlug}`;
  const { dataUrl: qrCodeDataUrl } = await generateBrandedQR(clientUrl);

  const eventId = 'evt_sample_01';
  const existingEvent = await EventDAO.findById(eventId);

  if (!existingEvent) {
    await EventDAO.create({
      id: eventId,
      name: 'Ippu Clicks Royal Gala Night',
      date: '2026-10-15',
      details: 'Grand Ballroom, Safari Park Hotel • Nairobi',
      pin: '882194',
      publicSlug: sampleSlug,
      clientEventUrl: clientUrl,
      allowDownloads: true,
      qrCodeDataUrl,
      photoCount: 6,
      createdAt: new Date().toISOString()
    });
    console.log(` Sample event created: Ippu Clicks Royal Gala Night`);
  } else {
    console.log(` Sample event already exists: ${existingEvent.name}`);
  }

  // 3. Create sample event uploads folder and placeholder photos
  const eventUploadDir = path.join(UPLOADS_DIR, eventId);
  const thumbUploadDir = path.join(eventUploadDir, 'thumbs');
  fs.mkdirSync(thumbUploadDir, { recursive: true });

  const logoPath = path.resolve(DATA_DIR, '../../assets/logo.jpg');

  for (let i = 1; i <= 6; i++) {
    const photoId = `pho_demo_${i}`;
    const filename = `gala_photo_${i}.jpg`;
    const targetFile = path.join(eventUploadDir, filename);
    const targetThumb = path.join(thumbUploadDir, `thumb_${filename}`);

    if (fs.existsSync(logoPath) && !fs.existsSync(targetFile)) {
      fs.copyFileSync(logoPath, targetFile);
      fs.copyFileSync(logoPath, targetThumb);
    }

    const existingPhoto = await PhotoDAO.findById(photoId);
    if (!existingPhoto) {
      await PhotoDAO.create({
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
      console.log(` Photo seeded: ${photoId}`);
    }
  }

  console.log('✅ Seeding to MySQL complete!');
  console.log(`Event: Ippu Clicks Royal Gala Night (PIN: 882194)`);
  console.log(`Public slug: ${sampleSlug}`);

  await closePool();
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
