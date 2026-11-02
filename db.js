const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const os = require('node:os');

// In serverless environments (Vercel / Lambda), filesystem is read-only except /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dbDir = isServerless ? os.tmpdir() : __dirname;
const dbPath = path.join(dbDir, 'taketwo.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function createTablesIfNotExists() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'BUYER',
      campus TEXT NOT NULL,
      student_code TEXT,
      rating_avg REAL DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      eco_points INTEGER DEFAULT 0,
      co2_saved_kg REAL DEFAULT 0.0,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      original_price INTEGER,
      condition_level TEXT NOT NULL,
      defect_note TEXT,
      campus_cluster TEXT NOT NULL,
      meetup_location TEXT NOT NULL,
      image_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      is_promoted INTEGER DEFAULT 0,
      promoted_badge TEXT,
      promoted_until TEXT,
      bump_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 12,
      created_at TEXT NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      available_balance INTEGER NOT NULL DEFAULT 0,
      escrow_balance INTEGER NOT NULL DEFAULT 0,
      boost_credits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      flow_type TEXT NOT NULL DEFAULT 'IN',
      voucher_code TEXT,
      payment_method TEXT DEFAULT 'Ví TakeTwo',
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS bump_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bump_credits INTEGER NOT NULL,
      price INTEGER NOT NULL,
      tag TEXT,
      description TEXT NOT NULL,
      has_badge_hot INTEGER DEFAULT 0,
      validity_days INTEGER DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      shipping_fee INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total_paid INTEGER NOT NULL,
      delivery_type TEXT NOT NULL,
      delivery_address TEXT,
      recipient_name TEXT,
      recipient_phone TEXT,
      tracking_code TEXT,
      payment_method TEXT NOT NULL DEFAULT 'WALLET_ESCROW',
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      escrow_status TEXT NOT NULL DEFAULT 'HELD',
      buyer_confirmed INTEGER DEFAULT 0,
      seller_confirmed INTEGER DEFAULT 0,
      shipped_at TEXT,
      auto_confirm_deadline TEXT,
      dispute_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );
  `);
}

function ensureSchemaMigrations() {
  createTablesIfNotExists();

  // Helper to check if column exists
  const hasColumn = (table, col) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      return info.some(c => c.name === col);
    } catch (e) {
      return false;
    }
  };

  // 1. Wallets table boost_credits
  if (!hasColumn('wallets', 'boost_credits')) {
    db.exec('ALTER TABLE wallets ADD COLUMN boost_credits INTEGER NOT NULL DEFAULT 0;');
  }

  // 2. Orders table recipient_name & recipient_phone
  if (!hasColumn('orders', 'recipient_name')) {
    db.exec('ALTER TABLE orders ADD COLUMN recipient_name TEXT;');
  }
  if (!hasColumn('orders', 'recipient_phone')) {
    db.exec('ALTER TABLE orders ADD COLUMN recipient_phone TEXT;');
  }

  // 3. Products table promoted_badge & bump_count
  if (!hasColumn('products', 'promoted_badge')) {
    db.exec('ALTER TABLE products ADD COLUMN promoted_badge TEXT;');
  }
  if (!hasColumn('products', 'bump_count')) {
    db.exec('ALTER TABLE products ADD COLUMN bump_count INTEGER DEFAULT 0;');
  }
}

function dropAndCreateTables() {
  db.exec(`
    DROP TABLE IF EXISTS wallet_transactions;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS bump_packages;
  `);
  createTablesIfNotExists();
}

function initDatabase(forceReseed = false) {
  ensureSchemaMigrations();
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (!tableCheck) {
    dropAndCreateTables();
    seedAllData();
  } else {
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (prodCount === 0 || forceReseed) {
      seedAllData();
    }
  }
}

function seedAllData() {
  console.log('Seeding 8 realistic student products & TakeTwo wallet transactions...');

  // Temporarily disable foreign keys during reseed
  db.exec('PRAGMA foreign_keys = OFF;');
  dropAndCreateTables();

  // 1. Categories
  const insertCat = db.prepare('INSERT INTO categories (id, name, icon, description) VALUES (?, ?, ?, ?)');
  insertCat.run('books', 'Giáo trình & Học tập', '📚', 'Slide in, giáo trình đại cương, sách chuyên ngành ĐH');
  insertCat.run('living', 'Đồ trọ & KTX', '🛏️', 'Nồi cơm điện, quạt, bàn xếp, ấm siêu tốc, tủ vải');
  insertCat.run('electronics', 'Điện tử & Phụ kiện', '💻', 'Chuột, phím cơ, tai nghe, màn hình, củ cáp sạc');
  insertCat.run('fashion', 'Thời trang SV', '👕', 'Áo khoác đồng phục trường, vest thuyết trình, outfit sinh viên');

  // 2. Users (4 Users: Buyer, Seller, Student, Admin)
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertUser.run(1, 'Vũ Hán Tuấn', 'tuanvhhe194875@fpt.edu.vn', 'BUYER', 'Khu đô thị Hòa Lạc (ĐH FPT)', 'HE194875', 4.9, 14, 450, 18.5, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', '-30 days');
  insertUser.run(2, 'Nguyễn Minh Anh (Chủ Gian Hàng)', 'minhanh.seller@fpt.edu.vn', 'SELLER', 'Khu đô thị Hòa Lạc (ĐH FPT / KTX Dom A)', 'SE182210', 5.0, 48, 980, 42.0, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', '-60 days');
  insertUser.run(3, 'Trần Bảo Long', 'longtb.vnu@vnu.edu.vn', 'SELLER', 'Khu đô thị Hòa Lạc (ĐHQG Hà Nội)', 'QH20230911', 4.8, 19, 380, 14.5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', '-20 days');
  insertUser.run(4, 'Ban Quản Trị TakeTwo', 'admin@taketwo.vn', 'ADMIN', 'Trụ sở Hà Nội', 'ADMIN01', 5.0, 0, 0, 0.0, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80', '-90 days');

  // 3. Wallets (Số dư mẫu + lượt đẩy bài VIP)
  const insertWallet = db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, boost_credits, updated_at) VALUES (?, ?, ?, ?, datetime('now'))");
  insertWallet.run(1, 250000, 55000, 2);   // Tuấn (Buyer - 2 lượt đẩy VIP)
  insertWallet.run(2, 680000, 0, 5);       // Minh Anh (Seller - 5 lượt)
  insertWallet.run(3, 195000, 0, 1);       // Long (Seller - 1 lượt)
  insertWallet.run(4, 30250000, 55000, 99);// Admin (Cash reserve pool)

  // 4. Bump Packages (3 gói chuẩn hóa theo Kinh tế học hành vi: Lẻ 15k / Tiết kiệm 49k / VIP 79k)
  const insertBump = db.prepare('INSERT INTO bump_packages (id, name, bump_credits, price, tag, description, has_badge_hot, validity_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertBump.run('bump_single', 'Gói Lẻ (Cơ bản)', 1, 15000, 'Mức giá neo', '15.000đ / 1 lượt đẩy bài lên đầu danh mục. Hiệu lực 30 ngày.', 0, 30);
  insertBump.run('bump_saver', 'Gói Sinh Viên Tiết Kiệm', 5, 49000, '⭐ Phổ biến nhất - Tiết kiệm 35%', '49.000đ / 5 lượt đăng & đẩy bài (Chỉ 9.8k/lượt, tiết kiệm 26.000đ).', 0, 30);
  insertBump.run('bump_vip', 'Gói Xả Đồ Ra Trường (VIP)', 10, 79000, '👑 Siêu hời - Pass nhanh x3', '79.000đ / 10 lượt đẩy + Tặng Huy hiệu "🔥 Đẩy Top" độc quyền.', 1, 60);

  // 5. 8 Realistic Student Products Across 4 Categories
  const insertProduct = db.prepare(`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, is_promoted, promoted_badge, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const productData = [
    // 1. GIÁO TRÌNH (Tied to seed order 1)
    [2, 'books', 'Giáo trình Triết học Mác - Lênin & Tư tưởng Hồ Chí Minh (Bộ 2 cuốn)', 45000, 140000, 'Như mới 99%', 'Sách mới tinh chỉ highlight 2 trang đầu, không rách gáy.', 'Hòa Lạc', 'Sảnh Trống Đồng, KTX Dom A - ĐH FPT', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', 'RESERVED', 1, 'HOT', 3, 148, '-2 days'],
    // 2. GIÁO TRÌNH (Owned by User 1 - Tuấn có thể test Đẩy Top)
    [1, 'books', 'Giáo trình Cấu trúc dữ liệu & Giải thuật C++ (FPT University)', 55000, 120000, 'Tốt 90%', 'Có ghi chú bằng bút chì các giải thuật DFS/BFS rất dễ hiểu.', 'Hòa Lạc', 'Thư viện ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 95, '-1 days'],
    // 3. ĐỒ TRỌ KTX (Minh Anh)
    [2, 'living', 'Nồi cơm điện mini Lock&Lock 0.8L (Dành cho 1-2 người ở trọ KTX)', 180000, 490000, 'Tốt 90%', 'Lòng nồi chống dính còn rất tốt, xước nhẹ vỏ ngoài không ảnh hưởng.', 'Hòa Lạc', 'Cổng KTX Dom B - ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 5, 320, '-4 hours'],
    // 4. ĐỒ TRỌ KTX (Owned by User 1 - Tuấn)
    [1, 'living', 'Bàn học gấp gọn gỗ thông có khe cắm iPad & Ngăn kéo nhỏ', 75000, 170000, 'Khá 80%', 'Gỗ chắc chắn ngồi giường KTX bao tiện, có một vết mực mờ góc trái.', 'Hòa Lạc', 'Sảnh Dom C KTX FPT', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 180, '-5 hours'],
    // 5. ĐIỆN TỬ (Long)
    [3, 'electronics', 'Bàn phím cơ DareU EK87 White LED Red Switch gõ êm mượt', 290000, 650000, 'Tốt 90%', 'Đầy đủ hộp và cáp, các phím gõ nảy chuẩn không liệt phím nào.', 'Hòa Lạc', 'Căn tin ĐHQG Hà Nội - Hòa Lạc', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 240, '-2 hours'],
    // 6. ĐIỆN TỬ (Minh Anh)
    [2, 'electronics', 'Tai nghe chụp tai Sony WH-CH520 chống ồn pin 50 tiếng', 590000, 1190000, 'Như mới 99%', 'Còn bảo hành chính hãng 4 tháng, đệm tai da êm không bong tróc.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Sư Phạm Hà Nội, Xuân Thủy', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 410, '-5 hours'],
    // 7. THỜI TRANG (Long)
    [3, 'fashion', 'Áo khoác bomber đồng phục FPT University size L chuẩn form', 150000, 350000, 'Như mới 99%', 'Mặc đúng 2 lần thi thể dục, khóa kéo trơn tru thơm tho như mới.', 'Hòa Lạc', 'Trường ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 380, '-1 hours'],
    // 8. THỜI TRANG (Minh Anh)
    [2, 'fashion', 'Bộ vest đen thuyết trình nam form Hàn Quốc trẻ trung (Size 48)', 290000, 750000, 'Như mới 99%', 'Chỉ mặc 1 buổi bảo vệ luận văn tốt nghiệp, vải tuyết mưa đứng dáng.', 'Bách - Kinh - Xây', 'KTX ĐH Kinh Tế Quốc Dân', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 220, '-7 hours']
  ];

  for (const item of productData) {
    insertProduct.run(...item);
  }

  // 6. Active Escrow Order with 5-Day SLA Countdown
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_code, product_id, buyer_id, seller_id, amount, shipping_fee, discount, total_paid,
      delivery_type, delivery_address, recipient_name, recipient_phone, tracking_code,
      payment_method, status, escrow_status, buyer_confirmed, seller_confirmed,
      shipped_at, auto_confirm_deadline, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 days'), datetime('now'))
  `);

  const shippedDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const deadlineDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  insertOrder.run(
    'TK-20261102-01',
    1,
    1,
    2,
    45000,
    15000,
    5000,
    55000,
    'COURIER_ROOM',
    'Phòng 304, KTX Dom E, ĐHQG Hòa Lạc',
    'Vũ Hán Tuấn',
    '0987654321',
    'TK-EXPRESS-9921',
    'WALLET_ESCROW',
    'DELIVERING',
    'HELD',
    0,
    1,
    shippedDate,
    deadlineDate
  );

  // 7. TakeTwo Wallet Transactions (Sổ Quỹ Thu Chi Mẫu)
  const insertTx = db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertTx.run(1, 'TOPUP', 'IN', 'PT-20261101-01', 'VietQR MBBank', 200000, 105000, 305000, 'VQR-88219', 'Nạp tiền vào ví TakeTwo qua VietQR MBBank', '-2 days');
  insertTx.run(1, 'ESCROW_HOLD', 'HOLD', 'PC-20261101-02', 'Ví TakeTwo Escrow', -55000, 305000, 250000, 'TK-20261102-01', 'Tạm giữ tiền thanh toán đơn hàng #TK-20261102-01 (Giáo trình Triết học Mác)', '-1 days');
  insertTx.run(2, 'TOPUP', 'IN', 'PT-20261030-03', 'VietQR SeABank', 500000, 229000, 729000, 'VQR-11029', 'Nạp tiền vào ví TakeTwo qua VietQR SeABank', '-3 days');
  insertTx.run(2, 'BUY_BOOST', 'OUT', 'PC-20261031-04', 'Ví TakeTwo', -49000, 729000, 680000, 'bump_saver', 'Mua Gói Sinh Viên Tiết Kiệm (+5 lượt đẩy bài VIP)', '-2 days');

  db.exec('PRAGMA foreign_keys = ON;');
  console.log(`Database seeded with ${productData.length} realistic student products and full TakeTwo Wallet transactions!`);
}

module.exports = {
  db,
  initDatabase,
  seedAllData
};
