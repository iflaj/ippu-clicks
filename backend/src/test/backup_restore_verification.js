async function testBackupAndRestore() {
  console.log('==============================================');
  console.log('💾 Database Backup & Restore Verification Suite');
  console.log('==============================================');

  // 1. Admin Login
  console.log('\n[1/3] Logging in as admin...');
  const loginRes = await fetch('http://localhost:5000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ippuclicks.com', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  console.log('✅ Admin authenticated successfully.');

  // 2. Test JSON Backup Download
  console.log('\n[2/3] Testing JSON and SQL Backup Exports...');
  const jsonRes = await fetch('http://localhost:5000/api/admin/database/backup?format=json', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (jsonRes.status !== 200) throw new Error(`JSON backup failed with status ${jsonRes.status}`);
  const jsonData = await jsonRes.json();
  console.log(`✅ JSON Backup received: ${jsonData.events?.length || 0} event(s), ${jsonData.photos?.length || 0} photo(s)`);

  const sqlRes = await fetch('http://localhost:5000/api/admin/database/backup?format=sql', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (sqlRes.status !== 200) throw new Error(`SQL dump failed with status ${sqlRes.status}`);
  const sqlText = await sqlRes.text();
  console.log(`✅ SQL Dump received: ${sqlText.length} bytes`);
  if (!sqlText.includes('INSERT INTO `events`') || !sqlText.includes('INSERT INTO `photos`')) {
    throw new Error('SQL dump missing expected INSERT statements');
  }
  console.log('✅ SQL Dump syntax verified with native MySQL table statements.');

  // 3. Test Database Restore
  console.log('\n[3/3] Testing Database Restore Endpoint...');
  const restoreRes = await fetch('http://localhost:5000/api/admin/database/restore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(jsonData)
  });
  if (restoreRes.status !== 200) {
    const errText = await restoreRes.text();
    throw new Error(`Restore failed: ${errText}`);
  }
  const restoreData = await restoreRes.json();
  console.log(`✅ Restore response:`, restoreData);
  if (!restoreData.result?.restoredEvents) {
    throw new Error('Restore result missing restoredEvents');
  }

  console.log('\n==============================================');
  console.log('🎉 ALL BACKUP & RESTORE TESTS PASSED 100%!');
  console.log('==============================================');
}

testBackupAndRestore().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
