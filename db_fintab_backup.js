const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.join(__dirname, 'taketwo.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys
db.exec('PRAGMA foreign_keys = ON;');

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

    CREATE TABLE users (
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

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE products (
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

    CREATE TABLE wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      available_balance INTEGER NOT NULL DEFAULT 0,
      escrow_balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE wallet_transactions (
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

    CREATE TABLE bump_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bump_credits INTEGER NOT NULL,
      price INTEGER NOT NULL,
      tag TEXT,
      description TEXT NOT NULL,
      has_badge_hot INTEGER DEFAULT 0,
      validity_days INTEGER DEFAULT 30
    );

    CREATE TABLE orders (
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

    CREATE TABLE messages (
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

function initDatabase(forceReseed = false) {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (!tableCheck) {
    dropAndCreateTables();
    seedAllData();
  } else {
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (prodCount < 30 || forceReseed) {
      seedAllData();
    }
  }
}

function seedAllData() {
  console.log('Seeding comprehensive 50+ products & Fintab accounting transactions...');

  // Temporarily disable foreign keys during reseed
  db.exec('PRAGMA foreign_keys = OFF;');
  dropAndCreateTables();

  // 1. Categories
  const insertCat = db.prepare('INSERT INTO categories (id, name, icon, description) VALUES (?, ?, ?, ?)');
  insertCat.run('books', 'Giáo trình & Học tập', '📚', 'Slide in, giáo trình đại cương, sách chuyên ngành ĐH');
  insertCat.run('living', 'Đồ trọ & KTX', '🛏️', 'Nồi cơm điện, quạt, bàn xếp, ấm siêu tốc, tủ vải');
  insertCat.run('electronics', 'Điện tử & Phụ kiện', '💻', 'Chuột, phím cơ, tai nghe, màn hình, củ cáp sạc');
  insertCat.run('fashion', 'Thời trang SV', '👕', 'Áo khoác đồng phục trường, vest thuyết trình, outfit sinh viên');

  // 2. Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, role, campus, student_code, rating_avg, review_count, eco_points, co2_saved_kg, avatar_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertUser.run(1, 'Vũ Hán Tuấn', 'tuanvhhe194875@fpt.edu.vn', 'BUYER', 'Khu đô thị Hòa Lạc (ĐH FPT)', 'HE194875', 4.9, 14, 450, 18.5, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', '-30 days');
  insertUser.run(2, 'Nguyễn Minh Anh (Chủ Gian Hàng)', 'minhanh.seller@fpt.edu.vn', 'SELLER', 'Khu đô thị Hòa Lạc (ĐH FPT / KTX Dom A)', 'SE182210', 5.0, 48, 980, 42.0, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', '-60 days');
  insertUser.run(3, 'Trần Bảo Long', 'longtb.vnu@vnu.edu.vn', 'SELLER', 'Khu đô thị Hòa Lạc (ĐHQG Hà Nội)', 'QH20230911', 4.8, 19, 380, 14.5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', '-20 days');
  insertUser.run(4, 'Ban Quản Trị TakeTwo', 'admin@taketwo.vn', 'ADMIN', 'Trụ sở Hà Nội', 'ADMIN01', 5.0, 0, 0, 0.0, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80', '-90 days');
  insertUser.run(5, 'Lê Hoàng Nam', 'namlh.hust@sis.hust.edu.vn', 'SELLER', 'Cụm Bách - Kinh - Xây', '20210892', 4.95, 26, 520, 22.0, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', '-15 days');
  insertUser.run(6, 'Phạm Thu Thảo', 'thaopt.neu@neu.edu.vn', 'SELLER', 'Cụm Đống Đa - Chùa Láng', '11204899', 5.0, 31, 640, 29.5, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', '-12 days');

  // 3. Wallets
  const insertWallet = db.prepare("INSERT INTO wallets (user_id, available_balance, escrow_balance, updated_at) VALUES (?, ?, ?, datetime('now'))");
  insertWallet.run(1, 250000, 55000);  // Tuấn (Buyer)
  insertWallet.run(2, 680000, 0);      // Minh Anh (Seller)
  insertWallet.run(3, 195000, 0);      // Long (Seller)
  insertWallet.run(4, 30250000, 55000);// Admin (Cash reserve pool)
  insertWallet.run(5, 340000, 0);      // Nam (Seller)
  insertWallet.run(6, 420000, 0);      // Thảo (Seller)

  // 4. Bump Packages
  const insertBump = db.prepare('INSERT INTO bump_packages (id, name, bump_credits, price, tag, description, has_badge_hot, validity_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertBump.run('bump_single', 'Gói Lẻ Tiết Kiệm', 1, 15000, 'Cơ Bản', 'Đẩy bài lên Top 1 danh mục 1 lần. Hiệu lực 3 ngày.', 0, 30);
  insertBump.run('bump_starter', 'Gói Sinh Viên Nhanh', 3, 35000, 'Tiết Kiệm 22%', '3 lượt đẩy bài linh hoạt trong 30 ngày (11.6k/lượt).', 0, 30);
  insertBump.run('bump_speedy', 'Gói Dọn Trọ Gấp (Hot)', 5, 49000, '🔥 KHUYÊN DÙNG - Tiết kiệm 35%', '5 lượt đẩy + Gắn huy hiệu "Cần Pass Gấp" + Ưu tiên Banner.', 1, 30);
  insertBump.run('bump_pro', 'Gói KTX Pro Seller', 15, 119000, 'VIP - Tiết kiệm 47%', '15 lượt đẩy bài + Tự động Auto-Bump vào 12h & 21h hàng ngày.', 1, 60);

  // 5. Fifty Realistic Products Across 4 Categories & 5 Campus Clusters
  const insertProduct = db.prepare(`
    INSERT INTO products (
      seller_id, category_id, title, price, original_price, condition_level, defect_note,
      campus_cluster, meetup_location, image_url, status, is_promoted, promoted_badge, bump_count, view_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const productData = [
    // BOOKS (13 products)
    [2, 'books', 'Giáo trình Triết học Mác - Lênin & Tư tưởng Hồ Chí Minh (Bộ 2 cuốn)', 45000, 140000, 'Như mới 99%', 'Sách mới tinh chỉ highlight 2 trang đầu, không rách gáy.', 'Hòa Lạc', 'Sảnh Trống Đồng, KTX Dom A - ĐH FPT', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', 'RESERVED', 1, 'HOT', 3, 148, '-2 days'],
    [2, 'books', 'Giáo trình Cấu trúc dữ liệu & Giải thuật C++ (FPT University)', 55000, 120000, 'Tốt 90%', 'Có ghi chú bằng bút chì các giải thuật DFS/BFS rất dễ hiểu.', 'Hòa Lạc', 'Thư viện ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 5, 230, '-1 days'],
    [3, 'books', 'Sách Giải tích 1 & Giải tích 2 ĐHQG Hà Nội (Kèm tập bài giải)', 65000, 160000, 'Tốt 90%', 'Bìa dán băng dính cẩn thận, ruột sạch sẽ không vẽ bậy.', 'Hòa Lạc', 'Căn tin ĐHQGHN Hòa Lạc', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 95, '-3 hours'],
    [5, 'books', 'Bộ giáo trình Đại số tuyến tính Bách Khoa Hà Nội (Thầy Lê Đình Thịnh)', 40000, 95000, 'Khá 80%', 'Gáy hơi sờn góc nhưng đầy đủ các đề thi mẫu qua các năm.', 'Bách - Kinh - Xây', 'Cổng parabol ĐH Bách Khoa, Đại Cồ Việt', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 310, '-6 hours'],
    [6, 'books', 'Giáo trình Kinh tế vi mô & Kinh tế vĩ mô ĐH Kinh Tế Quốc Dân', 70000, 190000, 'Như mới 99%', 'Bản in màu tái bản 2024, chuẩn form chương trình NEU.', 'Bách - Kinh - Xây', 'Tòa A1 Nhà Vạn Gió - ĐH Kinh Tế Quốc Dân', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 180, '-8 hours'],
    [3, 'books', 'Bộ sách Cambridge IELTS 15 - 18 Academic (Có mã tải file Audio)', 95000, 280000, 'Như mới 99%', 'Chưa điền bút chì, kèm file giải thích chi tiết Part 1-2-3.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Quốc Gia Hà Nội, 144 Xuân Thủy', 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 6, 420, '-12 hours'],
    [6, 'books', 'Giáo trình Luật Thương Mại Quốc Tế (ĐH Ngoại Thương - FTU)', 60000, 150000, 'Tốt 90%', 'Được thầy cô highlight các điều ước Incoterms 2020.', 'Đống Đa - Chùa Láng', 'Sảnh nhà A - ĐH Ngoại Thương, Chùa Láng', 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 115, '-18 hours'],
    [5, 'books', 'Tập bài tập Vẽ Kỹ Thuật & Hình Họa (Kèm tập giấy vẽ A3 chuyên dụng)', 50000, 130000, 'Khá 80%', 'Tặng kèm compa và thước chữ T còn dùng tốt.', 'Bách - Kinh - Xây', 'Cổng ĐH Xây Dựng, 55 Giải Phóng', 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 88, '-1 days'],
    [2, 'books', 'Sách Lập trình Hướng đối tượng Java OOP (Kèm đĩa source code mẫu)', 65000, 145000, 'Như mới 99%', 'Sách in nét căng, cực kỳ hữu ích cho đồ án PRJ301.', 'Hòa Lạc', 'Dom B - KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 215, '-1 days'],
    [3, 'books', 'Giáo trình Xác suất Thống kê ứng dụng (ĐH Công Nghệ - UET)', 45000, 110000, 'Tốt 90%', 'Tóm tắt công thức chuẩn ở 4 trang cuối, học thi qua môn êm đẹp.', 'Cầu Giấy - Xuân Thủy', 'Ký túc xá Ngoại Ngữ, Cầu Giấy', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-2 days'],
    [5, 'books', 'Combo 3 cuốn Giáo trình Cơ học Lý thuyết & Sức bền vật liệu', 85000, 240000, 'Khá 80%', 'Sách cổ điển nhưng đề cương ôn thi giữa kỳ rất sát thực tế.', 'Hà Đông - Thanh Xuân', 'Học viện Bưu chính Viễn thông (PTIT)', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 92, '-2 days'],
    [6, 'books', 'Giáo trình Nhập môn Truyền thông Đa phương tiện & Quan hệ Công chúng', 55000, 135000, 'Như mới 99%', 'Bản in màu sắc nét, phù hợp sinh viên Báo chí & Ngoại giao.', 'Cầu Giấy - Xuân Thủy', 'Học viện Báo chí & Tuyên truyền', 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 78, '-3 days'],
    [2, 'books', 'Tập tài liệu ôn thi chứng chỉ JLPT N3 (Kèm 10 đề thi thật có giải)', 70000, 180000, 'Như mới 99%', 'Có dịch nghĩa ngữ pháp chi tiết từng câu, không rách giấy.', 'Hòa Lạc', 'Sảnh Tân Xã, Hòa Lạc', 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 160, '-3 days'],

    // LIVING & DORM ITEMS (13 products)
    [2, 'living', 'Nồi cơm điện mini Lock&Lock 0.8L (Phù hợp 1-2 bạn sinh viên KTX)', 180000, 490000, 'Tốt 90%', 'Lòng nồi chống dính còn rất tốt, xước nhẹ vỏ ngoài không ảnh hưởng.', 'Hòa Lạc', 'Cổng KTX Dom B - ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 5, 320, '-4 hours'],
    [2, 'living', 'Bàn học gấp gỗ thông tự nhiên có khe cắm iPad + Ngăn kéo nhỏ', 75000, 170000, 'Khá 80%', 'Gỗ chắc chắn ngồi giường KTX bao tiện, có một vết mực mờ góc trái.', 'Hòa Lạc', 'Sảnh Dom C KTX FPT', 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 215, '-5 hours'],
    [3, 'living', 'Ấm đun nước siêu tốc Sunhouse 1.8L Inox 304 tự ngắt an toàn', 80000, 195000, 'Tốt 90%', 'Đun sôi nước trong 3 phút, đế xoay 360 độ còn sáng bóng.', 'Hòa Lạc', 'KTX ĐHQG Hòa Lạc - Nhà B4', 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 165, '-7 hours'],
    [5, 'living', 'Quạt cây đứng Senko lồng sơn tĩnh điện êm ái, gió mạnh', 150000, 360000, 'Tốt 90%', 'Có 3 nấc gió và tuốc năng quay đều, động cơ chạy êm ru.', 'Bách - Kinh - Xây', 'Ngõ 205 Giải Phóng, gần Bách Khoa', 'https://images.unsplash.com/photo-1618941716939-553df3c6c278?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 290, '-9 hours'],
    [6, 'living', 'Tủ vải đựng quần áo khung inox 3 buồng 8 ngăn (Dọn trọ pass rẻ)', 110000, 270000, 'Tốt 90%', 'Khung inox rất dày, vải bọc không bị mục rách khóa kéo tốt.', 'Đống Đa - Chùa Láng', 'Ngõ 119 Chùa Láng, gần ĐH Ngoại Thương', 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 185, '-11 hours'],
    [3, 'living', 'Đèn bàn học chống cận Rạng Đông LED 6W có điều chỉnh góc', 65000, 150000, 'Như mới 99%', 'Ánh sáng vàng dịu mắt không chói lóa, kèm củ nguồn zin.', 'Cầu Giấy - Xuân Thủy', 'Ký túc xá ĐH Sư Phạm Hà Nội', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 130, '-15 hours'],
    [5, 'living', 'Kệ sách gỗ 4 tầng lắp ghép mini để bàn học (Tháo lắp dễ)', 55000, 130000, 'Tốt 90%', 'Gỗ công nghiệp chống ẩm màu vân sồi sáng, để được 30 cuốn sách.', 'Bách - Kinh - Xây', 'Ký túc xá Bách Khoa - Nhà B10', 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 110, '-1 days'],
    [2, 'living', 'Nệm gấp KTX bông ép 1m x 2m (Gấp 3 tiện lợi sạch sẽ)', 140000, 380000, 'Tốt 90%', 'Đã giặt sấy thơm tho bằng Downy, kèm 1 ga bọc cotton poly.', 'Hòa Lạc', 'Dom A - KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 5, 340, '-1 days'],
    [6, 'living', 'Gương đứng soi toàn thân khung gỗ viền trắng 40x150cm', 120000, 290000, 'Như mới 99%', 'Gương tráng bạc sắc nét không méo hình, chân đỡ kim loại vững.', 'Đống Đa - Chùa Láng', 'Khu trọ Nguyên Hồng, Đống Đa', 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 3, 220, '-1 days'],
    [2, 'living', 'Nồi lẩu điện mini đa năng 1.5L kèm xửng hấp inox ăn mì cực đã', 90000, 220000, 'Tốt 90%', 'Chống dính tốt, 2 nấc nhiệt nấu mì lẩu hoặc luộc trứng nhanh.', 'Hòa Lạc', 'Dom D - KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 380, '-2 days'],
    [3, 'living', 'Cây lau nhà thông minh tự vắt 360 độ + Tặng 2 miếng lau micro', 70000, 165000, 'Như mới 99%', 'Thùng chứa có ngăn vắt khô ráo, bàn lau phẳng luồn gầm giường.', 'Cầu Giấy - Xuân Thủy', 'Ngõ 165 Cầu Giấy, Hà Nội', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 95, '-2 days'],
    [5, 'living', 'Set 6 hộp đựng giày nhựa cứng trong suốt nắp nam châm hít', 85000, 210000, 'Như mới 99%', 'Nhựa mica dày dặn chống bụi ẩm mốc, xếp chồng không rung lắc.', 'Hà Đông - Thanh Xuân', 'Cổng ĐH Hà Nội, Nguyễn Trãi', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 145, '-3 days'],
    [6, 'living', 'Móc phơi quần áo inox 304 thanh đặc chịu lực (Gói 20 chiếc)', 35000, 85000, 'Như mới 99%', 'Inox không gỉ sét khi phơi mưa nắng, đầu móc có bọc nhựa an toàn.', 'Đống Đa - Chùa Láng', 'Ký túc xá ĐH Ngoại Thương', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 80, '-3 days'],

    // ELECTRONICS & ACCESSORIES (12 products)
    [3, 'electronics', 'Bàn phím cơ DareU EK87 White LED Red Switch gõ êm mượt', 290000, 650000, 'Tốt 90%', 'Đầy đủ hộp và cáp, các phím gõ nảy chuẩn không liệt phím nào.', 'Hòa Lạc', 'Căn tin ĐHQG Hà Nội - Hòa Lạc', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 240, '-2 hours'],
    [2, 'electronics', 'Tai nghe chụp tai Sony WH-CH520 chống ồn pin 50 tiếng', 590000, 1190000, 'Như mới 99%', 'Còn bảo hành chính hãng 4 tháng, đệm tai da êm không bong tróc.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Sư Phạm Hà Nội, Xuân Thủy', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 7, 490, '-5 hours'],
    [5, 'electronics', 'Chuột không dây Logitech M331 Silent nhấp êm không tiếng động', 160000, 370000, 'Tốt 90%', 'Dùng học thư viện không lo phiền người khác, pin dùng 12 tháng.', 'Bách - Kinh - Xây', 'Thư viện Tạ Quang Bửu - ĐH Bách Khoa', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 210, '-8 hours'],
    [2, 'electronics', 'Màn hình máy tính Dell 24 inch IPS FHD (Kèm cáp HDMI + Chân xoay)', 1450000, 3100000, 'Tốt 90%', 'Màn đẹp không điểm chết, màu chuẩn học đồ họa hay code bao phê.', 'Hòa Lạc', 'Dom E KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 6, 520, '-10 hours'],
    [6, 'electronics', 'Củ sạc nhanh Anker 30W PowerPort III Nano nhỏ gọn cho iPhone/Type-C', 170000, 390000, 'Như mới 99%', 'Sạc 50% pin chỉ trong 30 phút, chân cắm gấp gọn rất tiện.', 'Đống Đa - Chùa Láng', 'Sảnh Học viện Ngoại Giao', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 160, '-12 hours'],
    [3, 'electronics', 'Tai nghe True Wireless Soundpeats Air 3 âm bass chắc có Game Mode', 320000, 750000, 'Tốt 90%', 'Dock sạc nhỏ gọn, kết nối bluetooth 5.2 không delay xem phim.', 'Cầu Giấy - Xuân Thủy', 'Ngõ 20 Hồ Tùng Mậu, Cầu Giấy', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 195, '-16 hours'],
    [5, 'electronics', 'Bàn phím không dây Logitech K380 kết nối 3 thiết bị cùng lúc', 380000, 720000, 'Như mới 99%', 'Màu hồng phấn pastel cực xinh, gõ nhẹ tênh mang đi cafe rất nhẹ.', 'Bách - Kinh - Xây', 'Cổng ĐH Kinh Tế Quốc Dân, Trần Đại Nghĩa', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 3, 275, '-1 days'],
    [2, 'electronics', 'Pin sạc dự phòng Baseus 20.000mAh 65W sạc được cho cả Laptop', 390000, 890000, 'Tốt 90%', 'Dung lượng thực tế còn 95%, có màn hình LED báo % pin rõ ràng.', 'Hòa Lạc', 'Dom C KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1609592807664-44df0e998246?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 380, '-1 days'],
    [3, 'electronics', 'Giá đỡ tản nhiệt Laptop nhôm nguyên khối gập gọn công thái học', 85000, 190000, 'Như mới 99%', 'Nhôm CNC dày dặn chống mỏi cổ vai gáy khi ngồi học lâu.', 'Cầu Giấy - Xuân Thủy', 'ĐH Thương Mại, Hồ Tùng Mậu', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-2 days'],
    [5, 'electronics', 'Chuột gaming có dây Razer DeathAdder Essential mắt đọc 6400 DPI', 210000, 480000, 'Khá 80%', 'Form cầm ôm tay công thái học, nút click Omron siêu bền.', 'Hà Đông - Thanh Xuân', 'Học viện An Ninh Nhân Dân', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 170, '-2 days'],
    [6, 'electronics', 'Cáp HDMI 2.0 bọc dù kim loại 3 mét xuất hình ảnh 4K 60Hz', 60000, 140000, 'Như mới 99%', 'Dây bọc dù chống đứt gãy, đầu cắm mạ vàng chống nhiễu.', 'Đống Đa - Chùa Láng', 'ĐH Luật Hà Nội, Nguyễn Chí Thanh', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 85, '-3 days'],
    [2, 'electronics', 'USB Kingston 64GB chuẩn USB 3.2 Gen 1 vỏ kim loại chống nước', 75000, 160000, 'Như mới 99%', 'Tốc độ đọc ghi nhanh, lưu trữ slide và bài giảng môn học thoải mái.', 'Hòa Lạc', 'Thư viện ĐH FPT', 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 110, '-3 days'],

    // FASHION & APPAREL (12 products)
    [3, 'fashion', 'Áo khoác bomber đồng phục FPT University size L chuẩn form', 150000, 350000, 'Như mới 99%', 'Mặc đúng 2 lần thi thể dục, khóa kéo trơn tru thơm tho như mới.', 'Hòa Lạc', 'Trường ĐH FPT Hòa Lạc', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 4, 410, '-1 hours'],
    [5, 'fashion', 'Áo khoác gió 2 lớp đồng phục ĐH Bách Khoa Hà Nội size M', 130000, 310000, 'Tốt 90%', 'Chống gió chống mưa phùn mùa đông cực tốt, logo in rõ nét.', 'Bách - Kinh - Xây', 'Cổng Parabol Bách Khoa', 'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 3, 260, '-4 hours'],
    [6, 'fashion', 'Bộ vest đen thuyết trình nam form Hàn Quốc trẻ trung (Size 48)', 290000, 750000, 'Như mới 99%', 'Chỉ mặc 1 buổi bảo vệ luận văn tốt nghiệp NEU, vải tuyết mưa đứng dáng.', 'Bách - Kinh - Xây', 'KTX ĐH Kinh Tế Quốc Dân', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'PRO', 5, 380, '-7 hours'],
    [3, 'fashion', 'Áo dài trắng truyền thống nữ sinh viên cổ 2cm lụa tơ Ý (Size S-M)', 180000, 480000, 'Như mới 99%', 'Lụa co giãn mềm mại thoáng mát, mặc chụp kỷ yếu trường ĐH Sư Phạm.', 'Cầu Giấy - Xuân Thủy', 'Ký túc xá ĐH Sư Phạm Hà Nội', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 230, '-9 hours'],
    [2, 'fashion', 'Áo hoodie nỉ bông form rộng Unisex màu xám tiêu dày dặn', 110000, 260000, 'Tốt 90%', 'Nỉ bông lót trong ấm áp đi xe buýt mùa đông Hòa Lạc bao ấm.', 'Hòa Lạc', 'Dom B KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 1, 'HOT', 3, 310, '-12 hours'],
    [5, 'fashion', 'Giày Sneaker Biti\'s Hunter Core Black size 41 êm chân', 240000, 690000, 'Khá 80%', 'Đế cao su bám tốt, lót giày kháng khuẩn mang đi học hàng ngày.', 'Bách - Kinh - Xây', 'Ngõ 30 Tạ Quang Bửu, Hai Bà Trưng', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 175, '-15 hours'],
    [6, 'fashion', 'Balo laptop chống sốc Xiaomi Classic Backpack 15.6 inch màu xám', 140000, 320000, 'Tốt 90%', 'Vải dù kháng nước nhẹ, nhiều ngăn chia đựng tài liệu và bình nước.', 'Đống Đa - Chùa Láng', 'Sảnh Học viện Ngoại Giao', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 210, '-1 days'],
    [2, 'fashion', 'Áo polo đồng phục cam FPT Polytechnic size L thấm hút mồ hôi', 75000, 180000, 'Tốt 90%', 'Cổ áo dệt cứng cáp không nhão xệ, mặc đi học đúng quy chế.', 'Hà Đông - Thanh Xuân', 'Cơ sở FPT Polytechnic Trịnh Văn Bô', 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 140, '-1 days'],
    [3, 'fashion', 'Mũ lưỡi trai MLB NY đen thêu chỉ nổi chính hãng (Pass nửa giá)', 120000, 390000, 'Như mới 99%', 'Form nón cứng cáp khóa cài kim loại sau gáy sáng bóng.', 'Cầu Giấy - Xuân Thủy', 'Cổng ĐH Thương Mại, Cầu Giấy', 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 2, 190, '-2 days'],
    [5, 'fashion', 'Áo thun oversize Teelab in chữ phong cách Streetwear size XL', 65000, 160000, 'Tốt 90%', 'Cotton 100% 250gsm co giãn 4 chiều dày dặn không bai dão.', 'Hà Đông - Thanh Xuân', 'Ký túc xá ĐH Kiến Trúc, Nguyễn Trãi', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 155, '-2 days'],
    [6, 'fashion', 'Túi tote vải Canvas mộc đi học kèm khóa kéo & ngăn con đựng thẻ', 40000, 95000, 'Như mới 99%', 'Vải canvas dày dặn để vừa laptop 14 inch và giáo trình dày cộp.', 'Đống Đa - Chùa Láng', 'ĐH Luật Hà Nội, Chùa Láng', 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 125, '-3 days'],
    [2, 'fashion', 'Áo cardigan len dệt kim cổ tim basic màu be kem Hàn Quốc', 95000, 240000, 'Tốt 90%', 'Len mềm không ngứa xơ, mặc khoác ngoài váy áo sơ mi rất xinh.', 'Hòa Lạc', 'Dom C KTX FPT Hòa Lạc', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80', 'AVAILABLE', 0, null, 1, 160, '-3 days']
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
    'COURIER',
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

  // 7. Fintab Thu Chi (Deposit / Transactions) Sổ Quỹ
  const insertTx = db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, flow_type, voucher_code, payment_method, amount, balance_before, balance_after, reference_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertTx.run(1, 'TOPUP', 'IN', 'PT-20261101-01', 'VietQR MBBank', 200000, 105000, 305000, 'VQR-88219', 'Nạp tiền vào ví TakeTwo qua VietQR MBBank', '-2 days');
  insertTx.run(1, 'ESCROW_HOLD', 'HOLD', 'PC-20261101-02', 'Ví TakeTwo Escrow', -55000, 305000, 250000, 'TK-20261102-01', 'Tạm giữ tiền thanh toán đơn hàng #TK-20261102-01 (Giáo trình Triết học Mác)', '-1 days');
  insertTx.run(2, 'TOPUP', 'IN', 'PT-20261030-03', 'VietQR SeABank', 500000, 0, 500000, 'VQR-11029', 'Nạp tiền vào ví TakeTwo qua VietQR SeABank', '-3 days');
  insertTx.run(2, 'BUMP_PAYMENT', 'OUT', 'PC-20261031-04', 'Ví TakeTwo', -49000, 500000, 451000, 'bump_speedy', 'Mua Gói Dọn Trọ Gấp (5 lượt đẩy + Badge HOT Cần Pass Gấp)', '-2 days');
  insertTx.run(2, 'ESCROW_RELEASE', 'IN', 'PT-20261101-05', 'Két Escrow TakeTwo', 229000, 451000, 680000, 'TK-20261028-11', 'Giải ngân tiền bán Bàn học gấp sau 5 ngày tự động hoàn tất (Đã trừ 3% phí sàn)', '-1 days');
  insertTx.run(5, 'TOPUP', 'IN', 'PT-20261029-06', 'VietQR Vietcombank', 400000, 0, 400000, 'VQR-77192', 'Nạp tiền ví đối soát sinh viên Bách Khoa', '-4 days');
  insertTx.run(5, 'BUMP_PAYMENT', 'OUT', 'PC-20261030-07', 'Ví TakeTwo', -35000, 400000, 365000, 'bump_starter', 'Mua Gói Sinh Viên Nhanh (3 lượt đẩy bài Bách Khoa)', '-3 days');
  insertTx.run(5, 'WITHDRAW', 'OUT', 'PC-20261031-08', 'Rút về STK MBBank', -25000, 365000, 340000, 'WDR-44019', 'Rút tiền lợi nhuận bán sách về tài khoản thẻ sinh viên', '-2 days');
  insertTx.run(6, 'TOPUP', 'IN', 'PT-20261028-09', 'VietQR Techcombank', 450000, 0, 450000, 'VQR-99301', 'Nạp quỹ chi phí đăng tin KTX Ngoại Thương', '-5 days');
  insertTx.run(6, 'BUMP_PAYMENT', 'OUT', 'PC-20261029-10', 'Ví TakeTwo', -30000, 450000, 420000, 'bump_starter', 'Khấu trừ tự động đẩy bài áo vest thuyết trình NEU', '-4 days');

  db.exec('PRAGMA foreign_keys = ON;');
  console.log(`Database seeded with ${productData.length} realistic student products and full Fintab Thu Chi ledger!`);
}

module.exports = {
  db,
  initDatabase,
  seedAllData
};
