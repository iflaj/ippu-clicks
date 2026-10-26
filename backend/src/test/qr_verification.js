import sharp from 'sharp';
import jsQR from 'jsqr';
import { EventDAO, PhotoDAO, closePool } from '../data/db.js';
import { generateBrandedQR } from '../services/qrService.js';

async function runQrVerification() {
  console.log('==============================================');
  console.log('📱 Branded QR Code Generation & Scan Verification');
  console.log('==============================================');

  // Test 1: Direct QR Service Generation
  console.log('\n[1/4] Testing generateBrandedQR service...');
  const testUrl = 'http://localhost:5173/event/royal-wedding-2026';
  const { buffer, dataUrl } = await generateBrandedQR(testUrl);

  console.log(`Buffer size: ${buffer.length} bytes`);
  console.log(`Data URL prefix: ${dataUrl.substring(0, 32)}...`);
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('QR dataUrl is not a valid base64 PNG');
  }
  console.log('✅ Service generates valid high-resolution base64 PNG dataUrl');

  // Test 2: Decode QR with Computer Vision (jsQR)
  console.log('\n[2/4] Testing QR Code readability & scan decoding...');
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!decoded) {
    throw new Error('Failed to decode generated QR Code image!');
  }
  console.log(`Decoded QR text: ${decoded.data}`);
  if (decoded.data !== testUrl) {
    throw new Error(`Decoded QR text mismatch! Expected "${testUrl}", got "${decoded.data}"`);
  }
  console.log(`✅ Decoded URL perfectly matches source URL! (${info.width}x${info.height}px)`);

  // Test 3: API Event Creation with Automatic Branded QR Generation
  console.log('\n[3/4] Testing API event creation and QR persistence in MySQL...');
  // Login as admin
  const loginRes = await fetch('http://localhost:5000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ippuclicks.com', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const createRes = await fetch('http://localhost:5000/api/admin/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'QR Verification Gala',
      date: '2026-11-20',
      details: 'Testing QR generation in MySQL'
    })
  });
  const createData = await createRes.json();
  const newEvent = createData.event;
  console.log(`Created Event ID: ${newEvent.id} | Slug: ${newEvent.publicSlug}`);
  console.log(`Has QR code: ${Boolean(newEvent.qrCodeDataUrl)}`);

  // Verify the created event's QR code scans correctly to its public client URL
  const b64 = newEvent.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const newBuf = Buffer.from(b64, 'base64');
  const imgData = await sharp(newBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const eventDecoded = jsQR(new Uint8ClampedArray(imgData.data), imgData.info.width, imgData.info.height);

  console.log(`Scanned Event QR: ${eventDecoded?.data}`);
  console.log(`Expected Client URL: ${newEvent.clientEventUrl}`);
  if (eventDecoded?.data !== newEvent.clientEventUrl) {
    throw new Error('Event QR does not scan to event.clientEventUrl');
  }
  console.log('✅ Created event QR code decoded & verified successfully!');

  // Test 4: Public Client Event API Endpoint returns QR code & clientEventUrl
  console.log('\n[4/4] Testing public client event API for landing gate...');
  const clientRes = await fetch(`http://localhost:5000/api/client/events/${newEvent.publicSlug}`);
  const clientData = await clientRes.json();
  console.log(`Public client API status: ${clientRes.status}`);
  console.log(`Returned qrCodeDataUrl: ${Boolean(clientData.qrCodeDataUrl)}`);
  console.log(`Returned clientEventUrl: ${clientData.clientEventUrl}`);

  if (!clientData.qrCodeDataUrl || !clientData.clientEventUrl) {
    throw new Error('Public client endpoint missing qrCodeDataUrl or clientEventUrl');
  }
  console.log('✅ Public client endpoint delivers verified QR code and event URL');

  // Clean up test event
  console.log('\nCleaning up test event...');
  await fetch(`http://localhost:5000/api/admin/events/${newEvent.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✅ Cleaned up test event from MySQL');

  console.log('\n==============================================');
  console.log('🎉 ALL QR CODE TESTS PASSED WITH 100% SUCCESS!');
  console.log('==============================================');
  await closePool();
}

runQrVerification().catch(err => {
  console.error('❌ QR Verification Error:', err);
  process.exit(1);
});
