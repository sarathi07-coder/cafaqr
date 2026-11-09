const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request('http://127.0.0.1:3000' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    http.get('http://127.0.0.1:3000' + path, { headers }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
    }).on('error', reject);
  });
}

(async () => {
  // 1. Submit Good Review 1
  const r1 = await post('/api/order/feedback/submit', {
    rating: 5,
    tags: ['😋 Delicious Food', '⚡ Fast Service'],
    comments: 'The butter chicken and crispy naan were incredibly delicious and served piping hot!'
  });
  console.log('Review 1 (Good 5★):', r1.status, r1.body.message);

  // 2. Submit Good Review 2
  const r2 = await post('/api/order/feedback/submit', {
    rating: 5,
    tags: ['📲 Easy QR Ordering', '👨‍🍳 Courteous Staff'],
    comments: 'Very smooth mobile QR ordering experience, and the staff was extremely friendly.'
  });
  console.log('Review 2 (Good 5★):', r2.status, r2.body.message);

  // 3. Submit Bad / Critical Review 3
  const r3 = await post('/api/order/feedback/submit', {
    rating: 2,
    tags: ['⏳ Long Wait Time', '💧 Water Refill Delay'],
    comments: 'We waited 35 minutes for our main course and the waiter was very slow to refill water glasses.'
  });
  console.log('Review 3 (Bad 2★):', r3.status, r3.body.message);

  // 4. Admin login & fetch AI Analysis
  const login = await post('/api/admin/login', { username: 'admin', password: 'supersecret' });
  const token = login.body.token;

  const aiRes = await get('/api/admin/analytics/reviews-ai', token);
  console.log('\n--- AI Review Intelligence Analysis ---');
  console.log('Engine:', aiRes.body.engine);
  console.log('Total Reviews:', aiRes.body.totalReviews, '| Average Rating:', aiRes.body.averageRating);
  console.log('Good Reviews:', aiRes.body.goodReviewsCount, '(' + aiRes.body.goodPercentage + '%)', '| Bad/Critical Reviews:', aiRes.body.badReviewsCount, '(' + aiRes.body.badPercentage + '%)');
  console.log('Top Praises Detected:', aiRes.body.topPraises.map(p => p.badge + ' (' + p.count + ' mentions)'));
  console.log('Common Problems Detected:', aiRes.body.commonProblems.map(p => p.badge + ' (' + p.count + ' issues - Severity: ' + p.severity + ')'));
  console.log('\nExecutive Summary:\n' + aiRes.body.executiveSummary);
  console.log('\nManager Action Plan:\n' + aiRes.body.managerActionItems.map((a, i) => (i + 1) + '. ' + a).join('\n'));

  // 5. Test Admin Feedback endpoint with segregation
  const feedbackRes = await get('/api/admin/feedback', token);
  console.log('\nAdmin Feedback List Total:', feedbackRes.body.reviews.length);

  process.exit(0);
})().catch(e => { console.error('Test error:', e); process.exit(1); });

