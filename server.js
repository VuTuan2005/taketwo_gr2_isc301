const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, initDatabase } = require('./db');

// Initialize database schema and seeds
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to get current active user (default to User 1 - Tuấn if not specified)
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.user_id || 1;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  req.currentUser = user || db.prepare('SELECT * FROM users WHERE id = 1').get();
  next();
});

// Periodic background check for 5-day auto confirmations
function checkAutoConfirmations() {
  const now = new Date().toISOString();
  const expiredOrders = db.prepare(`
    SELECT * FROM orders 
    WHERE status = 'DELIVERING' 
      AND escrow_status = 'HELD' 
      AND auto_confirm_deadline IS NOT NULL 
      AND auto_confirm_deadline <= ?
  `).all(now);

  for (const order of expiredOrders) {
    console.log(`[Auto-Confirm 5-Day SLA] Order ${order.order_code} reached deadline without dispute. Auto-completing...`);
    completeOrderFunds(order, 'COMPLETED_AUTO');
  }
}

// Helper: Complete order and release Escrow funds with 3% platform commission
function completeOrderFunds(order, finalStatus = 'COMPLETED') {
  // 1. Deduct Escrow from Buyer
  const buyerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.buyer_id);
  if (buyerWallet && buyerWallet.escrow_balance >= order.total_paid) {
    db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, updated_at = datetime('now') WHERE id = ?")
      .run(order.total_paid, buyerWallet.id);
  }

  // 2. Calculate 3% commission on product amount
  const commission = Math.round(order.amount * 0.03);
  const sellerPayout = (order.amount - commission) + order.shipping_fee;

  // 3. Add to Seller Available Balance
  const sellerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.seller_id);
  if (sellerWallet) {
    const newBal = sellerWallet.available_balance + sellerPayout;
    db.prepare("UPDATE wallets SET available_balance = available_balance + ?, updated_at = datetime('now') WHERE id = ?")
      .run(sellerPayout, sellerWallet.id);

    // Ledger for seller
    const vCode = 'PT-ESC-' + Math.floor(100000 + Math.random() * 900000);
    db.prepare(`
      INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
      VALUES (?, 'ESCROW_RELEASE', 'IN', ?, 'Két Escrow TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      sellerWallet.id,
      vCode,
      sellerPayout,
      sellerWallet.available_balance,
      newBal,
      order.order_code,
      `Nhận tiền đơn ${order.order_code} (Đã trừ 3% phí sàn: -${commission.toLocaleString('vi-VN')}đ, cộng ship +${order.shipping_fee.toLocaleString('vi-VN')}đ)`
    );
  }

  // 4. Update order status
  db.prepare(`
    UPDATE orders 
    SET status = ?, escrow_status = 'RELEASED', buyer_confirmed = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(finalStatus, order.id);

  // 5. Update product status
  db.prepare("UPDATE products SET status = 'SOLD' WHERE id = ?").run(order.product_id);

  // 6. Update Eco points & Review count
  db.prepare('UPDATE users SET eco_points = eco_points + 50, co2_saved_kg = co2_saved_kg + 2.5 WHERE id = ?').run(order.buyer_id);
  db.prepare('UPDATE users SET review_count = review_count + 1 WHERE id = ?').run(order.seller_id);
}

// -------------------------------------------------------------
// USER & AUTH APIS
// -------------------------------------------------------------
app.get('/api/me', (req, res) => {
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  res.json({
    user: req.currentUser,
    wallet: wallet || { available_balance: 0, escrow_balance: 0 }
  });
});

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, campus, student_code, rating_avg, avatar_url FROM users').all();
  res.json(users);
});

