// Seed authentic KRISH Cafe & Restaurant Menu Items into Cloudflare D1
const API_BASE = 'https://cafaqr-api.p7404467.workers.dev/api';

const KRISH_ITEMS = [
  // --- CAFE MENU: MOJITO ---
  { name: 'Mint Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Crisp refreshing mint and lime cooler with crushed ice', photoUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500' },
  { name: 'Blue Curacao Mojito', category: 'Mojito', price: 70, isVeg: true, description: 'Vibrant blue citrus sparkler with fresh mint and fizz', photoUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500' },
  { name: 'Passion Fruit Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Tropical passion fruit pulp shaken with mint and soda', photoUrl: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=500' },
  { name: 'Green Apple Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Crisp sour green apple tang with mint and crushed ice', photoUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=500' },
  { name: 'Bubblegum Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Sweet playful bubblegum flavor infused in iced soda', photoUrl: 'https://images.unsplash.com/photo-1560512823-829485b8bf24?w=500' },
  { name: 'Bacardi Mojito', category: 'Mojito', price: 70, isVeg: true, description: 'Classic mint mojito blend with zesty lime mocktail notes', photoUrl: 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=500' },
  { name: 'Bacardi Cranberry Mojito', category: 'Mojito', price: 70, isVeg: true, description: 'Ruby cranberry splash with mint and chilled soda', photoUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=500' },

  // --- CAFE MENU: ICE CREAM ---
  { name: 'Brownie with Ice Cream', category: 'Ice Cream', price: 99, isVeg: true, description: 'Warm gooey chocolate brownie topped with vanilla scoop & hot fudge', photoUrl: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500' },
  { name: 'Chocolate Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Rich Belgian chocolate double scoop with chocolate drizzle', photoUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500' },
  { name: 'Vanilla Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Classic Madagascar vanilla scoop with rainbow sprinkles', photoUrl: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=500' },
  { name: 'Butterscotch Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Crunchy caramel praline butterscotch scoop', photoUrl: 'https://images.unsplash.com/photo-1580915411954-282cb1b0d780?w=500' },
  { name: 'Blackcurrant Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Berry explosion with real blackcurrant fruit bits', photoUrl: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=500' },

  // --- CAFE MENU: COFFEE AND MILK ---
  { name: 'Hot Chocolate', category: 'Coffee & Milk', price: 79, isVeg: true, description: 'Steaming thick cocoa made with pure dairy milk and chocolate flakes', photoUrl: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=500' },
  { name: 'Cold Coffee', category: 'Coffee & Milk', price: 79, isVeg: true, description: 'Creamy blended espresso milkshake topped with froth', photoUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500' },
  { name: 'Rose Milk', category: 'Coffee & Milk', price: 50, isVeg: true, description: 'Chilled fragrant damask rose syrup blended with sweet milk', photoUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500' },
  { name: 'Badam Milk', category: 'Coffee & Milk', price: 50, isVeg: true, description: 'Traditional almond milk infused with saffron and cardamom', photoUrl: 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=500' },
  { name: 'Lizzie', category: 'Coffee & Milk', price: 40, isVeg: true, description: 'Special signature chilled dessert milk treat', photoUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500' },

  // --- CAFE MENU: JUICE (BUY 1 GET 1 FREE) ---
  { name: 'Lemon Juice', category: 'Juice', price: 60, isVeg: true, offerBadge: 'BUY 1 GET 1 FREE', description: 'Freshly squeezed lemon juice with mint and rock salt [BOGO OFFER]', photoUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500' },
  { name: 'Watermelon Juice', category: 'Juice', price: 80, isVeg: true, offerBadge: 'BUY 1 GET 1 FREE', description: 'Hydrating 100% natural cold-pressed watermelon juice [BOGO OFFER]', photoUrl: 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=500' },

  // --- CAFE MENU: FRIED CHICKEN ---
  { name: 'Fried Chicken Strips (4pcs)', category: 'Fried Chicken', price: 120, isVeg: false, description: 'Golden crunchy boneless chicken tenders served with garlic dip', photoUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500' },
  { name: 'Fried Chicken Strips (6pcs)', category: 'Fried Chicken', price: 150, isVeg: false, description: '6 crispy fried chicken strips with peri peri dipping sauce', photoUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500' },
  { name: 'Chicken Lollipop (3pcs)', category: 'Fried Chicken', price: 120, isVeg: false, description: 'Spicy Indo-Chinese chicken drummettes tossed in schezwan glaze', photoUrl: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=500' },
  { name: 'Chicken Lollipop (6pcs)', category: 'Fried Chicken', price: 150, isVeg: false, description: '6 jumbo crispy chicken lollipops with hot garlic dip', photoUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500' },
  { name: 'Chicken Wings (4pcs)', category: 'Fried Chicken', price: 120, isVeg: false, description: 'Deep fried crispy chicken wings with tangy BBQ seasoning', photoUrl: 'https://images.unsplash.com/photo-1527477321005-4d01d75b2332?w=500' },
  { name: 'Chicken Wings (6pcs)', category: 'Fried Chicken', price: 150, isVeg: false, description: '6 juicy crispy fried chicken wings with spicy herb dust', photoUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500' },

  // --- CAFE MENU: FRENCH FRIES ---
  { name: 'French Fries', category: 'French Fries', price: 50, isVeg: true, description: 'Classic crispy golden salted potato fries', photoUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500' },
  { name: 'Peri Peri Fries', category: 'French Fries', price: 60, isVeg: true, description: 'Crispy fries tossed in hot African peri peri spice mix', photoUrl: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=500' },
  { name: 'French Fries Loaded', category: 'French Fries', price: 119, isVeg: true, description: 'Melted cheese sauce, jalapeños, and spiced mayonnaise overload', photoUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=500' },
  { name: 'French Fries Lays Loaded', category: 'French Fries', price: 149, isVeg: true, description: 'Crunchy potato chips, loaded fries, cheese burst & herb dressing', photoUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500' },
  { name: 'Lays Chicken', category: 'French Fries', price: 40, isVeg: false, description: 'Crunchy crushed Lays topped with crispy chicken popcorn bites', photoUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500' },

  // --- CAFE MENU: SANDWICH ---
  { name: 'Chicken Sandwich', category: 'Sandwich', price: 89, isVeg: false, description: 'Grilled bread packed with shredded spiced chicken, veggies & mayo', photoUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500' },
  { name: 'Paneer Sandwich', category: 'Sandwich', price: 89, isVeg: true, description: 'Toasted sandwich filled with spiced cottage cheese cubes & chutney', photoUrl: 'https://images.unsplash.com/photo-1619860860774-1e2e17343432?w=500' },
  { name: 'Veg Sandwich', category: 'Sandwich', price: 79, isVeg: true, description: 'Fresh garden cucumbers, tomatoes, bell peppers & mint mayonnaise', photoUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500' },
  { name: 'Fried Chicken Sandwich', category: 'Sandwich', price: 99, isVeg: false, description: 'Golden crispy chicken fillet inside toasted buttered bread', photoUrl: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=500' },

  // --- CAFE MENU: SNACKS ---
  { name: 'Chicken Popcorn', category: 'Snacks', price: 80, isVeg: false, description: 'Bite-sized seasoned chicken crunchies with spicy dip', photoUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500' },
  { name: 'Chicken Nuggets', category: 'Snacks', price: 80, isVeg: false, description: 'Tender seasoned minced chicken nuggets fried to golden perfection', photoUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500' },

  // --- CAFE MENU: BUN ---
  { name: 'Jam Bun', category: 'Bun', price: 39, isVeg: true, description: 'Soft sweet bakery bun slathered with mixed fruit jam', photoUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500' },
  { name: 'Butter Bun', category: 'Bun', price: 49, isVeg: true, description: 'Fluffy warm bun generously spread with fresh butter', photoUrl: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=500' },
  { name: 'Bun Butter Jam', category: 'Bun', price: 59, isVeg: true, description: 'The legendary combo of soft bun with rich butter & sweet jam', photoUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500' },

  // --- CAFE MENU: MAGGI ---
  { name: 'Masala Maggi', category: 'Maggi', price: 49, isVeg: true, description: 'Classic 2-minute noodles tossed with spicy butter masala & veggies', photoUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500' },
  { name: 'Egg Maggi', category: 'Maggi', price: 59, isVeg: false, description: 'Hot soupy masala noodles scrambled with farm-fresh egg', photoUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500' },
  { name: 'Chicken Maggi', category: 'Maggi', price: 69, isVeg: false, description: 'Loaded with juicy shredded chicken pieces and roasted masala', photoUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500' },

  // --- CAFE MENU: BREAD OMBLATE ---
  { name: 'Bread Omblate', category: 'Bread Omblate', price: 50, isVeg: false, description: 'Street-style spiced egg omelette wrapped around toasted bread slices', photoUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500' },

  // ==========================================
  // --- RESTAURANT MENU: BRIYANI ---
  // ==========================================
  { name: 'Chicken Briyani', category: 'Briyani', price: 100, isVeg: false, description: 'Fragrant seeraga samba rice cooked with tender chicken and aromatic herbs', photoUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500' },
  { name: 'Chicken 65 Briyani', category: 'Briyani', price: 110, isVeg: false, description: 'Flavorful briyani rice topped with crispy spicy chicken 65 pieces', photoUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500' },
  { name: 'Chicken Gilma Briyani', category: 'Briyani', price: 140, isVeg: false, description: 'Krish special signature spicy gravy-tossed chicken briyani', photoUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500' },
  { name: 'MT Briyani', category: 'Briyani', price: 80, isVeg: false, description: 'Kuska briyani rice simmered in rich chicken broth and spices', photoUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500' },

  // --- RESTAURANT MENU: FRIED RICE ---
  { name: 'Chicken Fried Rice', category: 'Fried Rice', price: 110, isVeg: false, description: 'Wok-tossed basmati rice with diced chicken, eggs and scallions', photoUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500' },
  { name: 'Chicken Schezwan Rice', category: 'Fried Rice', price: 130, isVeg: false, description: 'Fiery wok fried rice with chicken in home-made schezwan chili sauce', photoUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500' },
  { name: 'Egg Fried Rice', category: 'Fried Rice', price: 90, isVeg: false, description: 'Aromatic wok tossed rice with scrambled egg, white pepper & greens', photoUrl: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=500' },
  { name: 'Veg Fried Rice', category: 'Fried Rice', price: 80, isVeg: true, description: 'Crunchy carrots, beans, and cabbage tossed with aromatic rice', photoUrl: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=500' },
  { name: 'Paneer Fried Rice', category: 'Fried Rice', price: 110, isVeg: true, description: 'Golden paneer cubes wok-tossed with fragrant spiced fried rice', photoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' },
  { name: 'Cauliflower Fried Rice', category: 'Fried Rice', price: 110, isVeg: true, description: 'Crispy gobi florets tossed with pepper fried rice', photoUrl: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=500' },

  // --- RESTAURANT MENU: NOODLES ---
  { name: 'Chicken Noodles', category: 'Noodles', price: 110, isVeg: false, description: 'Wok-stirred egg noodles with shredded chicken and oriental veggies', photoUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500' },
  { name: 'Chicken Schezwan Noodles', category: 'Noodles', price: 130, isVeg: false, description: 'Spicy wok tossed noodles with chicken and fiery schezwan peppers', photoUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500' },
  { name: 'Egg Noodles', category: 'Noodles', price: 90, isVeg: false, description: 'Classic street-style noodles with scrambled egg and spring onion', photoUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500' },
  { name: 'Veg Noodles', category: 'Noodles', price: 80, isVeg: true, description: 'Soft wheat noodles stir fried with julienned vegetables and soy', photoUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500' },
  { name: 'Paneer Noodles', category: 'Noodles', price: 110, isVeg: true, description: 'Golden cottage cheese strips stir-fried with seasoned noodles', photoUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500' },
  { name: 'Cauliflower Noodles', category: 'Noodles', price: 110, isVeg: true, description: 'Crunchy battered cauliflower tossed with street style noodles', photoUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500' },

  // --- RESTAURANT MENU: OTHERS ---
  { name: 'Curd Rice + Chicken 65', category: 'Others', price: 110, isVeg: false, description: 'Cooling tempered curd rice served with hot crunchy Chicken 65', photoUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500' },
  { name: 'Chilli Parotta', category: 'Others', price: 100, isVeg: true, description: 'Shredded crispy parotta tossed in spicy onion-capsicum chili gravy', photoUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500' },
  { name: 'Mutta Parotta', category: 'Others', price: 80, isVeg: false, description: 'Egg kothu parotta minced on tawa with salna and green chilies', photoUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500' },
  { name: 'Chicken Mutta Parotta', category: 'Others', price: 100, isVeg: false, description: 'Minced chicken and egg kothu parotta with aromatic spices', photoUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500' },
  { name: 'Chicken Chilly', category: 'Others', price: 60, isVeg: false, description: 'Tender chicken bites stir-fried with green chilies and curry leaves', photoUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500' },
  { name: 'Paneer 65', category: 'Others', price: 80, isVeg: true, description: 'Crispy deep-fried paneer cubes spiced with South Indian masala', photoUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500' },

  // --- RESTAURANT MENU: OMBLATE ---
  { name: 'Omblate', category: 'Omblate', price: 20, isVeg: false, description: 'Fluffy double egg omelette with diced onions, green chili and pepper', photoUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500' },
  { name: 'Half Boiled', category: 'Omblate', price: 20, isVeg: false, description: 'Sunny side up runny egg yolk sprinkled with crushed black pepper', photoUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500' },
  { name: 'Podi Mass', category: 'Omblate', price: 20, isVeg: false, description: 'Spiced South Indian egg scramble with shallots and curry leaves', photoUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500' },
];

async function seed() {
  console.log('Logging in as Admin to seed KRISH Cafe & Restaurant menu...');
  const loginRes = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin' })
  });

  let token = '';
  if (loginRes.ok) {
    const data = await loginRes.json();
    token = data.token;
  } else {
    // try supersecret
    const try2 = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: 'supersecret' })
    });
    if (try2.ok) {
      const data = await try2.json();
      token = data.token;
    }
  }

  if (!token) {
    console.error('Failed to obtain admin token.');
    return;
  }
  console.log('✅ Admin authenticated.');

  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

  // Update UPI payee name to KRISH Cafe & Restaurant
  try {
    await fetch(`${API_BASE}/admin/upi`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        restaurantId,
        upiId: '8760633322@oksbi',
        upiName: 'KRISH Cafe & Restaurant',
        passkey: '1234'
      })
    });
    console.log('✅ Updated UPI config to KRISH Cafe & Restaurant (VPA: 8760633322@oksbi)');
  } catch (e) {
    console.warn('Could not update UPI:', e.message);
  }

  // Fetch current menu
  const currentMenuRes = await fetch(`${API_BASE}/menu/${restaurantId}`);
  const currentMenu = await currentMenuRes.json();
  const existingNames = new Set((currentMenu || []).map((m) => m.name.toLowerCase()));

  console.log(`Current menu has ${currentMenu.length} items. Seeding KRISH catalog...`);
  let added = 0;

  for (const item of KRISH_ITEMS) {
    if (existingNames.has(item.name.toLowerCase())) {
      continue;
    }

    const res = await fetch(`${API_BASE}/admin/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        restaurantId,
        name: item.name,
        category: item.category,
        price: item.price,
        originalPrice: item.offerBadge ? item.price + 20 : null,
        offerBadge: item.offerBadge || null,
        description: item.description,
        photoUrl: item.photoUrl,
        isVeg: item.isVeg,
        available: true
      })
    });

    if (res.ok) {
      added++;
      console.log(`+ Added: [${item.category}] ${item.name} - ₹${item.price}`);
    } else {
      console.warn(`! Failed to add ${item.name}: ${res.status}`);
    }
  }

  console.log(`\n🎉 Seed completed! Added ${added} new KRISH items to the database.`);
}

seed().catch(console.error);
