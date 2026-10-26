import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '../../');
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(ROOT_DIR, 'uploads');
export const ASSETS_DIR = path.resolve(ROOT_DIR, 'assets');
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(ROOT_DIR, 'src/data');

export const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ippu_clicks',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 5000
};

export const CONFIG = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'ippu-clicks-super-secret-jwt-key-2026',
  jwtExpiresIn: '7d',
  clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:5173',
  adminSecretPath: process.env.ADMIN_SECRET_PATH || 'secure-admin-portal',
  instagramHandle: process.env.INSTAGRAM_HANDLE || 'ippu_clicks',
  instagramUrl: process.env.INSTAGRAM_URL || 'https://instagram.com/ippu_clicks',
  bookingPhone: '0722136082',
  whatsappPhone: '0759125207',
  brandName: "Ippu Clicks Photography"
};