// -------------------------------------------------------------
// PRODUCT LISTINGS APIS
// -------------------------------------------------------------
app.get('/api/products', (req, res) => {
  checkAutoConfirmations();
  const { category, campus, search, condition, status, seller_id } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, c.icon as category_icon, 
           u.name as seller_name, u.email as seller_email, u.rating_avg as seller_rating, u.avatar_url as seller_avatar
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (category && category !== 'all') {
    query += ' AND p.category_id = ?';
    params.push(category);
  }

  if (campus && campus !== 'all') {
    query += ' AND p.campus_cluster = ?';
    params.push(campus);
  }

  if (condition && condition !== 'all') {
    query += ' AND p.condition_level = ?';
    params.push(condition);
  }

  if (status && status !== 'all') {
    query += ' AND p.status = ?';
    params.push(status);
  } else if (!seller_id) {
    // By default on public feed, don't show HIDDEN
    query += " AND p.status != 'HIDDEN'";
  }

  if (seller_id) {
    query += ' AND p.seller_id = ?';
    params.push(seller_id);
  }

  if (search && search.trim() !== '') {
    query += ' AND (p.title LIKE ? OR p.defect_note LIKE ? OR p.meetup_location LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  // Sorting: Promoted first (is_promoted DESC), then newly created
  query += ' ORDER BY p.is_promoted DESC, p.id DESC';

  const products = db.prepare(query).all(...params);
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.icon as category_icon,
           u.name as seller_name, u.email as seller_email, u.rating_avg as seller_rating, 
           u.review_count as seller_reviews, u.campus as seller_campus, u.avatar_url as seller_avatar
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.seller_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // Increment view counter naturally
  db.prepare('UPDATE products SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);

  res.json(product);
});

app.post('/api/products', (req, res) => {
  const { title, category_id, price, original_price, condition_level, defect_note, campus_cluster, meetup_location, image_url } = req.body;
  if (!title || !category_id || !price || !condition_level || !campus_cluster || !meetup_location) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc' });
  }

  const defaultImg = image_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80';

  const result = db.prepare(`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, is_promoted, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', 0, 0, 1, datetime('now'))
  `).run(
    req.currentUser.id,
    category_id,
    title,
    parseInt(price, 10),
    original_price ? parseInt(original_price, 10) : null,
    condition_level,
    defect_note || 'Không có khuyết điểm đáng chú ý.',
    campus_cluster,
    meetup_location,
    defaultImg
  );

  res.json({ success: true, product_id: result.lastInsertRowid, message: 'Đăng tin thành công!' });
});

// -------------------------------------------------------------
// BUMP POST & PACKAGES APIS (1-Click Boost via Wallet)
// -------------------------------------------------------------
app.get('/api/bump-packages', (req, res) => {
  const packages = db.prepare('SELECT * FROM bump_packages ORDER BY price ASC').all();
  res.json(packages);
});

app.post('/api/products/:id/bump', (req, res) => {
  const productId = req.params.id;
  const { package_id } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // In presentation / demo mode, allow users to boost their own items or promote items for testing
  // (Deduction is made strictly from req.currentUser's wallet/boost_credits)

  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, 0, 0, 0, datetime('now'))")
      .run(req.currentUser.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  }

  let message = '';
  let newBal = wallet.available_balance;

  // Nếu có package_id cụ thể được truyền lên
  if (package_id) {
    const pkg = db.prepare('SELECT * FROM bump_packages WHERE id = ?').get(package_id);
    if (!pkg) return res.status(400).json({ error: 'Gói đẩy tin không hợp lệ' });

    if (wallet.available_balance < pkg.price) {
      return res.status(400).json({ 
        error: `Số dư ví không đủ (${wallet.available_balance.toLocaleString('vi-VN')}đ). Cần ${pkg.price.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào ví!` 
      });
    }

    newBal = wallet.available_balance - pkg.price;
    db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBal, wallet.id);

    const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
    db.prepare(`
      INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
      VALUES (?, 'BUMP_PAYMENT', 'OUT', ?, 'Ví TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
    `).run(wallet.id, bumpVoucher, -pkg.price, wallet.available_balance, newBal, pkg.id, `Mua ${pkg.name} đẩy bài "${product.title.substring(0, 30)}..." (Trừ ví tức thì)`);

    const badge = pkg.has_badge_hot ? 'HOT' : (pkg.id === 'bump_pro' ? 'PRO' : null);
    db.prepare(`
      UPDATE products 
      SET is_promoted = 1, promoted_badge = ?, bump_count = bump_count + ?, created_at = datetime('now')
      WHERE id = ?
    `).run(badge, pkg.bump_credits, productId);

    message = `Đã đẩy bài thành công bằng ${pkg.name}! Bài viết đã được đưa lên Top 1.`;
  } else {
    // 1-Click Bump trực tiếp trên thẻ: ưu tiên trừ 1 lượt boost_credits
    if (wallet.boost_credits > 0) {
      const newCredits = wallet.boost_credits - 1;
      db.prepare("UPDATE wallets SET boost_credits = ?, updated_at = datetime('now') WHERE id = ?").run(newCredits, wallet.id);

      const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, 'USE_BOOST', 'OUT', ?, 'Lượt Đẩy VIP', 0, ?, ?, 'BOOST', ?, datetime('now'))
      `).run(wallet.id, bumpVoucher, wallet.available_balance, wallet.available_balance, `Sử dụng 1 lượt đẩy bài VIP cho "${product.title.substring(0, 30)}..."`);

      db.prepare(`
        UPDATE products 
        SET is_promoted = 1, promoted_badge = 'HOT', bump_count = bump_count + 1, created_at = datetime('now')
        WHERE id = ?
      `).run(productId);

      message = `Đẩy bài thành công! Đã trừ 1 lượt đẩy VIP (Còn lại: ${newCredits} lượt). Bài viết đã nhảy lên vị trí Top 1!`;
    } else {
      // Nếu hết lượt, kiểm tra số dư ví 15.000đ
      if (wallet.available_balance < 15000) {
        return res.status(400).json({
          error: `Bạn đã hết lượt đẩy bài và số dư ví (${wallet.available_balance.toLocaleString('vi-VN')}đ) không đủ 15.000đ. Vui lòng nạp thêm tiền vào ví!`
        });
      }

      newBal = wallet.available_balance - 15000;
      db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?").run(newBal, wallet.id);

      const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, 'BUMP_PAYMENT', 'OUT', ?, 'Ví TakeTwo', -15000, ?, ?, 'bump_single', ?, datetime('now'))
      `).run(wallet.id, bumpVoucher, wallet.available_balance, newBal, `Trừ 15.000đ từ ví để đẩy bài "${product.title.substring(0, 30)}..." lên Top 1`);

      db.prepare(`
        UPDATE products 
        SET is_promoted = 1, promoted_badge = 'HOT', bump_count = bump_count + 1, created_at = datetime('now')
        WHERE id = ?
      `).run(productId);

      message = `Hết lượt VIP - Đã trừ 15.000đ từ Ví TakeTwo và đưa bài viết lên Top 1 thành công!`;
    }
  }

  res.json({
    success: true,
    message,
    remaining_balance: newBal
  });
});

