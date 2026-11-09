// tests/test_analytics_backend_milestones.js
const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Milestones 10% to 60% Backend Analytics Verification...\n');

  // Step 1: Login to get token
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'supersecret' });

  const token = loginRes.data?.token;
  if (!token) {
    console.error('❌ Failed to authenticate:', loginRes);
    process.exit(1);
  }
  console.log('✅ Authenticated as Admin successfully.');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Milestone 2 (20%): Today's KPI & Table Performance
  console.log('\n--- Testing Milestone 2 (20%): /analytics/today-kpi ---');
  const todayRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/today-kpi',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status:', todayRes.status);
  console.log('Today Total Revenue:', todayRes.data.todayFinancials?.totalRevenue);
  console.log('Highest Earning Table:', todayRes.data.highestEarningTable?.tableNumber, 'Revenue:', todayRes.data.highestEarningTable?.totalRevenue);
  if (todayRes.status !== 200 || !todayRes.data.todayFinancials) {
    throw new Error('Milestone 2 Failed');
  }
  console.log('✅ Milestone 2 (20%) VERIFIED!');

  // Milestone 3 (30%): 7-Day Peak Dining Pattern
  console.log('\n--- Testing Milestone 3 (30%): /analytics/peak-hours ---');
  const peakRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/peak-hours',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status:', peakRes.status);
  console.log('Hourly Slots Count:', peakRes.data.hourlyCurve?.length);
  console.log('Primary Peak Window:', peakRes.data.peakWindowSummary?.primaryPeak);
  if (peakRes.status !== 200 || !peakRes.data.peakWindowSummary) {
    throw new Error('Milestone 3 Failed');
  }
  console.log('✅ Milestone 3 (30%) VERIFIED!');

  // Milestone 4 (40%): Food Sales & Quantity Intelligence
  console.log('\n--- Testing Milestone 4 (40%): /analytics/dish-performance ---');
  const dishRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/dish-performance',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status:', dishRes.status);
  console.log('Total Dishes Sold Today:', dishRes.data.totalDishesSoldToday);
  console.log('Highest Sold Dish (Star):', dishRes.data.highestSoldDish?.name, 'Quantity:', dishRes.data.highestSoldDish?.quantitySoldToday);
  console.log('Lowest Sold Dish (Action Item):', dishRes.data.lowestSoldDish?.name);
  if (dishRes.status !== 200 || !dishRes.data.highestSoldDish) {
    throw new Error('Milestone 4 Failed');
  }
  console.log('✅ Milestone 4 (40%) VERIFIED!');

  // Milestone 5 (50%): Customer Feedback AI & Sentiment Summarizer
  console.log('\n--- Testing Milestone 5 (50%): /analytics/reviews-ai ---');
  const reviewsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/reviews-ai',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status:', reviewsRes.status);
  console.log('Average Rating:', reviewsRes.data.averageRating);
  console.log('Praise Tags:', reviewsRes.data.praiseTags?.map(t => t.tag).join(', '));
  console.log('Critical Notices:', reviewsRes.data.criticalNotices?.map(n => n.notice).join(', '));
  console.log('AI Summary:', reviewsRes.data.aiSummary);
  if (reviewsRes.status !== 200 || !reviewsRes.data.aiSummary) {
    throw new Error('Milestone 5 Failed');
  }
  console.log('✅ Milestone 5 (50%) VERIFIED!');

  // Milestone 6 (60%): Operational Metrics & Target Pacing
  console.log('\n--- Testing Milestone 6 (60%): /analytics/operations-targets ---');
  const opsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/operations-targets',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Status:', opsRes.status);
  console.log('Daily Target Progress:', opsRes.data.targets?.daily?.percentage + '%');
  console.log('Weekly Target Progress:', opsRes.data.targets?.weekly?.percentage + '%');
  console.log('Avg Kitchen Prep Time:', opsRes.data.operations?.avgKitchenPrepMinutes, 'minutes');
  console.log('Payment Methods:', opsRes.data.operations?.paymentBreakdown?.map(p => `${p.method}: ${p.percentage}%`).join(', '));
  if (opsRes.status !== 200 || !opsRes.data.targets) {
    throw new Error('Milestone 6 Failed');
  }
  console.log('✅ Milestone 6 (60%) VERIFIED!');

  console.log('\n🎉 ALL BACKEND ANALYTICS MILESTONES (10% TO 60%) COMPLETED & VERIFIED 100%!');
}

runTests().catch(err => {
  console.error('❌ Test Execution Error:', err);
  process.exit(1);
});
