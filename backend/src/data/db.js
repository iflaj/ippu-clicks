import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { DB_CONFIG } from '../config/index.js';

// Dedicated MySQL Engine
const activeEngine = 'mysql';
let pool = null;
let initPromise = null;

// Mapping helpers: MySQL snake_case <-> JavaScript camelCase
function mapEventFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    details: row.details || '',
    pin: String(row.pin || '').trim(),
    publicSlug: row.public_slug,
    clientEventUrl: row.client_event_url,
    allowDownloads: Boolean(row.allow_downloads),
    enableWatermark: Boolean(row.enable_watermark),
    watermarkUrl: row.watermark_url,
    watermarkFilename: row.watermark_filename,
    watermarkPosition: row.watermark_position || 'bottom-right',
    watermarkScale: Number(row.watermark_scale || 22),
    watermarkOpacity: Number(row.watermark_opacity || 90),
    watermarkText: row.watermark_text || '© Ippu Clicks Photography • 0759125207',
    watermarkType: row.watermark_type || (row.watermark_url ? 'png' : 'badge'),
    qrCodeDataUrl: row.qr_code_data_url,
    photoCount: Number(row.photo_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPhotoFromDb(row, parseDescriptors = false) {
  if (!row) return null;
  let descs = [];
  if (parseDescriptors && row.face_descriptors) {
    try {
      descs = typeof row.face_descriptors === 'string'
        ? JSON.parse(row.face_descriptors)
        : row.face_descriptors;
    } catch (e) {
      descs = [];
    }
  }

  return {
    id: row.id,
    eventId: row.event_id,
    filename: row.filename,
    originalName: row.original_name,
    size: Number(row.size || 0),
    mimeType: row.mime_type || 'image/jpeg',
    url: row.url,
    thumbnailUrl: row.thumbnail_url || row.url,
    faceDescriptors: descs,
    createdAt: row.created_at
  };
}

function mapAdminFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role || 'ADMIN',
    createdAt: row.created_at
  };
}

