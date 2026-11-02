# 🚀 TAKETWO MARKETPLACE (PHIÊN BẢN NÂNG CẤP V2.0)
### Sàn C2C Đồ Cũ Sinh Viên Hà Nội — Tích Hợp Ví Điện Tử Nội Bộ, Két Escrow 5 Ngày & Giao Diện Pancake Fintab

Dự án đã được xây dựng hoàn chỉnh toàn bộ Full-stack (Database SQLite có sẵn dữ liệu mẫu, Backend REST APIs, và Giao diện Frontend phong cách Pancake Fintab).

---

## ⚡ HƯỚNG DẪN KHỞI CHẠY NHANH (QUICK START)

1. Mở cửa sổ dòng lệnh (Terminal/PowerShell) tại thư mục dự án:
   ```bash
   cd e:\Fall2026\ISC301\Project
   ```
2. Khởi chạy máy chủ:
   ```bash
   npm start
   ```
   *(Hoặc `node server.js`)*
3. Mở trình duyệt web và truy cập:
   ```
   http://localhost:3000
   ```

---

## 🌟 CÁC TÍNH NĂNG ĐÃ ĐƯỢC XÂY DỰNG & HƯỚNG DẪN DÙNG THỬ

### 1. Cơ Chế Đổi Tài Khoản Nhanh (Account Switcher)
Góc trên bên phải Header có menu chọn vai trò, cho phép bạn trải nghiệm đầy đủ các luồng:
* **👤 Vũ Hán Tuấn (Khách mua - MSSV: HE194875 - FPT Hòa Lạc):** Đang có sẵn 250.000đ trong ví, dùng để trải nghiệm luồng Đặt mua Escrow và quản lý đơn hàng.
* **🏪 Nguyễn Minh Anh (Chủ Gian Hàng - MSSV: SE182210):** Đang có sẵn 480.000đ trong ví và nhiều món đồ đăng bán, dùng để trải nghiệm tính năng Đẩy tin 1-Click và duyệt đơn/giao hàng.
* **🛡️ Ban Quản Trị (Admin TakeTwo):** Xem Dashboard 5 chỉ số KPI, Sổ quỹ tiền mặt 30,25 triệu, và phán quyết trọng tài giải quyết khiếu nại.

---

### 2. Trải Nghiệm Đẩy Bài 1-Click Qua Ví (Xóa Bỏ Ma Sát Chuyển Khoản 15k)
* **Vấn đề cũ:** Mỗi lần đăng/đẩy bài lại phải quét mã ngân hàng 15.000đ gây nản lòng.
* **Cách thử nghiệm:**
  1. Chọn tài khoản **Nguyễn Minh Anh (Chủ gian hàng)** tại góc phải.
  2. Bấm vào nút màu vàng **"🚀 Đẩy Tin 1-Click"** trên một món đồ của Minh Anh (ví dụ: Nồi cơm điện mini Lock&Lock).
  3. Popup hiển thị các gói combo định giá chim mồi:
     * *Gói Lẻ (1 lượt): 15.000đ*
     * *Gói Sinh Viên Nhanh (3 lượt): 35.000đ*
     * *Gói Dọn Trọ Gấp (5 lượt + Badge HOT - Best Value): 49.000đ*
     * *Gói KTX Pro (15 lượt + Auto-Bump): 119.000đ*
  4. Bấm **"Đẩy Bằng Gói Này"** $\rightarrow$ Hệ thống lập tức trừ tiền từ số dư ví trong 0,5 giây, bài viết được đưa ngay lên **Top 1 Danh Mục** mà không cần mở app ngân hàng!

---

### 3. Trải Nghiệm Đặt Mua & Khóa Tiền Tạm Giữ (Escrow Checkout & Shipping)
* **Cách thử nghiệm:**
  1. Chọn tài khoản **Vũ Hán Tuấn (Khách mua)**.
  2. Chọn một món đồ đang có trạng thái **"Đang bán"** và bấm nút màu xanh **"⚡ Đặt Mua (Escrow)"**.
  3. Màn hình Checkout xuất hiện với đầy đủ lựa chọn:
     * *Hình thức nhận hàng:* Hẹn gặp tại Campus (Miễn phí 0đ) hoặc Giao bưu tá phòng KTX (+15.000đ).
     * *Mã Voucher sinh viên:* Tự động giảm -5.000đ.
     * *Cam kết Escrow Shield:* Tiền được khóa trong két TakeTwo, người bán chưa nhận được tiền.
  4. Bấm **"🔒 Xác Nhận & Giữ Chỗ Tiền"** $\rightarrow$ Tiền khả dụng của Tuấn bị trừ và chuyển vào Ngăn **Số Dư Tạm Giữ (Escrow Balance)**; Sản phẩm tự động khóa sang trạng thái **"Đang giữ chỗ 🔒"**.

---

