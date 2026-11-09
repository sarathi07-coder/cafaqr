// tests/test_photo_file_upload.js
const http = require('http');
const fs = require('fs');
const path = require('path');

function getAuthToken() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const json = JSON.parse(body);
        resolve(json.token);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ username: 'admin', password: 'supersecret' }));
    req.end();
  });
}

async function uploadFile(token, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    let postDataStart = `--${boundary}\r\n`;
    postDataStart += `Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n`;
    postDataStart += `Content-Type: image/png\r\n\r\n`;
    
    const postDataEnd = `\r\n--${boundary}--\r\n`;
    
    const startBuf = Buffer.from(postDataStart, 'utf-8');
    const endBuf = Buffer.from(postDataEnd, 'utf-8');
    const fullBody = Buffer.concat([startBuf, fileBuffer, endBuf]);

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/admin/upload-image',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

function checkStaticImage(imagePath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3000${imagePath}`, (res) => {
      let len = 0;
      res.on('data', chunk => len += chunk.length);
      res.on('end', () => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], length: len });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('🧪 Starting Direct Food Photo File Upload Verification...\n');

  const token = await getAuthToken();
  if (!token) throw new Error('Failed to get admin token');
  console.log('✅ Admin authenticated.');

  // Create a minimal 1x1 valid PNG image buffer
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const samplePngBuffer = Buffer.from(samplePngBase64, 'base64');

  console.log('\n--- Step 1: Uploading Photo from Device (Multipart) ---');
  const uploadRes = await uploadFile(token, samplePngBuffer, 'tasty_biryani.png');
  console.log('Upload Status:', uploadRes.status);
  console.log('Uploaded Image URL:', uploadRes.data?.url);
  console.log('Generated Filename:', uploadRes.data?.filename);

  if (uploadRes.status !== 200 || !uploadRes.data?.url) {
    throw new Error('File upload failed: ' + JSON.stringify(uploadRes));
  }
  console.log('✅ Photo file successfully received and stored on server!');

  console.log('\n--- Step 2: Verifying Static Image Delivery ---');
  const staticRes = await checkStaticImage(uploadRes.data.url);
  console.log('Static Route Status:', staticRes.status);
  console.log('Content-Type:', staticRes.contentType);
  console.log('Downloaded Bytes:', staticRes.length);

  if (staticRes.status !== 200) {
    throw new Error('Static image delivery failed');
  }
  console.log('✅ Uploaded food photo serves statically with 200 OK!');

  console.log('\n🎉 DIRECT FOOD PHOTO FILE UPLOADS FULLY VERIFIED 100%!');
}

run().catch(err => {
  console.error('❌ Test Error:', err);
  process.exit(1);
});

