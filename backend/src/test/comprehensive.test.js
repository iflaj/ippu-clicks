import assert from 'assert';

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runComprehensiveTests() {
  console.log('🧪 Starting Full Comprehensive Feature Audit...\n');

  try {
    // 1. Health check
    console.log('1. Checking Health API & MySQL Engine...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(healthRes.status, 200, 'Health check failed');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    assert.strictEqual(healthData.databaseEngine, 'mysql', 'Database engine must be mysql');
    console.log('   ✅ Health check passed. MySQL is active.\n');

    // 2. Admin Login
    console.log('2. Testing Admin Authentication...');
    const loginRes = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ippuclicks.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login failed');
    const loginData = await loginRes.json();
    assert(loginData.token, 'Token missing');
    const token = loginData.token;
    console.log('   ✅ Admin login passed. JWT issued.\n');

    // 3. Admin Profile
    console.log('3. Testing Admin Profile (/api/admin/me)...');
    const meRes = await fetch(`${BASE_URL}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.admin.email, 'admin@ippuclicks.com');
    console.log('   ✅ Admin profile verified.\n');

    // 4. Admin Database Backup
    console.log('4. Testing Database Backup Export (/api/admin/database/backup)...');
    const backupRes = await fetch(`${BASE_URL}/admin/database/backup`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(backupRes.status, 200);
    const backupData = await backupRes.json();
    assert.strictEqual(backupData.engine, 'mysql');
    assert(Array.isArray(backupData.events) && backupData.events.length > 0);
    console.log(`   ✅ Database export verified (${backupData.events.length} events, ${backupData.photos.length} photos).\n`);

    // 5. Client Public Event Details
    console.log('5. Testing Client Public Event Details (sample-event)...');
    const clientEventRes = await fetch(`${BASE_URL}/client/events/sample-event`);
    assert.strictEqual(clientEventRes.status, 200);
    const clientEvent = await clientEventRes.json();
    assert.strictEqual(clientEvent.name, 'Ippu Clicks Royal Gala Night');
    assert.strictEqual(clientEvent.pin, undefined, 'Security guard: PIN must not be exposed');
    assert(clientEvent.branding, 'Branding metadata missing');
    console.log('   ✅ Client public event verified with branding info.\n');

    // 6. Client PIN Verification
    console.log('6. Testing Client PIN Verification...');
    const pinRes = await fetch(`${BASE_URL}/client/events/sample-event/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '882194' })
    });
    assert.strictEqual(pinRes.status, 200);
    const pinData = await pinRes.json();
    assert.strictEqual(pinData.accessType, 'ALL_PHOTOS');
    assert(pinData.photos.length > 0);
    const samplePhoto = pinData.photos[0];
    console.log(`   ✅ PIN verified. Unlocked ${pinData.photos.length} photos.\n`);

    // 7. Verify Cache Header on Uploads
    console.log('7. Testing Revalidation Cache Policy on Uploaded Photos...');
    const photoFetchRes = await fetch(`http://localhost:${PORT}${samplePhoto.thumbnailUrl}`);
    assert.strictEqual(photoFetchRes.status, 200);
    const cacheControl = photoFetchRes.headers.get('cache-control');
    assert(cacheControl && cacheControl.includes('no-cache'), 'Cache-Control must contain no-cache');
    console.log(`   ✅ Cache-Control header verified: "${cacheControl}".\n`);

    // 8. Admin Create Event with Custom Brand Label & Watermark
    console.log('8. Testing Admin Create Event with Custom Brand Label...');
    const testSlug = `audit-test-${Date.now()}`;
    const createEvtRes = await fetch(`${BASE_URL}/admin/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Full Feature Audit Gala',
        date: '2026-12-31',
        details: 'Grand Ballroom Suite',
        allowDownloads: true,
        enableWatermark: true,
        watermarkText: '© Ippu Clicks Photography • Audit Test',
        watermarkPosition: 'bottom-right',
        watermarkScale: 25,
        watermarkOpacity: 90
      })
    });
    assert.strictEqual(createEvtRes.status, 201);
    const newEvt = (await createEvtRes.json()).event;
    console.log(`   ✅ Event created: "${newEvt.name}" (ID: ${newEvt.id}, PIN: ${newEvt.pin}).\n`);

    // 9. Update Watermark & Brand Label on Created Event
    console.log('9. Testing Event Watermark & Brand Label Update...');
    const updateEvtRes = await fetch(`${BASE_URL}/admin/events/${newEvt.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        watermarkText: '© Ippu Clicks & Premium Studios • 0759125207',
        watermarkType: 'badge',
        watermarkPosition: 'bottom-center',
        watermarkScale: 32,
        watermarkOpacity: 95
      })
    });
    assert.strictEqual(updateEvtRes.status, 200);
    const updatedEvt = (await updateEvtRes.json()).event;
    assert.strictEqual(updatedEvt.watermarkText, '© Ippu Clicks & Premium Studios • 0759125207');
    assert.strictEqual(updatedEvt.watermarkType, 'badge');
    assert.strictEqual(updatedEvt.watermarkPosition, 'bottom-center');
    console.log('   ✅ Watermark & Brand Label settings updated in MySQL.\n');

    // 10. Re-apply Watermark Endpoint
    console.log('10. Testing Re-apply Watermark endpoint...');
    const reapplyRes = await fetch(`${BASE_URL}/admin/events/${newEvt.id}/reapply-watermark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(reapplyRes.status, 200);
    const reapplyData = await reapplyRes.json();
    assert.strictEqual(reapplyData.total, 0); // No photos yet in this test event
    console.log('   ✅ Re-apply watermark endpoint verified.\n');

    // 11. Toggle Downloads Endpoint
    console.log('11. Testing Toggle Downloads Permission...');
    const toggleRes = await fetch(`${BASE_URL}/admin/events/${newEvt.id}/toggle-downloads`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ allowDownloads: false })
    });
    assert.strictEqual(toggleRes.status, 200);
    const toggleData = await toggleRes.json();
    assert.strictEqual(toggleData.allowDownloads, false);
    console.log('   ✅ Toggle downloads verified.\n');

    // 12. Client Face Recognition Endpoint
    console.log('12. Testing Client Face Matching Endpoint (/match-face)...');
    // Send empty descriptor to test guard
    const matchRes = await fetch(`${BASE_URL}/client/events/sample-event/match-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor: new Array(128).fill(0.05) })
    });
    assert.strictEqual(matchRes.status, 200);
    const matchData = await matchRes.json();
    assert.strictEqual(matchData.accessType, 'FACE_FILTERED');
    assert(Array.isArray(matchData.matchedPhotos));
    console.log(`   ✅ Face matching engine verified. Returned ${matchData.matchedPhotos.length} matches.\n`);

    // 13. Clean up Created Test Event
    console.log('13. Cleaning up test event (DELETE /api/admin/events/:id)...');
    const deleteRes = await fetch(`${BASE_URL}/admin/events/${newEvt.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(deleteRes.status, 200);
    console.log('   ✅ Test event cleanly deleted from MySQL.\n');

    console.log('===============================================================');
    console.log('🎉 ALL 13 COMPREHENSIVE FEATURES AUDITED AND PASSED PERFECTLY!');
    console.log('===============================================================');
  } catch (err) {
    console.error('\n❌ Audit failed:', err);
    process.exit(1);
  }
}

runComprehensiveTests();