// Mua gói đẩy bài trực tiếp
app.post('/api/bump-packages/buy', (req, res) => {
  const { package_id } = req.body;
  const pkg = db.prepare('SELECT * FROM bump_packages WHERE id = ?').get(package_id);
  if (!pkg) return res.status(404).json({ error: 'Gói đẩy tin không hợp lệ' });

  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet || wallet.available_balance < pkg.price) {
    return res.status(400).json({
      error: `Số dư ví không đủ (${wallet ? wallet.available_balance.toLocaleString('vi-VN') : 0}đ). Cần ${pkg.price.toLocaleString('vi-VN')}đ để mua gói. Vui lòng nạp thêm tiền vào ví!`
    });
  }

  const newBal = wallet.available_balance - pkg.price;
  const newCredits = (wallet.boost_credits || 0) + pkg.bump_credits;
  db.prepare("UPDATE wallets SET available_balance = ?, boost_credits = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBal, newCredits, wallet.id);

  const bumpVoucher = 'PC-BMP-' + Math.floor(100000 + Math.random() * 900000);
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'BUY_BOOST', 'OUT', ?, 'Ví TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    bumpVoucher,
    -pkg.price,
    wallet.available_balance,
    newBal,
    pkg.id,
    `Mua ${pkg.name} (+${pkg.bump_credits} lượt đẩy bài VIP)`
  );

  res.json({
    success: true,
    message: `Mua thành công ${pkg.name}! Nhận được +${pkg.bump_credits} lượt đẩy bài VIP.`,
    boost_credits: newCredits,
    remaining_balance: newBal
  });
});

