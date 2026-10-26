import assert from 'assert';

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('🧪 Starting API Verification Suite against live server...');

  try {
    // 1. Health check
    console.log('Test 1: Health check...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(healthRes.status, 200, 'Health check failed');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    console.log('✅ Health check passed.');

    // 2. Admin Login
    console.log('Test 2: Admin Login...');
    const loginRes = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ippuclicks.com', password: 'admin123' })
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login failed');
    const loginData = await loginRes.json();
    assert(loginData.token, 'Token missing');
    const token = loginData.token;
    console.log('✅ Admin Login successful with JWT.');

    // 3. Client Event Fetching
    console.log('Test 3: Client Public Event Fetch...');
    const clientEventRes = await fetch(`${BASE_URL}/client/events/sample-event`);
    assert.strictEqual(clientEventRes.status, 200, 'Client event fetch failed');
    const clientEvent = await clientEventRes.json();
    assert.strictEqual(clientEvent.name, 'Ippu Clicks Royal Gala Night');
    assert.strictEqual(clientEvent.pin, undefined, 'CRITICAL: PIN must NOT be exposed in public endpoint');
    console.log('✅ Client Event fetched cleanly (PIN kept hidden).');

    // 4. Client PIN Validation - Correct PIN
    console.log('Test 4: Client PIN validation (Correct PIN)...');
    const correctPinRes = await fetch(`${BASE_URL}/client/events/sample-event/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '882194' })
    });
    assert.strictEqual(correctPinRes.status, 200);
    const correctPinData = await correctPinRes.json();
    assert.strictEqual(correctPinData.accessType, 'ALL_PHOTOS');
    assert(Array.isArray(correctPinData.photos) && correctPinData.photos.length > 0);
    console.log('✅ Correct PIN unlocked all event photos.');

    // 5. Client PIN Validation - Incorrect PIN
    console.log('Test 5: Client PIN validation (Incorrect PIN)...');
    const wrongPinRes = await fetch(`${BASE_URL}/client/events/sample-event/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '000000' })
    });
    assert.strictEqual(wrongPinRes.status, 401, 'Wrong PIN did not trigger 401');
    console.log('✅ Wrong PIN rejected with 401 Unauthorized.');

    // 6. Admin Create Event & QR Code Generation
    console.log('Test 6: Create New Event with Logo QR...');
    const createEvtRes = await fetch(`${BASE_URL}/admin/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Automated Test Wedding',
        date: '2026-11-20',
        details: 'Nairobi Serena',
        allowDownloads: false
      })
    });
    assert.strictEqual(createEvtRes.status, 201);
    const newEvtData = await createEvtRes.json();
    assert(newEvtData.event.qrCodeDataUrl.startsWith('data:image/png;base64,'));
    console.log('✅ Event created with embedded logo QR code.');

    // 7. Verify Download Guard
    console.log('Test 7: Download Permission Guard...');
    const downloadRes = await fetch(`${BASE_URL}/client/events/${newEvtData.event.publicSlug}/download-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: ['any'] })
    });
    assert.strictEqual(downloadRes.status, 403, 'Disabled download was not blocked with 403');
    console.log('✅ Disabled downloads strictly blocked with 403 Forbidden.');

    console.log('\n🎉 ALL 7 BACKEND API TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  }
}

runTests();