### 4. Đồng Hồ Bảo Vệ 5 Ngày (120h) & Tự Động Xác Nhận (Auto-Confirmation SLA)
* Bấm vào Tab **"📦 Đơn Hàng & Vận Chuyển"**:
* Bạn sẽ thấy đơn hàng mẫu `#TK-20261102-01` (Giáo trình Triết học Mác - Lênin) đang có **Đồng hồ đếm ngược trực tiếp theo thời gian thực (Live Countdown Timer)**: `⏳ Còn 3d 23h 58m 12s`.
* **Thử nghiệm 3 kịch bản:**
  * *Kịch bản 1 (Hài lòng):* Tuấn bấm **"Đã Nhận & Hài Lòng"** $\rightarrow$ Hệ thống tự động giải phóng tiền tạm giữ sang ví Minh Anh (tự động khấu trừ 3% hoa hồng sàn), cập nhật món đồ sang "Đã bán ✅", và cộng điểm Sống Xanh (Eco Points) cho Tuấn.
  * *Kịch bản 2 (Hết 120h):* Nếu người mua không có hành động gì trong 5 ngày, hệ thống sẽ tự động kích hoạt tiến trình Auto-Confirm và giải ngân tiền cho Người bán để bảo vệ Người bán.
  * *Kịch bản 3 (Khiếu nại):* Bấm nút đỏ **"Khiếu Nại"** $\rightarrow$ Nhập lý do (ví dụ: "Sách bị rách gáy") $\rightarrow$ Đồng hồ 5 ngày **LẬP TỨC ĐÓNG BĂNG**, đơn chuyển sang trạng thái "⚠️ Đang Tranh Chấp".

---

### 5. Quản Lý Ví Điện Tử & Nạp/Rút Tiền VietQR
* Bấm vào Tab **"💳 Ví Điện Tử & Sổ Cái Giao Dịch"**:
* Xem 2 ngăn số dư độc lập: **Số Dư Khả Dụng** và **Số Dư Tạm Giữ Escrow**.
* **Thử Nạp Tiền:** Bấm nút **"+ Nạp Tiền VietQR"** $\rightarrow$ Chọn mệnh giá (50k, 100k, 200k, 500k) $\rightarrow$ Xem mã VietQR động được tạo $\rightarrow$ Bấm nút **"⚡ [Mô Phỏng] Quét Mã Chuyển Khoản Thành Công"** để tiền lập tức nhảy vào ví!
* **Thử Rút Tiền:** Bấm nút **"⤓ Rút Tiền Về STK"** $\rightarrow$ Nhập số tài khoản thẻ sinh viên để rút tiền về.
* Xem bảng **Sổ Cái Biến Động Số Dư (Transaction Ledger)** lưu vết chi tiết từng đồng tiền vào/ra minh bạch.

---

### 6. Cổng Quản Trị Hệ Thống & Trọng Tài Escrow (Admin Dashboard)
* Chọn tài khoản **🛡️ Ban Quản Trị TakeTwo** và bấm Tab **"📊 Báo Cáo 5 KPIs & Quản Trị"**:
* Xem trực tiếp 5 chỉ số đo lường sống còn:
  1. *North Star Metric:* Giao dịch xác minh 2 phía hoàn tất.
  2. *GMV Hoàn Tất:* Tổng doanh số đồ cũ thật.
  3. *Tin Đăng Thật:* Theo dõi chỉ tiêu Gate W12 ($\ge 40$ listings).
  4. *Tỷ Lệ Repeat Seller:* Phần trăm người bán quay lại đăng $\ge 2$ sản phẩm.
  5. *Quỹ Tiền Mặt:* Sổ quỹ đối soát $30.250.000 \text{ VNĐ}$.
* **Bảng Phán Quyết Tranh Chấp:** Cho phép Admin bấm **"✓ Hoàn 100% Tiền Cho Buyer"** hoặc **"✓ Bác Bỏ & Chuyển Tiền Cho Seller"**.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```
e:\Fall2026\ISC301\Project\
├── package.json                          # Cấu hình dependency & lệnh npm start
├── server.js                             # Express Backend RESTful API & Escrow State Machine
├── db.js                                 # Database SQLite (node:sqlite) + Dữ liệu mẫu sinh viên
├── taketwo.db                            # File dữ liệu SQLite lưu trữ vĩnh viễn
├── TAKETWO_MASTER_V2_SPECIFICATION.md    # Tài liệu đặc tả kỹ thuật & mô hình kinh doanh chi tiết
├── public/
│   ├── index.html                        # Giao diện Pancake Fintab Tiếng Việt 100%
│   ├── css/
│   │   └── style.css                     # Design System Cobalt Blue (#1677FF), Status Pills
│   └── js/
│       └── app.js                        # Xử lý State, Escrow Countdown, VietQR, Đẩy tin 1-Click
└── README.md
```
