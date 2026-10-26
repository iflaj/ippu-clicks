import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { DB_CONFIG, DATA_DIR } from '../config/index.js';

const DB_FILE = path.join(DATA_DIR, 'database.json');

async function migrate() {
  console.log('===============================================================');
  console.log('🚀 IPPU CLICKS: JSON TO MYSQL MIGRATION SCRIPT');
  console.log('===============================================================');
  console.log(`Connecting to MySQL on ${DB_CONFIG.host}:${DB_CONFIG.port} (Database: ${DB_CONFIG.database})...`);

  if (!fs.existsSync(DB_FILE)) {
    console.error(`❌ Source database file not found at: ${DB_FILE}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(DB_FILE, 'utf8');
  const data = JSON.parse(rawJson);

  // 1. Connect without database to ensure DB exists
  const conn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.changeUser({ database: DB_CONFIG.database });

  // 2. Create tables
  console.log('📦 Creating database tables (admins, events, photos)...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`admins\` (
      \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
      \`email\` VARCHAR(191) NOT NULL UNIQUE,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`role\` VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
      \`created_at\` VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`events\` (
      \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`date\` VARCHAR(64) NOT NULL,
      \`details\` TEXT NULL,
      \`pin\` VARCHAR(32) NOT NULL,
      \`public_slug\` VARCHAR(191) NOT NULL UNIQUE,
      \`client_event_url\` TEXT NULL,
      \`allow_downloads\` TINYINT(1) NOT NULL DEFAULT 1,
      \`enable_watermark\` TINYINT(1) NOT NULL DEFAULT 1,
      \`watermark_url\` VARCHAR(500) NULL,
      \`watermark_filename\` VARCHAR(255) NULL,
      \`watermark_position\` VARCHAR(32) NOT NULL DEFAULT 'bottom-right',
      \`watermark_scale\` INT NOT NULL DEFAULT 22,
      \`watermark_opacity\` INT NOT NULL DEFAULT 90,
      \`watermark_text\` VARCHAR(255) NULL,
      \`qr_code_data_url\` MEDIUMTEXT NULL,
      \`photo_count\` INT NOT NULL DEFAULT 0,
      \`created_at\` VARCHAR(64) NOT NULL,
      \`updated_at\` VARCHAR(64) NULL,
      INDEX \`idx_events_slug\` (\`public_slug\`),
      INDEX \`idx_events_pin\` (\`pin\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`photos\` (
      \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
      \`event_id\` VARCHAR(64) NOT NULL,
      \`filename\` VARCHAR(255) NOT NULL,
      \`original_name\` VARCHAR(255) NOT NULL,
      \`size\` BIGINT NOT NULL DEFAULT 0,
      \`mime_type\` VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
      \`url\` VARCHAR(500) NOT NULL,
      \`thumbnail_url\` VARCHAR(500) NOT NULL,
      \`face_descriptors\` LONGTEXT NULL,
      \`created_at\` VARCHAR(64) NOT NULL,
      INDEX \`idx_photos_event_id\` (\`event_id\`),
      CONSTRAINT \`fk_photos_event\`
        FOREIGN KEY (\`event_id\`) REFERENCES \`events\` (\`id\`)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Migrate Admins
  let adminCount = 0;
  if (data.admins && data.admins.length > 0) {
    for (const a of data.admins) {
      await conn.query(
        'INSERT INTO admins (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
        [a.id, a.email, a.passwordHash, a.role || 'ADMIN', a.createdAt || new Date().toISOString()]
      );
      adminCount++;
    }
  }

  // 4. Migrate Events
  let eventCount = 0;
  if (data.events && data.events.length > 0) {
    for (const e of data.events) {
      await conn.query(
        `INSERT INTO events (
          id, name, date, details, pin, public_slug, client_event_url,
          allow_downloads, enable_watermark, watermark_url, watermark_filename,
          watermark_position, watermark_scale, watermark_opacity, watermark_text,
          qr_code_data_url, photo_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), date = VALUES(date), details = VALUES(details), pin = VALUES(pin),
          allow_downloads = VALUES(allow_downloads), enable_watermark = VALUES(enable_watermark),
          watermark_url = VALUES(watermark_url), watermark_filename = VALUES(watermark_filename),
          watermark_position = VALUES(watermark_position), watermark_scale = VALUES(watermark_scale),
          watermark_opacity = VALUES(watermark_opacity), watermark_text = VALUES(watermark_text),
          qr_code_data_url = VALUES(qr_code_data_url)`,
        [
          e.id, e.name, e.date, e.details || '', e.pin, e.publicSlug, e.clientEventUrl,
          e.allowDownloads ? 1 : 0, e.enableWatermark ? 1 : 0, e.watermarkUrl || null, e.watermarkFilename || null,
          e.watermarkPosition || 'bottom-right', e.watermarkScale || 22, e.watermarkOpacity || 90, e.watermarkText || null,
          e.qrCodeDataUrl || null, e.photoCount || 0, e.createdAt || new Date().toISOString(), e.updatedAt || null
        ]
      );
      eventCount++;
    }
  }

  // 5. Migrate Photos
  let photoCount = 0;
  if (data.photos && data.photos.length > 0) {
    for (const p of data.photos) {
      const descStr = p.faceDescriptors ? JSON.stringify(p.faceDescriptors) : null;
      await conn.query(
        `INSERT INTO photos (
          id, event_id, filename, original_name, size, mime_type, url, thumbnail_url, face_descriptors, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          filename = VALUES(filename), original_name = VALUES(original_name),
          url = VALUES(url), thumbnail_url = VALUES(thumbnail_url), face_descriptors = VALUES(face_descriptors)`,
        [
          p.id, p.eventId, p.filename, p.originalName, p.size || 0,
          p.mimeType || 'image/jpeg', p.url, p.thumbnailUrl || p.url, descStr, p.createdAt || new Date().toISOString()
        ]
      );
      photoCount++;
    }
  }

  await conn.end();

  console.log('---------------------------------------------------------------');
  console.log(`✅ SUCCESS: Migrated to MySQL:`);
  console.log(`   - ${adminCount} Admins`);
  console.log(`   - ${eventCount} Events`);
  console.log(`   - ${photoCount} Photos with facial descriptor vectors`);
  console.log('===============================================================');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
