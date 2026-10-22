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
