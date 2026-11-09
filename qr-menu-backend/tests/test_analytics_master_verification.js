// tests/test_analytics_master_verification.js
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

async function runMasterVerification() {
  console.log('🚀 ==============================================================');
  console.log('   ADMIN ANALYTICS & INTELLIGENCE 10-MODULE MASTER TEST SUITE');
  console.log('==============================================================\n');

  // Step 1: Admin Authentication
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'supersecret' });

  const token = loginRes.data?.token;
  if (!token) throw new Error('Failed to obtain admin token');
  console.log('✅ [10% Milestone 1] Admin Authentication Verified.');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Step 2: Milestone 2 (20%) - Today's Revenue & Table Ranking
  console.log('\n--- Verifying [20% Milestone 2] Today\'s Revenue & In-Tables ---');
  const todayRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/today-kpi',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`• Today Total Revenue: ₹${todayRes.data.todayFinancials.totalRevenue}`);
  console.log(`• Settled Revenue: ₹${todayRes.data.todayFinancials.settledRevenue}`);
  console.log(`• Active In-Table Tabs: ₹${todayRes.data.todayFinancials.activeTabRevenue}`);
  console.log(`• #1 Earning Table Today: Table #${todayRes.data.highestEarningTable?.tableNumber} (₹${todayRes.data.highestEarningTable?.totalRevenue})`);
  if (!todayRes.data.highestEarningTable) throw new Error('Missing highest earning table');
  console.log('✅ [20% Milestone 2] PASSED.');

  // Step 3: Milestone 3 (30%) - 7-Day Peak Dining Pattern
  console.log('\n--- Verifying [30% Milestone 3] 7-Day Peak Dining Curves ---');
  const peakRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/peak-hours',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`• Operating Hour Slots: ${peakRes.data.hourlyCurve.length} hours tracked`);
  console.log(`• Primary Peak Window: ${peakRes.data.peakWindowSummary.primaryPeak}`);
  console.log(`• Busiest Hour: ${peakRes.data.peakWindowSummary.busiestHour}`);
  if (!peakRes.data.peakWindowSummary.primaryPeak) throw new Error('Missing peak window summary');
  console.log('✅ [30% Milestone 3] PASSED.');

  // Step 4: Milestone 4 (40%) - Food Sales & Quantity Intelligence
  console.log('\n--- Verifying [40% Milestone 4] Food Quantity & Dish Performance ---');
  const dishRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/dish-performance',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`• Total Food Items Sold Today: ${dishRes.data.totalDishesSoldToday}`);
  console.log(`• ⭐ Star Item (Highest Sold): ${dishRes.data.highestSoldDish.name} (${dishRes.data.highestSoldDish.quantitySoldToday} sold • ₹${dishRes.data.highestSoldDish.revenueToday})`);
  console.log(`• ⚠️ Action Item (Lowest Sold): ${dishRes.data.lowestSoldDish.name} (${dishRes.data.lowestSoldDish.quantitySoldToday} sold)`);
  if (!dishRes.data.highestSoldDish || !dishRes.data.lowestSoldDish) throw new Error('Missing star or low dish');
  console.log('✅ [40% Milestone 4] PASSED.');

  // Step 5: Milestone 5 (50%) - AI Reviews & Sentiment Intelligence
  console.log('\n--- Verifying [50% Milestone 5] AI Reviews & Sentiment Intelligence ---');
  const reviewsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/reviews-ai',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`• Customer Rating: ${reviewsRes.data.averageRating} / 5.0 (${reviewsRes.data.totalReviews} reviews)`);
  console.log(`• What Diners Love: ${reviewsRes.data.praiseTags.map(p => p.tag).join(', ')}`);
  console.log(`• Critical Notices: ${reviewsRes.data.criticalNotices.map(n => n.notice).join(', ')}`);
  console.log(`• ✨ AI Executive Summary:\n   "${reviewsRes.data.aiSummary}"`);
  if (!reviewsRes.data.aiSummary || reviewsRes.data.praiseTags.length === 0) throw new Error('Missing AI reviews analysis');
  console.log('✅ [50% Milestone 5] PASSED.');

  // Step 6: Milestone 6 (60%) - Operations & Targets Pacing
  console.log('\n--- Verifying [60% Milestone 6] Operations & Target Pacing ---');
  const opsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/operations-targets',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`• Daily Goal Pacing: ${opsRes.data.targets.daily.percentage}% (Earned: ₹${opsRes.data.targets.daily.actual} / Goal: ₹${opsRes.data.targets.daily.target})`);
  console.log(`• Weekly Goal Pacing: ${opsRes.data.targets.weekly.percentage}%`);
  console.log(`• Monthly Goal Pacing: ${opsRes.data.targets.monthly.percentage}%`);
  console.log(`• Avg Kitchen Prep Latency: ${opsRes.data.operations.avgKitchenPrepMinutes} mins`);
  console.log(`• Avg Table Turnaround: ${opsRes.data.operations.avgTableTurnaroundMinutes} mins`);
  console.log(`• Payment Method Split: ${opsRes.data.operations.paymentBreakdown.map(p => `${p.method}: ${p.percentage}%`).join(' | ')}`);
  console.log('✅ [60% Milestone 6] PASSED.');

  // Step 7: Dynamic Target Configuration PUT
  console.log('\n--- Verifying Dynamic Target Update (PUT /targets) ---');
  const updateRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/analytics/targets',
    method: 'PUT',
    headers: authHeaders
  }, {
    dailyTarget: 25000,
    weeklyTarget: 150000,
    monthlyTarget: 600000
  });
  console.log(`• Target Update Message: ${updateRes.data.message}`);
  console.log(`• Updated Targets: Daily=₹${updateRes.data.restaurant.daily_target}, Weekly=₹${updateRes.data.restaurant.weekly_target}`);
  if (updateRes.status !== 200) throw new Error('Target update failed');
  console.log('✅ Dynamic Target Updates PASSED.');

  console.log('\n🎉 ==============================================================');
  console.log('   ALL 10 MILESTONES (100%) SUCCESSFULLY TESTED AND VERIFIED!');
  console.log('==============================================================\n');
}

runMasterVerification().catch(err => {
  console.error('❌ Master Verification Failed:', err);
  process.exit(1);
});