// -------------------------------------------------------------
// WALLET & VIETQR TRANSACTION APIS
// -------------------------------------------------------------
// -------------------------------------------------------------
// WALLET & FINTAB THU CHI (TRANSACTIONS / DEPOSIT) APIS
// -------------------------------------------------------------
app.get('/api/wallet', (req, res) => {
  let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet) {
    db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, updated_at) VALUES (?, 0, 0, datetime('now'))")
      .run(req.currentUser.id);
    wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  }

  const transactions = db.prepare('SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY id DESC LIMIT 50')
    .all(wallet.id);

  res.json({
    wallet,
    transactions
  });
});

// Dedicated Fintab Thu Chi (Deposit / Transactions) Endpoint
function handleTransactionsLedger(req, res) {
  console.log('>>> [SERVER] Incoming request to transactions/ledger:', req.query);
  try {
    const user = req.currentUser || db.prepare('SELECT * FROM users LIMIT 1').get() || { id: 1, role: 'BUYER' };
    const { tab, search, view_all } = req.query;
    const isGlobalView = view_all === 'true' || user.role === 'ADMIN';

    let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id);
    if (!wallet) {
      wallet = { id: 0, available_balance: 0, escrow_balance: 0 };
    }

    let query = `
      SELECT wt.*, u.name as user_name, u.student_code as user_student_code, u.email as user_email
      FROM wallet_transactions wt
      JOIN wallets w ON wt.wallet_id = w.id
      JOIN users u ON w.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!isGlobalView) {
      query += ' AND wt.wallet_id = ?';
      params.push(wallet.id);
    }

    if (tab === 'deposit') {
      query += " AND wt.flow_type = 'IN'";
    } else if (tab === 'payment') {
      query += " AND wt.flow_type = 'OUT'";
    } else if (tab === 'escrow') {
      query += " AND wt.flow_type = 'HOLD'";
    }

    if (search && search.trim() !== '') {
      query += " AND (wt.voucher_code LIKE ? OR wt.reference_id LIKE ? OR wt.description LIKE ?)";
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY wt.id DESC LIMIT 100';
    const items = db.prepare(query).all(...params);

    // Calculate summary totals
    let sumQuery = `SELECT 
      COALESCE(SUM(CASE WHEN flow_type = 'IN' THEN amount ELSE 0 END), 0) as total_in,
      COALESCE(SUM(CASE WHEN flow_type = 'OUT' THEN ABS(amount) ELSE 0 END), 0) as total_out
      FROM wallet_transactions wt WHERE 1=1`;
    const sumParams = [];
    if (!isGlobalView) {
      sumQuery += ' AND wt.wallet_id = ?';
      sumParams.push(wallet.id);
    }
    const sums = db.prepare(sumQuery).get(...sumParams);

    res.json({
      items,
      stats: {
        total_income: sums.total_in,
        total_expense: sums.total_out,
        available_balance: wallet.available_balance,
        escrow_balance: wallet.escrow_balance
      }
    });
  } catch (err) {
    console.error('Error in /api/transactions:', err);
    res.status(500).json({ error: err.message, items: [], stats: {} });
  }
}

app.get('/api/transactions', handleTransactionsLedger);
app.get('/api/ledger', handleTransactionsLedger);

app.post('/api/wallet/topup', (req, res) => {
  const { amount, bank_name } = req.body;
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount < 10000) {
    return res.status(400).json({ error: 'Số tiền nạp tối thiểu là 10.000 VNĐ' });
  }

  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  const newBal = wallet.available_balance + numAmount;

  db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBal, wallet.id);

  const refCode = 'VQR-' + Math.floor(100000 + Math.random() * 900000);
  const voucherCode = 'PT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(10 + Math.random() * 90);

  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'TOPUP', 'IN', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    voucherCode,
    `VietQR ${bank_name || 'MBBank'}`,
    numAmount,
    wallet.available_balance,
    newBal,
    refCode,
    `Nạp tiền vào ví TakeTwo qua VietQR ${bank_name || 'MBBank'}`
  );

  res.json({
    success: true,
    message: `Nạp thành công +${numAmount.toLocaleString('vi-VN')} VNĐ vào ví!`,
    voucher_code: voucherCode,
    new_balance: newBal
  });
});

app.post('/api/wallet/withdraw', (req, res) => {
  const { amount, bank_account, bank_name } = req.body;
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount < 20000) {
    return res.status(400).json({ error: 'Số tiền rút tối thiểu là 20.000 VNĐ' });
  }

  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (wallet.available_balance < numAmount) {
    return res.status(400).json({ error: 'Số dư khả dụng không đủ để rút tiền' });
  }

  const newBal = wallet.available_balance - numAmount;
  db.prepare("UPDATE wallets SET available_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBal, wallet.id);

  const refCode = 'WDR-' + Math.floor(100000 + Math.random() * 900000);
  const voucherCode = 'PC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(10 + Math.random() * 90);

  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'WITHDRAW', 'OUT', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    voucherCode,
    `STK ${bank_account || 'xxxx'} (${bank_name || 'Ngân hàng'})`,
    -numAmount,
    wallet.available_balance,
    newBal,
    refCode,
    `Rút tiền về STK ${bank_account || 'xxxx'} (${bank_name || 'Ngân hàng'}) - Hoàn tất tức thì`
  );

  res.json({
    success: true,
    message: `Rút tiền thành công! ${numAmount.toLocaleString('vi-VN')} VNĐ đã được chuyển về tài khoản ngân hàng của bạn.`,
    voucher_code: voucherCode,
    remaining_balance: newBal
  });
});

// -------------------------------------------------------------
// CHECKOUT & ESCROW ORDER APIS
// -------------------------------------------------------------
app.post('/api/orders/checkout', (req, res) => {
  const { product_id, delivery_type, delivery_address, recipient_name, recipient_phone } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
  if (product.status !== 'AVAILABLE') {
    return res.status(400).json({ error: 'Sản phẩm này hiện đang được giữ chỗ hoặc đã bán' });
  }

  // Self-buy prevention
  if (product.seller_id === req.currentUser.id) {
    return res.status(400).json({ error: 'Bạn không thể tự mua sản phẩm do chính mình đăng bán' });
  }

  let shippingFee = 0;
  if (delivery_type === 'COURIER_EXPRESS') {
    shippingFee = 25000;
  } else if (delivery_type === 'COURIER_ROOM' || delivery_type === 'COURIER') {
    shippingFee = 15000;
  }
  const isCourier = shippingFee > 0;
  const discount = 5000; // 5k voucher for students
  const totalPaid = (product.price + shippingFee) - discount;

  // Check buyer wallet
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.currentUser.id);
  if (!wallet || wallet.available_balance < totalPaid) {
    return res.status(400).json({
      error: `Số dư ví không đủ (hiện có ${wallet ? wallet.available_balance.toLocaleString('vi-VN') : 0}đ). Cần ${totalPaid.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm tiền vào ví!`
    });
  }

  // Deduct from available balance, lock into escrow balance
  const newAvail = wallet.available_balance - totalPaid;
  const newEscrow = wallet.escrow_balance + totalPaid;
  db.prepare("UPDATE wallets SET available_balance = ?, escrow_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newAvail, newEscrow, wallet.id);

  const orderCode = 'TK-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(10 + Math.random() * 90);

  // Log transaction
  const holdVoucher = 'PC-HLD-' + Math.floor(100000 + Math.random() * 900000);
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, 'ESCROW_HOLD', 'HOLD', ?, 'Ví TakeTwo Escrow', ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    wallet.id,
    holdVoucher,
    -totalPaid,
    wallet.available_balance,
    newAvail,
    orderCode,
    `Tạm giữ tiền mua "${product.title.substring(0, 30)}..." trong Két Escrow TakeTwo (An toàn 100%)`
  );

  // Lock product to RESERVED
  db.prepare("UPDATE products SET status = 'RESERVED' WHERE id = ?").run(product.id);

  // Create order
  const orderResult = db.prepare(`
    INSERT INTO orders (
      order_code, product_id, buyer_id, seller_id, amount, shipping_fee, discount, total_paid,
      delivery_type, delivery_address, recipient_name, recipient_phone, tracking_code,
      payment_method, status, escrow_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WALLET_ESCROW', 'REQUESTED', 'HELD', datetime('now'), datetime('now'))
  `).run(
    orderCode,
    product.id,
    req.currentUser.id,
    product.seller_id,
    product.price,
    shippingFee,
    discount,
    totalPaid,
    delivery_type,
    delivery_address || (isCourier ? 'KTX Trường' : product.meetup_location),
    recipient_name || req.currentUser.name,
    recipient_phone || '0987654321',
    isCourier ? ('TK-EXP-' + Math.floor(1000 + Math.random() * 9000)) : 'MEETUP-DIRECT'
  );

  res.json({
    success: true,
    order_id: orderResult.lastInsertRowid,
    order_code: orderCode,
    message: 'Thanh toán Escrow thành công! Tiền đang được bảo vệ an toàn trong két TakeTwo.'
  });
});

app.get('/api/orders', (req, res) => {
  checkAutoConfirmations();
  const { role } = req.query; // 'buyer', 'seller', or 'admin'

  let query = `
    SELECT o.*, p.title as product_title, p.image_url as product_image, p.price as product_price,
           b.name as buyer_name, b.email as buyer_email, b.student_code as buyer_student_code,
           s.name as seller_name, s.email as seller_email
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users b ON o.buyer_id = b.id
    JOIN users s ON o.seller_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'seller') {
    query += ' AND o.seller_id = ?';
    params.push(req.currentUser.id);
  } else if (role === 'buyer') {
    query += ' AND o.buyer_id = ?';
    params.push(req.currentUser.id);
  } else if (req.currentUser.role !== 'ADMIN') {
    // If not admin, see both my buying and selling
    query += ' AND (o.buyer_id = ? OR o.seller_id = ?)';
    params.push(req.currentUser.id, req.currentUser.id);
  }

  query += ' ORDER BY o.id DESC';
  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

// Seller accepts order
app.post('/api/orders/:id/accept', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.seller_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền duyệt đơn này' });
  }

  db.prepare("UPDATE orders SET status = 'ACCEPTED', seller_confirmed = 1, updated_at = datetime('now') WHERE id = ?")
    .run(order.id);

  res.json({ success: true, message: 'Đã chấp nhận đơn hàng. Vui lòng chuẩn bị và giao hàng!' });
});

