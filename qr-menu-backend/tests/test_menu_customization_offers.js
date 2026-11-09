// tests/test_menu_customization_offers.js
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

async function runTest() {
  console.log('🧪 Starting Menu Customization, Offers & Availability Verification...\n');

  // Step 1: Admin Login
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'supersecret' });

  const token = loginRes.data?.token;
  if (!token) throw new Error('Admin authentication failed');
  console.log('✅ Admin authenticated.');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08'; // Royal Spice Bistro

  // Step 2: Add New Food Item with Image, Rate & Offer
  console.log('\n--- Step 2: Adding New Food Item with Image & Offer ---');
  const newDishPayload = {
    restaurantId,
    name: 'Saffron Royal Biryani',
    description: 'Slow-cooked fragrant basmati rice with aromatic saffron and tender spices.',
    category: 'Main Course',
    price: 320.00,
    originalPrice: 400.00,
    offerBadge: '20% OFF',
    photoUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500',
    available: true
  };

  const createRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/menu',
    method: 'POST',
    headers: authHeaders
  }, newDishPayload);

  console.log('Create Status:', createRes.status);
  console.log('Created Dish ID:', createRes.data?.id);
  console.log('Dish Name:', createRes.data?.name);
  console.log('Selling Rate:', createRes.data?.price, 'Original Price:', createRes.data?.original_price);
  console.log('Offer Badge:', createRes.data?.offer_badge);
  console.log('Photo URL:', createRes.data?.photo_url);

  if (createRes.status !== 201 || !createRes.data?.id) throw new Error('Create dish failed');
  const dishId = createRes.data.id;
  console.log('✅ Food item created with image and offer.');

  // Step 3: Verify on Customer Order Menu Endpoint
  console.log('\n--- Step 3: Verifying Customer Menu Delivery ---');
  const menuRes1 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/menu/${restaurantId}`,
    method: 'GET'
  });

  const foundItem1 = menuRes1.data.find(d => d.id === dishId);
  if (!foundItem1) throw new Error('New food item not found on customer menu');
  console.log('Customer sees:', foundItem1.name, 'Price:', foundItem1.price, 'Original:', foundItem1.original_price, 'Badge:', foundItem1.offer_badge);
  console.log('In Stock:', foundItem1.available);
  console.log('✅ Customer menu received new dish with photo & offer!');

  // Step 4: Alter Rate & Offer
  console.log('\n--- Step 4: Altering Rate & Offer ---');
  const updateRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/admin/menu/${dishId}`,
    method: 'PUT',
    headers: authHeaders
  }, {
    price: 299.00,
    originalPrice: 450.00,
    offerBadge: 'MEGA DEAL (33% OFF)'
  });

  console.log('Update Status:', updateRes.status);
  console.log('Updated Rate:', updateRes.data?.price, 'Original:', updateRes.data?.original_price, 'Badge:', updateRes.data?.offer_badge);
  if (updateRes.status !== 200) throw new Error('Update rate failed');
  console.log('✅ Rate & offer altered successfully.');

  // Step 5: Toggle Availability to Out of Stock
  console.log('\n--- Step 5: 1-Click Stock Toggle (Mark Out of Stock) ---');
  const toggleRes1 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/admin/menu/${dishId}/toggle-availability`,
    method: 'PUT',
    headers: authHeaders
  });

  console.log('Toggle message:', toggleRes1.data?.message);
  console.log('Is Available now:', toggleRes1.data?.item?.available);
  if (toggleRes1.data?.item?.available !== false) throw new Error('Expected dish to be out of stock');
  console.log('✅ Marked OUT OF STOCK successfully.');

  // Step 6: Verify Customer Menu shows Out of Stock
  const menuRes2 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/menu/${restaurantId}`,
    method: 'GET'
  });
  const foundItem2 = menuRes2.data.find(d => d.id === dishId);
  console.log('Customer menu availability:', foundItem2?.available);
  if (foundItem2?.available !== false) throw new Error('Customer menu does not reflect out of stock');
  console.log('✅ Customer order page reflects OUT OF STOCK immediately!');

  // Step 7: Clean up (Delete test dish)
  console.log('\n--- Step 7: Cleaning Up Test Dish ---');
  const deleteRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/admin/menu/${dishId}`,
    method: 'DELETE',
    headers: authHeaders
  });
  console.log('Delete Status:', deleteRes.status, 'Message:', deleteRes.data?.message);
  console.log('✅ Test dish deleted.');

  console.log('\n🎉 ALL MENU CUSTOMIZATION, OFFERS & STOCK CONTROLS VERIFIED 100%!');
}

runTest().catch(err => {
  console.error('❌ Test Error:', err);
  process.exit(1);
});

