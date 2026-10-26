import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function runFaceTests() {
  console.log('==============================================');
  console.log('🤖 AI Face Detection & Recognition Test Suite');
  console.log('==============================================');

  // Test 1: Empty descriptor
  console.log('\n[1/3] Testing empty descriptor rejection...');
  const res1 = await fetch('http://localhost:5000/api/client/events/sample-event/match-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptor: [] })
  });
  const data1 = await res1.json();
  console.log('Status:', res1.status, '| Response:', JSON.stringify(data1));
  if (res1.status === 400 && data1.error?.includes('No face was detected')) {
    console.log('✅ Empty descriptor rejected cleanly with HTTP 400');
  } else {
    console.error('❌ Failed empty descriptor test');
  }

  // Test 2: Blank / Solid color non-face image
  console.log('\n[2/3] Testing non-face / blank image rejection...');
  const blankBuf = await sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 120, g: 120, b: 120 } }
  }).jpeg().toBuffer();

  const boundary = '----WebKitFormBoundaryXYZ' + Date.now();
  const body2 = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="selfie"; filename="blank.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    blankBuf,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res2 = await fetch('http://localhost:5000/api/client/events/sample-event/match-face', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body2
  });
  const data2 = await res2.json();
  console.log('Status:', res2.status, '| Response:', JSON.stringify(data2));
  if (res2.status === 400 && data2.error?.includes('No face was detected')) {
    console.log('✅ Non-face image rejected cleanly with HTTP 400');
  } else {
    console.error('❌ Failed non-face image rejection test');
  }

  // Test 3: Real photo containing face
  console.log('\n[3/3] Testing real face recognition matching...');
  const { PhotoDAO, EventDAO, closePool } = await import('../data/db.js');
  const event = await EventDAO.getBySlug('sample-event');
  const photos = await PhotoDAO.getByEvent(event.id, false);
  const samplePhoto = photos[0];

  if (!samplePhoto) {
    console.error('❌ No sample photos found in event');
    return;
  }

  console.log(`Using sample event photo: ${samplePhoto.filename}`);
  const photoPath = path.join(process.cwd(), 'uploads', event.id, samplePhoto.filename);
  if (!fs.existsSync(photoPath)) {
    console.error('❌ Photo file not found on disk:', photoPath);
    return;
  }

  const photoBuf = fs.readFileSync(photoPath);
  const b3 = '----WebKitFormBoundaryABC' + Date.now();
  const body3 = Buffer.concat([
    Buffer.from(`--${b3}\r\nContent-Disposition: form-data; name="selfie"; filename="${samplePhoto.filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    photoBuf,
    Buffer.from(`\r\n--${b3}\r\nContent-Disposition: form-data; name="minConfidence"\r\n\r\n55\r\n--${b3}--\r\n`)
  ]);

  const res3 = await fetch('http://localhost:5000/api/client/events/sample-event/match-face', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${b3}` },
    body: body3
  });
  const data3 = await res3.json();
  console.log('Status:', res3.status, '| Matched count:', data3.matchedCount);
  if (data3.matchedPhotos && data3.matchedPhotos.length > 0) {
    console.log('✅ Found matches with confidence:');
    data3.matchedPhotos.forEach(p => {
      console.log(`   - Photo ID: ${p.id} | Match Confidence: ${p.matchConfidence}%`);
    });
  } else {
    console.error('❌ No matches found for real face image');
  }

  console.log('\n==============================================');
  console.log('🎉 AI Face Detection Test Completed');
  console.log('==============================================');
  await closePool();
}

runFaceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