// Seller ships order -> Triggers 5-day auto-confirm deadline
app.post('/api/orders/:id/ship', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.seller_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền gửi đơn này' });
  }

  const { tracking_code } = req.body;
  const now = new Date();
  const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // exactly 5 days

  db.prepare(`
    UPDATE orders 
    SET status = 'DELIVERING', 
        shipped_at = ?, 
        auto_confirm_deadline = ?,
        tracking_code = COALESCE(?, tracking_code),
        updated_at = ?
    WHERE id = ?
  `).run(now.toISOString(), deadline.toISOString(), tracking_code || null, now.toISOString(), order.id);

  res.json({
    success: true,
    message: 'Đã cập nhật trạng thái gửi hàng! Đồng hồ bảo vệ 5 ngày đã được kích hoạt.'
  });
});

// Buyer confirms receipt & releases escrow funds to seller
app.post('/api/orders/:id/confirm', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.buyer_id !== req.currentUser.id && req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ người mua mới được bấm xác nhận hoàn tất' });
  }

  completeOrderFunds(order, 'COMPLETED');
  res.json({ success: true, message: 'Giao dịch hoàn tất thành công! Tiền đã được giải ngân cho người bán.' });
});

// Nút Demo Giảng viên: "⚡ Demo: Qua 5 ngày (Auto-confirm)"
app.post('/api/orders/:id/simulate-5days', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (order.status === 'COMPLETED' || order.status === 'COMPLETED_AUTO') {
    return res.status(400).json({ error: 'Đơn hàng này đã được hoàn tất trước đó rồi' });
  }

  console.log(`[DEMO FOR TEACHER] Simulating 5-day expiration for order ${order.order_code}...`);
  completeOrderFunds(order, 'COMPLETED_AUTO');

  res.json({
    success: true,
    message: `⚡ [DEMO] Giả lập thành công: Đã trôi qua 5 ngày không có khiếu nại! Tiền ${order.total_paid.toLocaleString('vi-VN')}đ đã tự động giải ngân cho Người bán.`
  });
});

