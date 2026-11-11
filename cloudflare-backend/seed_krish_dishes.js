// Seed authentic KRISH Cafe & Restaurant Menu Items into Cloudflare D1
const API_BASE = 'https://cafaqr-api.p7404467.workers.dev/api';

const KRISH_ITEMS = [
  // --- CAFE MENU: MOJITO ---
  { name: 'Mint Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Crisp refreshing mint and lime cooler with crushed ice', photoUrl: '/menu-images/B_04_01_mint_mojito.png' },
  { name: 'Blue Curacao Mojito', category: 'Mojito', price: 70, isVeg: true, description: 'Vibrant blue citrus sparkler with fresh mint and fizz', photoUrl: '/menu-images/A_04_05_blue_curacao.png' },
  { name: 'Passion Fruit Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Tropical passion fruit pulp shaken with mint and soda', photoUrl: '/menu-images/A_04_06_passion_fruit.png' },
  { name: 'Green Apple Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Crisp sour green apple tang with mint and crushed ice', photoUrl: '/menu-images/A_04_07_green_apple.png' },
  { name: 'Bubblegum Mojito', category: 'Mojito', price: 60, isVeg: true, description: 'Sweet playful bubblegum flavor infused in iced soda', photoUrl: '/menu-images/A_05_01_bubblegum.png' },
  { name: 'Bacardi Mojito', category: 'Mojito', price: 70, isVeg: true, description: 'Classic mint mojito blend with zesty lime mocktail notes', photoUrl: '/menu-images/A_05_02_bacardi_mojito.png' },
  { name: 'Bacardi Cranberry Mojito', category: 'Mojito', price: 70, isVeg: true, description: 'Ruby cranberry splash with mint and chilled soda', photoUrl: '/menu-images/A_05_03_bacardi_cranberry.png' },

  // --- CAFE MENU: ICE CREAM ---
  { name: 'Brownie with Ice Cream', category: 'Ice Cream', price: 99, isVeg: true, description: 'Warm gooey chocolate brownie topped with vanilla scoop & hot fudge', photoUrl: '/menu-images/B_04_02_brownie_with_ice_cream.png' },
  { name: 'Chocolate Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Rich Belgian chocolate double scoop with chocolate drizzle', photoUrl: '/menu-images/A_05_05_chocolate_ice_cream.png' },
  { name: 'Vanilla Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Classic Madagascar vanilla scoop with rainbow sprinkles', photoUrl: '/menu-images/A_05_06_vanilla_ice_cream.png' },
  { name: 'Butterscotch Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Crunchy caramel praline butterscotch scoop', photoUrl: '/menu-images/A_05_07_butterscotch_ice_cream.png' },
  { name: 'Blackcurrant Ice Cream', category: 'Ice Cream', price: 60, isVeg: true, description: 'Berry explosion with real blackcurrant fruit bits', photoUrl: '/menu-images/A_06_01_blackcurrant_ice_cream.png' },

  // --- CAFE MENU: COFFEE AND MILK ---
  { name: 'Hot Chocolate', category: 'Coffee & Milk', price: 79, isVeg: true, description: 'Steaming thick cocoa made with pure dairy milk and chocolate flakes', photoUrl: '/menu-images/A_06_02_hot_chocolate.png' },
  { name: 'Cold Coffee', category: 'Coffee & Milk', price: 79, isVeg: true, description: 'Creamy blended espresso milkshake topped with froth', photoUrl: '/menu-images/A_06_03_cold_coffee.png' },
  { name: 'Rose Milk', category: 'Coffee & Milk', price: 50, isVeg: true, description: 'Chilled fragrant damask rose syrup blended with sweet milk', photoUrl: '/menu-images/A_06_04_rose_milk.png' },
  { name: 'Badam Milk', category: 'Coffee & Milk', price: 50, isVeg: true, description: 'Traditional almond milk infused with saffron and cardamom', photoUrl: '/menu-images/A_06_05_batham_milk.png' },
  { name: 'Lizzie', category: 'Coffee & Milk', price: 40, isVeg: true, description: 'Special signature chilled dessert milk treat', photoUrl: '/menu-images/A_06_06_lizzie.png' },

  // --- CAFE MENU: JUICE (BUY 1 GET 1 FREE) ---
  { name: 'Lemon Juice', category: 'Juice', price: 60, isVeg: true, offerBadge: 'BUY 1 GET 1 FREE', description: 'Freshly squeezed lemon juice with mint and rock salt [BOGO OFFER]', photoUrl: '/menu-images/A_06_07_lemon_juice.png' },
  { name: 'Watermelon Juice', category: 'Juice', price: 80, isVeg: true, offerBadge: 'BUY 1 GET 1 FREE', description: 'Hydrating 100% natural cold-pressed watermelon juice [BOGO OFFER]', photoUrl: '/menu-images/A_06_08_watermelon_juice.png' },

  // --- CAFE MENU: FRIED CHICKEN ---
  { name: 'Fried Chicken Strips (4pcs)', category: 'Fried Chicken', price: 120, isVeg: false, description: 'Golden crunchy boneless chicken tenders served with garlic dip', photoUrl: '/menu-images/krish_fried_chicken_strips_4pcs.jpg' },
  { name: 'Fried Chicken Strips (6pcs)', category: 'Fried Chicken', price: 150, isVeg: false, description: '6 crispy fried chicken strips with peri peri dipping sauce', photoUrl: '/menu-images/krish_fried_chicken_strips_6pcs.jpg' },
  { name: 'Chicken Lollipop (3pcs)', category: 'Fried Chicken', price: 120, isVeg: false, description: 'Spicy Indo-Chinese chicken drummettes tossed in schezwan glaze', photoUrl: '/menu-images/krish_chicken_lollipop_3pcs.jpg' },
  { name: 'Chicken Lollipop (6pcs)', category: 'Fried Chicken', price: 150, isVeg: false, description: '6 jumbo crispy chicken lollipops with hot garlic dip', photoUrl: '/menu-images/krish_chicken_lollipop_6pcs.jpg' },
  { name: 'Chicken Wings (4pcs)', category: 'Fried Chicken', price: 120, isVeg: false, description: 'Deep fried crispy chicken wings with tangy BBQ seasoning', photoUrl: '/menu-images/krish_chicken_wings_4pcs.jpg' },
  { name: 'Chicken Wings (6pcs)', category: 'Fried Chicken', price: 150, isVeg: false, description: '6 juicy crispy fried chicken wings with spicy herb dust', photoUrl: '/menu-images/krish_chicken_wings_6pcs.jpg' },

  // --- CAFE MENU: FRENCH FRIES ---
  { name: 'French Fries', category: 'French Fries', price: 50, isVeg: true, description: 'Classic crispy golden salted potato fries', photoUrl: '/menu-images/A_07_01_french_fries.png' },
  { name: 'Peri Peri Fries', category: 'French Fries', price: 60, isVeg: true, description: 'Crispy fries tossed in hot African peri peri spice mix', photoUrl: '/menu-images/A_07_02_peri_peri_fries.png' },
  { name: 'French Fries Loaded', category: 'French Fries', price: 119, isVeg: true, description: 'Melted cheese sauce, jalapeños, and spiced mayonnaise overload', photoUrl: '/menu-images/A_07_03_loaded_french_fries.png' },
  { name: 'French Fries Lays Loaded', category: 'French Fries', price: 149, isVeg: true, description: 'Crunchy potato chips, loaded fries, cheese burst & herb dressing', photoUrl: '/menu-images/A_07_04_lays_loaded_fries.png' },
  { name: 'Lays Chicken', category: 'French Fries', price: 40, isVeg: false, description: 'Crunchy crushed Lays topped with crispy chicken popcorn bites', photoUrl: '/menu-images/A_07_05_lays_chicken.png' },

  // --- CAFE MENU: SANDWICH ---
  { name: 'Chicken Sandwich', category: 'Sandwich', price: 89, isVeg: false, description: 'Grilled bread packed with shredded spiced chicken, veggies & mayo', photoUrl: '/menu-images/A_07_06_chicken_sandwich.png' },
  { name: 'Paneer Sandwich', category: 'Sandwich', price: 89, isVeg: true, description: 'Toasted sandwich filled with spiced cottage cheese cubes & chutney', photoUrl: '/menu-images/A_07_07_paneer_sandwich.png' },
  { name: 'Veg Sandwich', category: 'Sandwich', price: 79, isVeg: true, description: 'Fresh garden cucumbers, tomatoes, bell peppers & mint mayonnaise', photoUrl: '/menu-images/A_07_08_veg_sandwich.png' },
  { name: 'Fried Chicken Sandwich', category: 'Sandwich', price: 99, isVeg: false, description: 'Golden crispy chicken fillet inside toasted buttered bread', photoUrl: '/menu-images/A_07_09_fried_chicken_sandwich.png' },

  // --- CAFE MENU: SNACKS ---
  { name: 'Chicken Popcorn', category: 'Snacks', price: 80, isVeg: false, description: 'Bite-sized seasoned chicken crunchies with spicy dip', photoUrl: '/menu-images/B_04_03_chicken_popcorn.png' },
  { name: 'Chicken Nuggets', category: 'Snacks', price: 80, isVeg: false, description: 'Tender seasoned minced chicken nuggets fried to golden perfection', photoUrl: '/menu-images/krish_chicken_nuggets.jpg' },

  // --- CAFE MENU: BUN ---
  { name: 'Jam Bun', category: 'Bun', price: 39, isVeg: true, description: 'Soft sweet bakery bun slathered with mixed fruit jam', photoUrl: '/menu-images/B_04_04_jam_bun.png' },
  { name: 'Butter Bun', category: 'Bun', price: 49, isVeg: true, description: 'Fluffy warm bun generously spread with fresh butter', photoUrl: '/menu-images/krish_butter_bun.jpg' },
  { name: 'Bun Butter Jam', category: 'Bun', price: 59, isVeg: true, description: 'The legendary combo of soft bun with rich butter & sweet jam', photoUrl: '/menu-images/krish_bun_butter_jam.jpg' },

  // --- CAFE MENU: MAGGI ---
  { name: 'Masala Maggi', category: 'Maggi', price: 49, isVeg: true, description: 'Classic 2-minute noodles tossed with spicy butter masala & veggies', photoUrl: '/menu-images/krish_masala_maggi.jpg' },
  { name: 'Egg Maggi', category: 'Maggi', price: 59, isVeg: false, description: 'Hot soupy masala noodles scrambled with farm-fresh egg', photoUrl: '/menu-images/krish_egg_maggi.jpg' },
  { name: 'Chicken Maggi', category: 'Maggi', price: 69, isVeg: false, description: 'Loaded with juicy shredded chicken pieces and roasted masala', photoUrl: '/menu-images/krish_chicken_maggi.jpg' },

  // --- CAFE MENU: BREAD OMBLATE ---
  { name: 'Bread Omblate', category: 'Bread Omblate', price: 50, isVeg: false, description: 'Street-style spiced egg omelette wrapped around toasted bread slices', photoUrl: '/menu-images/B_04_05_bread_omblate.png' },

  // ==========================================
  // --- RESTAURANT MENU: BRIYANI ---
  // ==========================================
  { name: 'Chicken Briyani', category: 'Briyani', price: 100, isVeg: false, description: 'Fragrant seeraga samba rice cooked with tender chicken and aromatic herbs', photoUrl: '/menu-images/B_01_01_chicken_biryani.png' },
  { name: 'Chicken 65 Briyani', category: 'Briyani', price: 110, isVeg: false, description: 'Flavorful briyani rice topped with crispy spicy chicken 65 pieces', photoUrl: '/menu-images/B_01_02_chicken_65_biryani.png' },
  { name: 'Chicken Gilma Briyani', category: 'Briyani', price: 140, isVeg: false, description: 'Krish special signature spicy gravy-tossed chicken briyani', photoUrl: '/menu-images/B_01_03_chicken_gilma_biryani.png' },
  { name: 'MT Briyani', category: 'Briyani', price: 80, isVeg: false, description: 'Kuska briyani rice simmered in rich chicken broth and spices', photoUrl: '/menu-images/B_01_04_mt_biryani.png' },

  // --- RESTAURANT MENU: FRIED RICE ---
  { name: 'Chicken Fried Rice', category: 'Fried Rice', price: 110, isVeg: false, description: 'Wok-tossed basmati rice with diced chicken, eggs and scallions', photoUrl: '/menu-images/B_01_05_chicken_fried_rice.png' },
  { name: 'Chicken Schezwan Rice', category: 'Fried Rice', price: 130, isVeg: false, description: 'Fiery wok fried rice with chicken in home-made schezwan chili sauce', photoUrl: '/menu-images/krish_chicken_schezwan_rice.jpg' },
  { name: 'Egg Fried Rice', category: 'Fried Rice', price: 90, isVeg: false, description: 'Aromatic wok tossed rice with scrambled egg, white pepper & greens', photoUrl: '/menu-images/A_01_06_egg_fried_rice.png' },
  { name: 'Veg Fried Rice', category: 'Fried Rice', price: 80, isVeg: true, description: 'Crunchy carrots, beans, and cabbage tossed with aromatic rice', photoUrl: '/menu-images/A_01_07_veg_fried_rice.png' },
  { name: 'Paneer Fried Rice', category: 'Fried Rice', price: 110, isVeg: true, description: 'Golden paneer cubes wok-tossed with fragrant spiced fried rice', photoUrl: '/menu-images/A_02_01_paneer_fried_rice.png' },
  { name: 'Cauliflower Fried Rice', category: 'Fried Rice', price: 110, isVeg: true, description: 'Crispy gobi florets tossed with pepper fried rice', photoUrl: '/menu-images/A_02_02_cauliflower_fried_rice.png' },

  // --- RESTAURANT MENU: NOODLES ---
  { name: 'Chicken Noodles', category: 'Noodles', price: 110, isVeg: false, description: 'Wok-stirred egg noodles with shredded chicken and oriental veggies', photoUrl: '/menu-images/B_02_01_chicken_noodles.png' },
  { name: 'Chicken Schezwan Noodles', category: 'Noodles', price: 130, isVeg: false, description: 'Spicy wok tossed noodles with chicken and fiery schezwan peppers', photoUrl: '/menu-images/B_02_02_chicken_schezwan_noodles.png' },
  { name: 'Egg Noodles', category: 'Noodles', price: 90, isVeg: false, description: 'Classic street-style noodles with scrambled egg and spring onion', photoUrl: '/menu-images/A_02_05_egg_noodles.png' },
  { name: 'Veg Noodles', category: 'Noodles', price: 80, isVeg: true, description: 'Soft wheat noodles stir fried with julienned vegetables and soy', photoUrl: '/menu-images/B_02_03_veg_noodles.png' },
  { name: 'Paneer Noodles', category: 'Noodles', price: 110, isVeg: true, description: 'Golden cottage cheese strips stir-fried with seasoned noodles', photoUrl: '/menu-images/B_02_04_paneer_noodles.png' },
  { name: 'Cauliflower Noodles', category: 'Noodles', price: 110, isVeg: true, description: 'Crunchy battered cauliflower tossed with street style noodles', photoUrl: '/menu-images/B_02_05_cauliflower_noodles.png' },

  // --- RESTAURANT MENU: OTHERS ---
  { name: 'Curd Rice + Chicken 65', category: 'Others', price: 110, isVeg: false, description: 'Cooling tempered curd rice served with hot crunchy Chicken 65', photoUrl: '/menu-images/B_03_04_curd_rice_chicken_65.png' },
  { name: 'Chilli Parotta', category: 'Others', price: 100, isVeg: true, description: 'Shredded crispy parotta tossed in spicy onion-capsicum chili gravy', photoUrl: '/menu-images/B_03_05_chilli_parotta.png' },
  { name: 'Mutta Parotta', category: 'Others', price: 80, isVeg: false, description: 'Egg kothu parotta minced on tawa with salna and green chilies', photoUrl: '/menu-images/A_03_07_mutta_parotta.png' },
  { name: 'Chicken Mutta Parotta', category: 'Others', price: 100, isVeg: false, description: 'Minced chicken and egg kothu parotta with aromatic spices', photoUrl: '/menu-images/A_04_01_chicken_mutta_parotta.png' },
  { name: 'Chicken Chilly', category: 'Others', price: 60, isVeg: false, description: 'Tender chicken bites stir-fried with green chilies and curry leaves', photoUrl: '/menu-images/A_04_02_chicken_chilly.png' },
  { name: 'Paneer 65', category: 'Others', price: 80, isVeg: true, description: 'Crispy deep-fried paneer cubes spiced with South Indian masala', photoUrl: '/menu-images/A_04_03_paneer_65.png' },

  // --- RESTAURANT MENU: OMBLATE ---
  { name: 'Omblate', category: 'Omblate', price: 20, isVeg: false, description: 'Fluffy double egg omelette with diced onions, green chili and pepper', photoUrl: '/menu-images/B_03_01_omblate.png' },
  { name: 'Half Boiled', category: 'Omblate', price: 20, isVeg: false, description: 'Sunny side up runny egg yolk sprinkled with crushed black pepper', photoUrl: '/menu-images/B_03_02_half_boiled.png' },
  { name: 'Podi Mass', category: 'Omblate', price: 20, isVeg: false, description: 'Spiced South Indian egg scramble with shallots and curry leaves', photoUrl: '/menu-images/B_03_03_podi_mass.png' },
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
  const existingByName = new Map((currentMenu || []).map((m) => [m.name.toLowerCase(), m]));

  console.log(`Current menu has ${currentMenu.length} items. Syncing KRISH catalog & dish photos...`);
  let added = 0;
  let updated = 0;

  for (const item of KRISH_ITEMS) {
    const existing = existingByName.get(item.name.toLowerCase());
    if (existing) {
      if (existing.photo_url !== item.photoUrl) {
        const upRes = await fetch(`${API_BASE}/admin/menu/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ photoUrl: item.photoUrl })
        });
        if (upRes.ok) {
          updated++;
          console.log(`~ Updated image: [${item.category}] ${item.name} -> ${item.photoUrl}`);
        } else {
          console.warn(`! Failed to update ${item.name}: ${upRes.status}`);
        }
      }
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

  console.log(`\n🎉 Seed completed! Added ${added} new items and updated ${updated} dish images in the database.`);
}

seed().catch(console.error);
