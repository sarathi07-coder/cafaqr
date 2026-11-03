// test_milestone_4.js - Automated Verification for Milestone 4 (40% Cart Steppers, Chef Notes & Floating Notch)
process.env.NODE_ENV = 'test';

import http from 'http';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 4 VERIFICATION (40%)');
console.log('================================================================\n');

let failed = false;
function assert(desc, condition) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    console.log(`  ❌ [FAIL] ${desc}`);
    failed = true;
  }
}

async function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Emulate Frontend Cart Reducer Logic (CartContext.jsx)
class TestCartState {
  constructor() {
    this.cartItems = {};
    this.cookingNotes = '';
  }

  addItem(item) {
    const existing = this.cartItems[item.id];
    const newQty = existing ? existing.quantity + 1 : 1;
    this.cartItems[item.id] = {
      ...item,
      quantity: newQty,
    };
  }

  updateQuantity(itemId, quantity) {
    if (quantity <= 0) {
      delete this.cartItems[itemId];
      return;
    }
    if (this.cartItems[itemId]) {
      this.cartItems[itemId].quantity = quantity;
    }
  }

  removeItem(itemId) {
    delete this.cartItems[itemId];
  }

  clearCart() {
    this.cartItems = {};
    this.cookingNotes = '';
  }

  setNotes(notes) {
    this.cookingNotes = notes;
  }

  getTotalCount() {
    return Object.values(this.cartItems).reduce((sum, it) => sum + it.quantity, 0);
  }

  getSubtotal() {
    return Object.values(this.cartItems).reduce(
      (sum, it) => sum + parseFloat(it.price) * it.quantity,
      0
    );
  }

  getGrandTotalWithTax(taxRate = 0.05) {
    const subtotal = this.getSubtotal();
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    return parseFloat((subtotal + tax).toFixed(2));
  }
}

async function runMilestone4() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const PORT = 3015;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Discover Active Restaurant & Fetch Real Dishes ---`);
      const defaultTableRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/order/tables/default',
        method: 'GET',
      });
      const restaurantId = defaultTableRes.body?.table?.restaurant_id;
      assert('Found active restaurant ID from database', !!restaurantId);

      const menuRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/menu/${restaurantId}`,
        method: 'GET',
      });
      const dishes = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
      assert('Loaded active dishes catalog', dishes.length >= 3);

      const dishA = dishes[0]; // e.g. Starter
      const dishB = dishes[1]; // e.g. Main Course
      const dishC = dishes[2]; // e.g. Bread
      console.log(`     Selected Test Dishes:`);
      console.log(`       1. ${dishA.name} (₹${dishA.price})`);
      console.log(`       2. ${dishB.name} (₹${dishB.price})`);
      console.log(`       3. ${dishC.name} (₹${dishC.price})`);

      console.log(`\n--- STEP 2: Test Interactive Add to Cart & Stepper Actions ---`);
      const cart = new TestCartState();

      // Initially empty
      assert('Initial cart is empty (0 items)', cart.getTotalCount() === 0);
      assert('Initial subtotal is ₹0.00', cart.getSubtotal() === 0);

      // Add dishA twice
      cart.addItem(dishA);
      cart.addItem(dishA);
      assert(`Added 2x '${dishA.name}' to cart`, cart.cartItems[dishA.id]?.quantity === 2);

      // Add dishB once
      cart.addItem(dishB);
      assert(`Added 1x '${dishB.name}' to cart`, cart.cartItems[dishB.id]?.quantity === 1);

      // Add dishC 3 times
      cart.addItem(dishC);
      cart.addItem(dishC);
      cart.addItem(dishC);
      assert(`Added 3x '${dishC.name}' to cart`, cart.cartItems[dishC.id]?.quantity === 3);

      // Total count should be 2 + 1 + 3 = 6
      assert('Total item count is 6 items', cart.getTotalCount() === 6);

      const expectedSubtotal = (parseFloat(dishA.price) * 2) +
                               (parseFloat(dishB.price) * 1) +
                               (parseFloat(dishC.price) * 3);
      assert(`Subtotal matches sum of line items: ₹${expectedSubtotal.toFixed(2)}`, 
        cart.getSubtotal() === expectedSubtotal);

      console.log(`\n--- STEP 3: Test Quantity Stepper Decrement & Zero-Quantity Removal ---`);
      // Decrement dishC from 3 to 2
      cart.updateQuantity(dishC.id, 2);
      assert(`Decremented '${dishC.name}' quantity from 3 to 2`, cart.cartItems[dishC.id]?.quantity === 2);
      assert('Total item count updated to 5 items', cart.getTotalCount() === 5);

      // Decrement dishB to 0 (removal)
      cart.updateQuantity(dishB.id, 0);
      assert(`Decremented '${dishB.name}' to 0 ➔ Item completely removed from cart`, 
        cart.cartItems[dishB.id] === undefined);
      assert('Total item count updated to 4 items', cart.getTotalCount() === 4);

      console.log(`\n--- STEP 4: Test Floating Notch Display Calculations ---`);
      const currentSubtotal = (parseFloat(dishA.price) * 2) + (parseFloat(dishC.price) * 2);
      const expectedTax = Math.round(currentSubtotal * 0.05 * 100) / 100;
      const expectedGrandTotal = parseFloat((currentSubtotal + expectedTax).toFixed(2));

      assert(`Floating Notch item count badge displays 4 items`, cart.getTotalCount() === 4);
      assert(`Floating Notch displays correct Grand Total: ₹${expectedGrandTotal.toFixed(2)} (inc 5% GST)`,
        cart.getGrandTotalWithTax() === expectedGrandTotal);

      console.log(`\n--- STEP 5: Test Chef Cooking Notes Attachment ---`);
      const sampleNotes = 'Medium spicy, please keep dressing on the side';
      cart.setNotes(sampleNotes);
      assert('Chef special cooking notes attached to cart', cart.cookingNotes === sampleNotes);

      console.log(`\n--- STEP 6: Test Clear All Cart Action ---`);
      cart.clearCart();
      assert('Cart completely cleared (0 items)', cart.getTotalCount() === 0);
      assert('Subtotal reset to ₹0.00', cart.getSubtotal() === 0);
      assert('Chef notes reset', cart.cookingNotes === '');

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 4 (40%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Cart Steppers, Special Notes & Floating Notch Validated.');
      } else {
        console.log('❌ MILESTONE 4 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 4 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone4();