// Buyer reports dispute
app.post('/api/orders/:id/dispute', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  const { reason } = req.body;
  db.prepare(`
    UPDATE orders 
    SET status = 'DISPUTED', 
        dispute_reason = ?, 
        auto_confirm_deadline = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(reason || 'Hàng lỗi hoặc chưa nhận được đồ', order.id);

  res.json({
    success: true,
    message: 'Đã đóng băng đơn hàng và gửi khiếu nại tới Ban Quản Trị để đối soát xử lý!'
  });
});

// Admin resolves dispute (Refund Buyer OR Release Seller)
app.post('/api/orders/:id/admin-resolve', (req, res) => {
  if (req.currentUser.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền giải quyết tranh chấp' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  const { decision } = req.body; // 'REFUND_BUYER' or 'RELEASE_SELLER'

  if (decision === 'REFUND_BUYER') {
    // Return escrow funds to buyer available balance
    const buyerWallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(order.buyer_id);
    if (buyerWallet) {
      db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, available_balance = available_balance + ?, updated_at = datetime('now') WHERE id = ?")
        .run(order.total_paid, order.total_paid, buyerWallet.id);

      const refVoucher = 'PT-REF-' + Math.floor(100000 + Math.random() * 900000);
      db.prepare(`
        INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
        VALUES (?, 'REFUND', 'IN', ?, 'Két Escrow TakeTwo', ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        buyerWallet.id,
        refVoucher,
        order.total_paid,
        buyerWallet.available_balance,
        buyerWallet.available_balance + order.total_paid,
        order.order_code,
        `Hoàn tiền đơn khiếu nại ${order.order_code} về ví theo phán quyết của Admin`
      );
    }

    db.prepare("UPDATE orders SET status = 'CANCELLED', escrow_status = 'REFUNDED', updated_at = datetime('now') WHERE id = ?").run(order.id);
    db.prepare("UPDATE products SET status = 'AVAILABLE' WHERE id = ?").run(order.product_id);

    return res.json({ success: true, message: 'Đã hoàn lại 100% tiền tạm giữ cho Người mua!' });
  } else {
    // Decision is release to seller
    completeOrderFunds(order, 'COMPLETED');
    return res.json({ success: true, message: 'Đã bác bỏ khiếu nại và giải ngân tiền cho Người bán!' });
  }
});