// Initialize MySQL Connection & Schema
export async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Connect to MySQL server to ensure database exists
      const serverConn = await mysql.createConnection({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        connectTimeout: DB_CONFIG.connectTimeout
      });

      await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await serverConn.end();

      // 2. Create high-performance connection pool
      pool = mysql.createPool(DB_CONFIG);

      // 3. Create tables if not existing
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`admins\` (
          \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
          \`email\` VARCHAR(191) NOT NULL UNIQUE,
          \`password_hash\` VARCHAR(255) NOT NULL,
          \`role\` VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
          \`created_at\` VARCHAR(64) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
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
          \`watermark_type\` VARCHAR(32) NOT NULL DEFAULT 'badge',
          \`qr_code_data_url\` MEDIUMTEXT NULL,
          \`photo_count\` INT NOT NULL DEFAULT 0,
          \`created_at\` VARCHAR(64) NOT NULL,
          \`updated_at\` VARCHAR(64) NULL,
          INDEX \`idx_events_slug\` (\`public_slug\`),
          INDEX \`idx_events_pin\` (\`pin\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
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

      // 4. Auto-migration: Ensure all required columns exist in existing tables
      try {
        const [eventCols] = await pool.query('SHOW COLUMNS FROM `events`');
        const eventColSet = new Set(eventCols.map(c => c.Field.toLowerCase()));

        if (!eventColSet.has('watermark_type')) {
          console.log("⚡ [Database] Auto-migrating: Adding missing 'watermark_type' column to 'events' table...");
          await pool.query("ALTER TABLE `events` ADD COLUMN `watermark_type` VARCHAR(32) NOT NULL DEFAULT 'badge' AFTER `watermark_text`");
          console.log("✅ [Database] 'watermark_type' column added successfully to 'events' table.");
        }
        if (!eventColSet.has('updated_at')) {
          await pool.query("ALTER TABLE `events` ADD COLUMN `updated_at` VARCHAR(64) NULL AFTER `created_at`");
        }
      } catch (migrateErr) {
        console.warn('⚡ [Database] Event auto-migration check note:', migrateErr.message);
      }

      // Seed default admin if table is empty
      const [adminRows] = await pool.query('SELECT COUNT(*) as count FROM admins');
      if (adminRows[0].count === 0) {
        const defaultHash = await bcrypt.hash('admin123', 10);
        await pool.query(
          'INSERT INTO admins (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
          ['admin_primary_01', 'admin@ippuclicks.com', defaultHash, 'ADMIN', new Date().toISOString()]
        );
      }

      console.log(`⚡ [Database] MySQL Pool Connected successfully -> Database: ${DB_CONFIG.database} on ${DB_CONFIG.host}:${DB_CONFIG.port}`);
      return 'mysql';
    } catch (err) {
      console.error(`❌ [Database] Failed to connect to MySQL: ${err.message}`);
      console.error(`👉 Ensure MySQL daemon is running on ${DB_CONFIG.host}:${DB_CONFIG.port}`);
      throw err;
    }
  })();

  return initPromise;
}

// ----------------- Events DAO -----------------
export const EventDAO = {
  async getAll() {
    await initDatabase();
    const [rows] = await pool.query(`
      SELECT e.*, COUNT(p.id) as photo_count
      FROM events e
      LEFT JOIN photos p ON e.id = p.event_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `);
    return rows.map(mapEventFromDb);
  },

  async getById(id) {
    await initDatabase();
    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
    return rows.length > 0 ? mapEventFromDb(rows[0]) : null;
  },

  async findById(id) {
    return this.getById(id);
  },

  async getBySlug(slug) {
    await initDatabase();
    const [rows] = await pool.query('SELECT * FROM events WHERE public_slug = ?', [slug]);
    return rows.length > 0 ? mapEventFromDb(rows[0]) : null;
  },

  async getByPin(pin) {
    await initDatabase();
    const cleanPin = String(pin).trim();
    const [rows] = await pool.query('SELECT * FROM events WHERE pin = ?', [cleanPin]);
    return rows.length > 0 ? mapEventFromDb(rows[0]) : null;
  },

  async create(eventData) {
    await initDatabase();
    await pool.query(
      `INSERT INTO events (
        id, name, date, details, pin, public_slug, client_event_url,
        allow_downloads, enable_watermark, watermark_url, watermark_filename,
        watermark_position, watermark_scale, watermark_opacity, watermark_text,
        watermark_type, qr_code_data_url, photo_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventData.id, eventData.name, eventData.date, eventData.details || '', eventData.pin,
        eventData.publicSlug, eventData.clientEventUrl, eventData.allowDownloads ? 1 : 0,
        eventData.enableWatermark ? 1 : 0, eventData.watermarkUrl || null, eventData.watermarkFilename || null,
        eventData.watermarkPosition || 'bottom-right', eventData.watermarkScale || 22,
        eventData.watermarkOpacity || 90, eventData.watermarkText || '© Ippu Clicks Photography • 0759125207',
        eventData.watermarkType || (eventData.watermarkUrl ? 'png' : 'badge'),
        eventData.qrCodeDataUrl || null, 0, eventData.createdAt || new Date().toISOString()
      ]
    );
    return eventData;
  },

  async update(id, updates) {
    await initDatabase();
    const current = await this.getById(id);
    if (!current) return null;

    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
    await pool.query(
      `UPDATE events SET
        name = ?, date = ?, details = ?, pin = ?, allow_downloads = ?,
        enable_watermark = ?, watermark_url = ?, watermark_filename = ?,
        watermark_position = ?, watermark_scale = ?, watermark_opacity = ?,
        watermark_text = ?, watermark_type = ?, qr_code_data_url = ?, updated_at = ?
      WHERE id = ?`,
      [
        merged.name, merged.date, merged.details, merged.pin, merged.allowDownloads ? 1 : 0,
        merged.enableWatermark ? 1 : 0, merged.watermarkUrl, merged.watermarkFilename,
        merged.watermarkPosition, merged.watermarkScale, merged.watermarkOpacity,
        merged.watermarkText, merged.watermarkType || (merged.watermarkUrl ? 'png' : 'badge'),
        merged.qrCodeDataUrl, merged.updatedAt, id
      ]
    );
    return merged;
  },

  async delete(id) {
    await initDatabase();
    const [res] = await pool.query('DELETE FROM events WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }
};

// ----------------- Photos DAO -----------------
export const PhotoDAO = {
  /**
   * Retrieves photos for an event.
   * By default, omits heavy face_descriptors to boost query speed.
   */
  async getByEvent(eventId, includeDescriptors = false) {
    await initDatabase();
    const selectFields = includeDescriptors
      ? 'id, event_id, filename, original_name, size, mime_type, url, thumbnail_url, face_descriptors, created_at'
      : 'id, event_id, filename, original_name, size, mime_type, url, thumbnail_url, created_at';

    const [rows] = await pool.query(
      `SELECT ${selectFields} FROM photos WHERE event_id = ? ORDER BY created_at DESC`,
      [eventId]
    );
    return rows.map(r => mapPhotoFromDb(r, includeDescriptors));
  },

  async getById(id) {
    await initDatabase();
    const [rows] = await pool.query('SELECT * FROM photos WHERE id = ?', [id]);
    return rows.length > 0 ? mapPhotoFromDb(rows[0], false) : null;
  },

  async findById(id) {
    return this.getById(id);
  },

  async create(photo) {
    const res = await this.createMany([photo]);
    return res && res.length > 0 ? res[0] : null;
  },

  async getByIds(ids) {
    await initDatabase();
    if (!ids || ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT id, event_id, filename, original_name, size, mime_type, url, thumbnail_url, created_at
       FROM photos WHERE id IN (${placeholders})`,
      ids
    );
    return rows.map(r => mapPhotoFromDb(r, false));
  },

  async createMany(photoRecords) {
    await initDatabase();
    if (!photoRecords || photoRecords.length === 0) return [];

    const values = photoRecords.map(p => [
      p.id,
      p.eventId,
      p.filename,
      p.originalName,
      p.size || 0,
      p.mimeType || 'image/jpeg',
      p.url,
      p.thumbnailUrl || p.url,
      p.faceDescriptors ? JSON.stringify(p.faceDescriptors) : null,
      p.createdAt || new Date().toISOString()
    ]);

    await pool.query(
      `INSERT INTO photos (
        id, event_id, filename, original_name, size, mime_type, url, thumbnail_url, face_descriptors, created_at
      ) VALUES ?`,
      [values]
    );

    // Synchronize photo_count for the event
    if (photoRecords.length > 0 && photoRecords[0].eventId) {
      try {
        await pool.query(
          'UPDATE events SET photo_count = (SELECT COUNT(*) FROM photos WHERE event_id = ?) WHERE id = ?',
          [photoRecords[0].eventId, photoRecords[0].eventId]
        );
      } catch (cntErr) {
        // Non-critical count sync note
      }
    }

    return photoRecords;
  },

  async updateDescriptors(id, descriptors) {
    await initDatabase();
    await pool.query(
      'UPDATE photos SET face_descriptors = ? WHERE id = ?',
      [JSON.stringify(descriptors), id]
    );
    return true;
  },

  async delete(id) {
    await initDatabase();
    const photo = await this.getById(id);
    if (!photo) return null;
    await pool.query('DELETE FROM photos WHERE id = ?', [id]);
    return photo;
  }
};

// ----------------- Admins DAO -----------------
export const AdminDAO = {
  async findByEmail(email) {
    await initDatabase();
    const cleanEmail = email.toLowerCase().trim();
    const [rows] = await pool.query('SELECT * FROM admins WHERE LOWER(email) = ?', [cleanEmail]);
    return rows.length > 0 ? mapAdminFromDb(rows[0]) : null;
  },

  async findById(id) {
    await initDatabase();
    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]);
    return rows.length > 0 ? mapAdminFromDb(rows[0]) : null;
  },

  async create(admin) {
    await initDatabase();
    await pool.query(
      'INSERT INTO admins (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [admin.id, admin.email.toLowerCase().trim(), admin.passwordHash, admin.role || 'ADMIN', admin.createdAt || new Date().toISOString()]
    );
    return admin;
  }
};

// Full database backup export helper
export async function getDatabaseExport() {
  await initDatabase();
  const [admins] = await pool.query('SELECT * FROM admins');
  const [events] = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
  const [photos] = await pool.query('SELECT * FROM photos ORDER BY created_at DESC');

  return {
    engine: 'mysql',
    exportedAt: new Date().toISOString(),
    admins: admins.map(mapAdminFromDb),
    events: events.map(mapEventFromDb),
    photos: photos.map(r => mapPhotoFromDb(r, true))
  };
}

// SQL Dump string generator for phpMyAdmin and MySQL command-line
export function generateSqlDump(db) {
  const lines = [];
  lines.push('-- =========================================================');
  lines.push('-- Ippu Clicks Photography MySQL Database Backup');
  lines.push(`-- Export Date: ${new Date().toISOString()}`);
  lines.push('-- Database Engine: MySQL / MariaDB (InnoDB)');
  lines.push('-- =========================================================\n');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;\n');

  const esc = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'object') {
      const json = JSON.stringify(val);
      return `'${json.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
  };

  // 1. Admins
  if (Array.isArray(db.admins) && db.admins.length > 0) {
    lines.push('-- Dumping data for table `admins`');
    for (const a of db.admins) {
      lines.push(`INSERT INTO \`admins\` (\`id\`, \`email\`, \`password_hash\`, \`role\`, \`created_at\`) VALUES (${esc(a.id)}, ${esc(a.email)}, ${esc(a.passwordHash)}, ${esc(a.role || 'admin')}, ${esc(a.createdAt)}) ON DUPLICATE KEY UPDATE \`email\`=VALUES(\`email\`);`);
    }
    lines.push('');
  }

  // 2. Events
  if (Array.isArray(db.events) && db.events.length > 0) {
    lines.push('-- Dumping data for table `events`');
    for (const e of db.events) {
      lines.push(`INSERT INTO \`events\` (\`id\`, \`name\`, \`date\`, \`details\`, \`pin\`, \`public_slug\`, \`client_event_url\`, \`allow_downloads\`, \`enable_watermark\`, \`watermark_url\`, \`watermark_filename\`, \`watermark_position\`, \`watermark_scale\`, \`watermark_opacity\`, \`watermark_text\`, \`watermark_type\`, \`qr_code_data_url\`, \`photo_count\`, \`created_at\`, \`updated_at\`) VALUES (${esc(e.id)}, ${esc(e.name)}, ${esc(e.date)}, ${esc(e.details)}, ${esc(e.pin)}, ${esc(e.publicSlug)}, ${esc(e.clientEventUrl)}, ${esc(e.allowDownloads)}, ${esc(e.enableWatermark)}, ${esc(e.watermarkUrl)}, ${esc(e.watermarkFilename)}, ${esc(e.watermarkPosition)}, ${esc(e.watermarkScale)}, ${esc(e.watermarkOpacity)}, ${esc(e.watermarkText)}, ${esc(e.watermarkType)}, ${esc(e.qrCodeDataUrl)}, ${esc(e.photoCount)}, ${esc(e.createdAt)}, ${esc(e.updatedAt)}) ON DUPLICATE KEY UPDATE \`name\`=VALUES(\`name\`), \`pin\`=VALUES(\`pin\`);`);
    }
    lines.push('');
  }

  // 3. Photos
  if (Array.isArray(db.photos) && db.photos.length > 0) {
    lines.push('-- Dumping data for table `photos`');
    for (const p of db.photos) {
      lines.push(`INSERT INTO \`photos\` (\`id\`, \`event_id\`, \`filename\`, \`original_name\`, \`size\`, \`mime_type\`, \`url\`, \`thumbnail_url\`, \`face_descriptors\`, \`created_at\`) VALUES (${esc(p.id)}, ${esc(p.eventId)}, ${esc(p.filename)}, ${esc(p.originalName)}, ${esc(p.size)}, ${esc(p.mimeType)}, ${esc(p.url)}, ${esc(p.thumbnailUrl)}, ${esc(p.faceDescriptors)}, ${esc(p.createdAt)}) ON DUPLICATE KEY UPDATE \`filename\`=VALUES(\`filename\`);`);
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;\n');
  return lines.join('\n');
}

// Restore database from exported JSON payload directly into MySQL
export async function restoreDatabase(data) {
  await initDatabase();
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup data payload.');
  }

  const admins = Array.isArray(data.admins) ? data.admins : [];
  const events = Array.isArray(data.events) ? data.events : [];
  const photos = Array.isArray(data.photos) ? data.photos : [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (events.length > 0) {
      for (const evt of events) {
        await conn.query(
          `INSERT INTO events (
            id, name, date, details, pin, public_slug, client_event_url,
            allow_downloads, enable_watermark, watermark_url, watermark_filename,
            watermark_position, watermark_scale, watermark_opacity, watermark_text,
            watermark_type, qr_code_data_url, photo_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), date=VALUES(date), details=VALUES(details), pin=VALUES(pin),
            public_slug=VALUES(public_slug), client_event_url=VALUES(client_event_url),
            allow_downloads=VALUES(allow_downloads), enable_watermark=VALUES(enable_watermark),
            watermark_url=VALUES(watermark_url), watermark_filename=VALUES(watermark_filename),
            watermark_position=VALUES(watermark_position), watermark_scale=VALUES(watermark_scale),
            watermark_opacity=VALUES(watermark_opacity), watermark_text=VALUES(watermark_text),
            watermark_type=VALUES(watermark_type), qr_code_data_url=VALUES(qr_code_data_url),
            photo_count=VALUES(photo_count), updated_at=NOW()`,
          [
            evt.id, evt.name, evt.date, evt.details || '', evt.pin, evt.publicSlug,
            evt.clientEventUrl, evt.allowDownloads ? 1 : 0, evt.enableWatermark ? 1 : 0,
            evt.watermarkUrl || null, evt.watermarkFilename || null,
            evt.watermarkPosition || 'bottom-right', evt.watermarkScale || 22,
            evt.watermarkOpacity || 90, evt.watermarkText || '© Ippu Clicks Photography • 0759125207',
            evt.watermarkType || 'badge', evt.qrCodeDataUrl || null, evt.photoCount || 0,
            evt.createdAt || new Date().toISOString(), evt.updatedAt || null
          ]
        );
      }
    }

    if (photos.length > 0) {
      for (const p of photos) {
        const descStr = p.faceDescriptors ? JSON.stringify(p.faceDescriptors) : null;
        await conn.query(
          `INSERT INTO photos (
            id, event_id, filename, original_name, size, mime_type, url, thumbnail_url, face_descriptors, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            filename=VALUES(filename), original_name=VALUES(original_name),
            size=VALUES(size), mime_type=VALUES(mime_type), url=VALUES(url),
            thumbnail_url=VALUES(thumbnail_url), face_descriptors=VALUES(face_descriptors)`,
          [
            p.id, p.eventId, p.filename, p.originalName, p.size || 0,
            p.mimeType || 'image/jpeg', p.url, p.thumbnailUrl || p.url,
            descStr, p.createdAt || new Date().toISOString()
          ]
        );
      }
    }

    // Sync photo counts
    await conn.query(`
      UPDATE events e
      SET photo_count = (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id)
    `);

    await conn.commit();
    return {
      success: true,
      restoredEvents: events.length,
      restoredPhotos: photos.length,
      restoredAdmins: admins.length
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Export active engine checker
export function getActiveEngine() {
  return activeEngine;
}

// Clean pool shutdown for scripts / tests
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    initPromise = null;
  }
}

// Initial bootstrap trigger
initDatabase().catch(err => {
  console.warn('Initial database bootstrap note:', err.message);
});
