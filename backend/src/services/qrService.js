import QRCode from 'qrcode';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { ASSETS_DIR } from '../config/index.js';

/**
 * Generates a high-resolution QR code with the Ippu Clicks brand logo embedded in the center.
 * @param {string} url - Target URL to encode into the QR code
 * @param {string} [customLogoPath] - Optional custom logo path
 * @returns {Promise<{ buffer: Buffer, dataUrl: string }>}
 */
export async function generateBrandedQR(url, customLogoPath) {
  const qrDimension = 1200; // Crisp 1200x1200px for print and digital display
  const logoDimension = Math.floor(qrDimension * 0.24); // ~24% center coverage
  const padDimension = logoDimension + 32;

  // 1. Generate base QR code with High Error Correction ('H') to withstand logo overlay
  const qrBaseBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 3,
    width: qrDimension,
    color: {
      dark: '#111111',
      light: '#ffffff'
    }
  });

  // 2. Select logo source
  const defaultLogo = path.join(ASSETS_DIR, 'logo.jpg');
  const logoFile = (customLogoPath && fs.existsSync(customLogoPath))
    ? customLogoPath
    : defaultLogo;

  if (!fs.existsSync(logoFile)) {
    // If no logo file exists, return the clean high-ECL QR code
    return {
      buffer: qrBaseBuffer,
      dataUrl: `data:image/png;base64,${qrBaseBuffer.toString('base64')}`
    };
  }

  // 3. Create a white rounded-rectangle shield behind the logo to prevent scan interference
  const shieldSvg = Buffer.from(`
    <svg width="${padDimension}" height="${padDimension}">
      <rect x="0" y="0" width="${padDimension}" height="${padDimension}" rx="${Math.floor(padDimension * 0.2)}" fill="#ffffff" stroke="#e5e5e5" stroke-width="2" />
    </svg>
  `);

  // 4. Resize and round the logo
  const resizedLogoBuffer = await sharp(logoFile)
    .resize(logoDimension, logoDimension, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toBuffer();

  const logoBadgeBuffer = await sharp(shieldSvg)
    .composite([{ input: resizedLogoBuffer, gravity: 'center' }])
    .png()
    .toBuffer();

  // 5. Composite logo badge directly onto the center of the QR code
  const compositedQrBuffer = await sharp(qrBaseBuffer)
    .composite([{ input: logoBadgeBuffer, gravity: 'center' }])
    .png()
    .toBuffer();

  return {
    buffer: compositedQrBuffer,
    dataUrl: `data:image/png;base64,${compositedQrBuffer.toString('base64')}`
  };
}