// -------------------------------------------------------------
// ADMIN METRICS (5 Key Metrics)
// -------------------------------------------------------------
app.get('/api/admin/metrics', (req, res) => {
  const verifiedTx = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as gmv FROM orders WHERE status IN ('COMPLETED', 'COMPLETED_AUTO')").get();
  const activeListings = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'AVAILABLE'").get();
  const totalSellers = db.prepare('SELECT COUNT(DISTINCT seller_id) as count FROM products').get();
  const repeatSellers = db.prepare('SELECT COUNT(*) as count FROM (SELECT seller_id FROM products GROUP BY seller_id HAVING COUNT(*) >= 2)').get();
  const repeatRate = totalSellers.count > 0 ? Math.round((repeatSellers.count / totalSellers.count) * 100) : 0;
  const totalEscrowHeld = db.prepare('SELECT COALESCE(SUM(escrow_balance), 0) as total FROM wallets').get();

  res.json({
    north_star_verified_transactions: verifiedTx.count,
    gmv_completed: verifiedTx.gmv,
    active_real_listings: activeListings.count,
    repeat_seller_rate: repeatRate,
    escrow_held_pool: totalEscrowHeld.total,
    budget_cash_ledger: 30250000,
    platform_fee_collected: Math.round(verifiedTx.gmv * 0.03)
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 TakeTwo Marketplace V2.0 Server is LIVE!`);
    console.log(`📍 Web Interface: http://localhost:${PORT}`);
    console.log(`⚡ Native SQLite & In-app Escrow Wallet ready!`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
