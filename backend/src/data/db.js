import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { DATA_DIR } from '../config/index.js';

const DB_FILE = path.join(DATA_DIR, 'database.json');

// Initial schema template
const DEFAULT_DATA = {
  admins: [],
  events: [],
  photos: []
};

// Initialize DB file
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const salt = bcrypt.genSaltSync(10);
    const defaultAdminPassword = bcrypt.hashSync('admin123', salt);
    const initial = {
      admins: [
        {
          id: 'admin_primary_01',
          email: 'admin@ippuclicks.com',
          passwordHash: defaultAdminPassword,
          role: 'ADMIN',
          createdAt: new Date().toISOString()
        }
      ],
      events: [],
      photos: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

export function readDb() {
  ensureDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading DB, re-initializing:', err);
    return DEFAULT_DATA;
  }
}

export function writeDb(data) {
  ensureDb();
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

// ----------------- Events DAO -----------------
export const EventDAO = {
  getAll() {
    return readDb().events;
  },
  getById(id) {
    return readDb().events.find(e => e.id === id);
  },
  getBySlug(slug) {
    return readDb().events.find(e => e.publicSlug === slug);
  },
  getByPin(pin) {
    return readDb().events.find(e => e.pin === String(pin).trim());
  },
  create(eventData) {
    const db = readDb();
    db.events.unshift(eventData);
    writeDb(db);
    return eventData;
  },
  update(id, updates) {
    const db = readDb();
    const index = db.events.findIndex(e => e.id === id);
    if (index === -1) return null;
    db.events[index] = { ...db.events[index], ...updates, updatedAt: new Date().toISOString() };
    writeDb(db);
    return db.events[index];
  },
  delete(id) {
    const db = readDb();
    const beforeCount = db.events.length;
    db.events = db.events.filter(e => e.id !== id);
    db.photos = db.photos.filter(p => p.eventId !== id);
    writeDb(db);
    return db.events.length < beforeCount;
  }
};

// ----------------- Photos DAO -----------------
export const PhotoDAO = {
  getByEvent(eventId) {
    return readDb().photos.filter(p => p.eventId === eventId);
  },
  getById(id) {
    return readDb().photos.find(p => p.id === id);
  },
  getByIds(ids) {
    const idSet = new Set(ids);
    return readDb().photos.filter(p => idSet.has(p.id));
  },
  createMany(photoRecords) {
    const db = readDb();
    db.photos.push(...photoRecords);
    writeDb(db);
    return photoRecords;
  },
  delete(id) {
    const db = readDb();
    const photo = db.photos.find(p => p.id === id);
    if (!photo) return null;
    db.photos = db.photos.filter(p => p.id !== id);
    writeDb(db);
    return photo;
  }
};

// ----------------- Admins DAO -----------------
export const AdminDAO = {
  findByEmail(email) {
    return readDb().admins.find(a => a.email.toLowerCase() === email.toLowerCase());
  },
  findById(id) {
    return readDb().admins.find(a => a.id === id);
  }
};
