// =======================================================
// TakeTwo V2.0 Presentation Client Application
// =======================================================

let currentUser = { id: 1, name: 'Vũ Hán Tuấn' };
let currentWallet = { balance: 0, escrow_balance: 0, boost_credits: 0 };
let currentCategory = 'all';
let currentSearch = '';
let selectedProductForCheckout = null;
let selectedShippingFee = 0;
let selectedDeliveryType = 'CAMPUS';

// Format currency
function formatVND(amount) {
  if (amount === undefined || amount === null) return '0 đ';
  return Number(amount).toLocaleString('vi-VN') + ' đ';
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// Toast notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '⚠️'}</span>
    <div>${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${tabId}`);
  });

  if (tabId === 'products') loadProducts();
  if (tabId === 'orders') loadOrders();
  if (tabId === 'wallet') loadTransactions();
}

// ================= INITIALIZATION =================
window.addEventListener('DOMContentLoaded', async () => {
  await loadUsers();
  await loadMe();
  await loadProducts();
  await loadOrders();
  await loadTransactions();

  // Interval for countdown timer
  setInterval(updateCountdowns, 1000);
});

// Load Users for Switcher
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    const select = document.getElementById('userSelect');
    
    select.innerHTML = users.map(u => `
      <option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>
        ${u.name} (${u.role === 'BUYER' ? 'Người mua' : 'Người bán'}) - ${u.student_code || ''}
      </option>
    `).join('');
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Switch Active User
async function onUserSwitch(userId) {
  currentUser.id = parseInt(userId, 10);
  await loadMe();
  await loadProducts();
  await loadOrders();
  await loadTransactions();
  showToast(`Đã chuyển sang tài khoản: ${currentUser.name}`);
}

// Load current user profile & wallet
async function loadMe() {
  try {
    const res = await fetch('/api/me', {
      headers: { 'x-user-id': currentUser.id }
    });
    const data = await res.json();
    currentUser = data.user;
    currentWallet = data.wallet;

    // Update Hero Bar
    document.getElementById('heroWalletBalance').textContent = formatVND(currentWallet.balance);
    document.getElementById('heroWalletEscrow').textContent = formatVND(currentWallet.escrow_balance);
    document.getElementById('heroBoostCredits').textContent = `${currentWallet.boost_credits} lượt`;

    if (document.getElementById('modalWalletBal')) {
      document.getElementById('modalWalletBal').textContent = formatVND(currentWallet.balance);
    }
  } catch (err) {
    console.error('Error loading user profile:', err);
  }
}

// ================= 1. CHỢ ĐỒ CŨ SINH VIÊN =================
async function loadProducts() {
  try {
    const url = `/api/products?category=${encodeURIComponent(currentCategory)}&search=${encodeURIComponent(currentSearch)}`;
    const res = await fetch(url, {
      headers: { 'x-user-id': currentUser.id }
    });
    const products = await res.json();

    document.getElementById('tabCountProducts').textContent = `${products.length} đồ`;
    renderProducts(products);
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

function filterCategory(cat, btn) {
  currentCategory = cat;
  document.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadProducts();
}

function onSearchInput(val) {
  currentSearch = val;
  loadProducts();
}

function renderProducts(products) {
  const container = document.getElementById('productsGrid');

  if (!products || products.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:48px 20px; background:white; border-radius:12px; border:1px dashed #CBD5E1;">
        <div style="font-size:36px; margin-bottom:8px;">📦</div>
        <h3 style="font-size:15px; font-weight:700; color:#0F172A;">Không tìm thấy món đồ nào phù hợp</h3>
        <p style="font-size:12.5px; color:#64748B;">Hãy thử gõ từ khóa khác hoặc chọn danh mục khác nhé</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(p => {
    const isPromoted = p.is_promoted === 1;
    const isAvailable = p.status === 'AVAILABLE';
    const isInEscrow = p.status === 'IN_ESCROW';
    const isSold = p.status === 'SOLD';

    let statusOverlay = '';
    if (isInEscrow) statusOverlay = '<div class="status-badge-overlay" style="background:#D97706;">🔒 Đang giao dịch</div>';
    else if (isSold) statusOverlay = '<div class="status-badge-overlay" style="background:#059669;">✅ Đã bán</div>';

    return `
      <div class="product-card ${isPromoted ? 'promoted' : ''}">
        
        ${isPromoted ? `
          <div class="promoted-tag">
            <span>🔥</span> ${p.promoted_badge || 'ĐẨY TOP'}
          </div>
        ` : ''}

        <div class="product-thumb">
          <img src="${p.image_url}" alt="${p.title}" loading="lazy">
          ${statusOverlay}
        </div>

        <div class="product-body">
          <div class="product-cat-row">
            <span>${p.category_icon || '📦'} ${p.category_name}</span>
            <span class="condition-pill ${p.condition_level === 'LIKE_NEW' ? 'like-new' : ''}">
              ${p.condition_level === 'LIKE_NEW' ? 'Như mới 99%' : 'Tốt 90%'}
            </span>
          </div>

          <h3 class="product-title" title="${p.title}">${p.title}</h3>

          <div class="product-price-row">
            <span class="product-price">${formatVND(p.price)}</span>
            ${p.original_price ? `<span class="product-original-price">${formatVND(p.original_price)}</span>` : ''}
          </div>

          <div class="product-location">
            <span>📍</span>
            <span>${p.campus_cluster} • ${p.meetup_location}</span>
          </div>

          <div style="font-size:11.5px; color:#64748B; background:#F8FAFC; padding:6px 8px; border-radius:4px; margin-bottom:12px; border:1px solid #E2E8F0;">
            <strong>Mô tả:</strong> ${p.defect_note || 'Đồ dùng rất tốt, giữ gìn cẩn thận'}
          </div>

          <div class="product-card-footer">
            ${isAvailable ? `
              <button class="btn-buy-now" onclick="openCheckoutModal(${p.id})">
                ⚡ Mua Ngay
              </button>
            ` : `
              <button class="btn-buy-now" style="background:#94A3B8; cursor:not-allowed;" disabled>
                ${isInEscrow ? 'Đang Giao Dịch' : 'Đã Bán'}
              </button>
            `}

            <button class="btn-bump-action" title="Đưa sản phẩm lên Top 1 danh mục" onclick="bumpProduct(${p.id})">
              🚀 Đẩy lên đầu
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// TÍNH NĂNG: "🚀 ĐẨY LÊN ĐẦU (TRỪ 1 LƯỢT)"
// -------------------------------------------------------------
async function bumpProduct(productId) {
  try {
    const res = await fetch(`/api/products/${productId}/bump`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      }
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi khi đẩy bài', 'error');
      return;
    }

    showToast(data.message, 'success');
    await loadMe();
    await loadProducts();
    await loadTransactions();
  } catch (err) {
    showToast('Lỗi mạng khi đẩy bài', 'error');
  }
}

// ================= 2. QUẢN LÝ ĐƠN HÀNG & 5-DAY SLA =================
async function loadOrders() {
  try {
    const res = await fetch('/api/orders', {
      headers: { 'x-user-id': currentUser.id }
    });
    const orders = await res.json();
    document.getElementById('tabCountOrders').textContent = `${orders.length} đơn SLA`;
    renderOrders(orders);
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

function renderOrders(orders) {
  const container = document.getElementById('ordersListContainer');

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px 20px; background:white; border-radius:12px; border:1px dashed #CBD5E1;">
        <div style="font-size:36px; margin-bottom:8px;">🚚</div>
        <h3 style="font-size:15px; font-weight:700; color:#0F172A;">Chưa có đơn hàng nào</h3>
        <p style="font-size:12.5px; color:#64748B;">Hãy thử bấm "⚡ Mua Ngay" trên một món đồ ở tab Chợ để tạo đơn hàng Escrow nhé!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => {
    const isCompleted = o.status === 'COMPLETED';
    const isAutoCompleted = o.status === 'AUTO_COMPLETED';
    const isShipping = o.status === 'SHIPPING' || o.status === 'IN_ESCROW';

    let statusPill = '';
    if (isCompleted) {
      statusPill = `<span class="badge-status success">✅ Hoàn tất (Người mua xác nhận)</span>`;
    } else if (isAutoCompleted) {
      statusPill = `<span class="badge-status success" style="background:#FEF3C7; color:#B45309;">⚡ Tự động hoàn tất (Quá hạn 5 ngày)</span>`;
    } else {
      statusPill = `<span class="badge-status holding">🚚 Đang giao hàng (Tiền trong Két Escrow)</span>`;
    }

    return `
      <div class="order-card-item">
        <img src="${o.product_image || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'}" class="order-img">

        <div class="order-details">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-family:monospace; font-weight:700; color:#2563EB; font-size:12.5px;">${o.order_code}</span>
            ${statusPill}
          </div>

          <h3>${o.product_title}</h3>

          <div class="order-meta-info">
            <span>👤 <strong>Người mua:</strong> ${o.buyer_name} (${o.buyer_code || 'SV'})</span>
            <span>🏪 <strong>Người bán:</strong> ${o.seller_name} (${o.seller_code || 'SV'})</span>
            <span>📍 <strong>Nhận tại:</strong> ${o.delivery_address}</span>
            <span>🚚 <strong>Hình thức ship:</strong> ${o.delivery_type_label}</span>
          </div>

          <!-- DÒNG CẢNH BÁO TỰ ĐỘNG XÁC NHẬN SAU 5 NGÀY -->
          ${isShipping ? `
            <div class="order-sla-banner">
              <div>
                <span>⏳</span>
                <strong>Hệ thống sẽ tự động xác nhận hoàn tất và chuyển tiền cho người bán sau 5 ngày nếu người mua không khiếu nại</strong>
                <div style="font-size:11px; color:#92400E; margin-top:2px;">(Hạn chót giải ngân: ${formatDate(o.auto_confirm_deadline)})</div>
              </div>
              <div class="live-sla-timer" data-deadline="${o.auto_confirm_deadline}" style="font-size:13px; font-weight:800; color:#D97706; white-space:nowrap;">
                Đang tính...
              </div>
            </div>
          ` : `
            <div style="background:#ECFDF5; border:1px solid #A7F3D0; padding:8px 12px; border-radius:6px; font-size:12px; color:#065F46; font-weight:600;">
              🎉 Đơn hàng đã kết thúc thành công! ${formatVND(o.total_amount)} đã được giải ngân chuyển thẳng vào ví Người bán.
            </div>
          `}
        </div>

        <!-- CỤM 2 NÚT THAO TÁC DEMO -->
        <div class="order-action-btns">
          <div style="text-align:right; margin-bottom:6px;">
            <div style="font-size:11px; color:#64748B;">Tổng thanh toán (Escrow):</div>
            <div style="font-size:18px; font-weight:900; color:#DC2626;">${formatVND(o.total_amount)}</div>
          </div>

          ${isShipping ? `
            <!-- Nút 1: Người mua bấm xác nhận thủ công -->
            <button class="btn-confirm-order" onclick="confirmOrderManual(${o.id})">
              ✅ Xác nhận đã nhận hàng
            </button>

            <!-- Nút 2: Giả lập 5 ngày cho Giảng viên -->
            <button class="btn-simulate-5days" title="Mô phỏng trôi qua 5 ngày để xem tính năng tự động giải ngân" onclick="simulate5Days(${o.id})">
              ⚡ Giả lập: Qua 5 ngày (Auto)
            </button>
          ` : `
            <button class="btn-confirm-order" style="background:#94A3B8; cursor:not-allowed;" disabled>
              Đã Hoàn Tất
            </button>
          `}
        </div>

      </div>
    `;
  }).join('');

  updateCountdowns();
}

// Cập nhật đồng hồ đếm ngược thời gian thực
function updateCountdowns() {
  const elements = document.querySelectorAll('.live-sla-timer');
  const now = new Date().getTime();

  elements.forEach(el => {
    const deadline = new Date(el.dataset.deadline).getTime();
    if (!deadline) return;

    const diff = deadline - now;
    if (diff <= 0) {
      el.innerHTML = `<span style="color:#059669;">Đã đến hạn 5 ngày</span>`;
    } else {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      el.innerHTML = `⏳ Còn ${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
  });
}

// Nút 1: Xác nhận đã nhận hàng (Thủ công)
async function confirmOrderManual(orderId) {
  if (!confirm('Bạn xác nhận đã nhận được món đồ đúng mô tả và đồng ý giải phóng tiền từ két Escrow cho Người bán?')) return;

  try {
    const res = await fetch(`/api/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      }
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi khi xác nhận đơn', 'error');
      return;
    }

    showToast(data.message, 'success');
    await loadMe();
    await loadOrders();
    await loadProducts();
    await loadTransactions();
  } catch (err) {
    showToast('Lỗi mạng khi xác nhận đơn', 'error');
  }
}

// Nút 2: Giả lập qua 5 ngày (Demo giảng viên)
async function simulate5Days(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/simulate-5days`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      }
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi khi mô phỏng', 'error');
      return;
    }

    showToast(data.message, 'success');
    await loadMe();
    await loadOrders();
    await loadProducts();
    await loadTransactions();
  } catch (err) {
    showToast('Lỗi mạng khi giả lập 5 ngày', 'error');
  }
}

// ================= 3. THANH TOÁN & SHIP (CHECKOUT MODAL) =================
let allProductsCache = [];

function openCheckoutModal(productId) {
  fetch(`/api/products`, { headers: { 'x-user-id': currentUser.id } })
    .then(res => res.json())
    .then(products => {
      const p = products.find(item => item.id === productId);
      if (!p) return;

      selectedProductForCheckout = p;
      selectedShippingFee = 0;
      selectedDeliveryType = 'CAMPUS';

      document.getElementById('checkoutProductImg').src = p.image_url;
      document.getElementById('checkoutProductTitle').textContent = p.title;
      document.getElementById('checkoutProductPrice').textContent = formatVND(p.price);

      document.getElementById('checkoutName').value = currentUser.name;
      document.getElementById('checkoutAddress').value = `${p.meetup_location} (${p.campus_cluster})`;

      // Reset shipping selection
      document.querySelectorAll('.shipping-option').forEach(el => el.classList.remove('selected'));
      document.querySelector('.shipping-option').classList.add('selected');
      document.querySelector('input[name="deliveryType"][value="CAMPUS"]').checked = true;

      updateCheckoutSummary();
      openModal('modalCheckout');
    });
}

function selectShipping(type, fee, element) {
  selectedDeliveryType = type;
  selectedShippingFee = fee;

  document.querySelectorAll('.shipping-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  element.querySelector('input[type="radio"]').checked = true;

  updateCheckoutSummary();
}

function updateCheckoutSummary() {
  if (!selectedProductForCheckout) return;

  const productPrice = selectedProductForCheckout.price;
  const total = productPrice + selectedShippingFee;

  document.getElementById('summaryProductPrice').textContent = formatVND(productPrice);
  document.getElementById('summaryShippingFee').textContent = formatVND(selectedShippingFee);
  document.getElementById('summaryTotalAmount').textContent = formatVND(total);
}

async function confirmCheckout() {
  if (!selectedProductForCheckout) return;

  const recipientName = document.getElementById('checkoutName').value.trim();
  const recipientPhone = document.getElementById('checkoutPhone').value.trim();
  const deliveryAddress = document.getElementById('checkoutAddress').value.trim();

  if (!recipientName || !recipientPhone || !deliveryAddress) {
    showToast('Vui lòng điền đầy đủ tên, số điện thoại và địa chỉ nhận đồ', 'error');
    return;
  }

  const submitBtn = document.getElementById('btnSubmitCheckout');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang xử lý ví Escrow...';

  try {
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      },
      body: JSON.stringify({
        product_id: selectedProductForCheckout.id,
        delivery_type: selectedDeliveryType,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        delivery_address: deliveryAddress
      })
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = '✅ Xác Nhận Thanh Toán';

    if (!res.ok) {
      showToast(data.error || 'Lỗi khi thanh toán', 'error');
      return;
    }

    closeModal('modalCheckout');
    showToast(data.message, 'success');

    await loadMe();
    await loadProducts();
    await loadOrders();
    await loadTransactions();

    // Tự động chuyển sang tab Đơn hàng để người dùng thấy ngay tiến trình Escrow
    switchTab('orders');
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = '✅ Xác Nhận Thanh Toán';
    showToast('Lỗi mạng khi thanh toán', 'error');
  }
}

// ================= 4. NẠP TIỀN & LỊCH SỬ GIAO DỊCH =================
async function quickTopup(amount) {
  try {
    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi nạp tiền', 'error');
      return;
    }

    showToast(data.message, 'success');
    await loadMe();
    await loadTransactions();
  } catch (err) {
    showToast('Lỗi mạng khi nạp tiền', 'error');
  }
}

async function loadTransactions() {
  try {
    const res = await fetch('/api/transactions?all=true', {
      headers: { 'x-user-id': currentUser.id }
    });
    const txs = await res.json();
    document.getElementById('tabCountTxs').textContent = `${txs.length} GD`;
    renderTransactions(txs);
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
}

function renderTransactions(txs) {
  const tbody = document.getElementById('txTableBody');

  if (!txs || txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748B;">Chưa có giao dịch nào</td></tr>`;
    return;
  }

  tbody.innerHTML = txs.map(t => {
    const isPlus = t.amount > 0;
    const isHolding = t.status === 'HOLDING';

    return `
      <tr>
        <td class="tx-code-cell">${t.tx_code}</td>
        <td>
          <span style="font-weight:700; color:#0F172A;">${t.type_label}</span>
          <div style="font-size:11px; color:#64748B;">${t.user_name} (${t.user_code || 'SV'})</div>
        </td>
        <td style="max-width:320px;">${t.description}</td>
        <td style="font-size:12px; color:#64748B; white-space:nowrap;">${formatDate(t.created_at)}</td>
        <td class="${isPlus ? 'tx-amount-plus' : 'tx-amount-minus'}" style="text-align:right; white-space:nowrap;">
          ${isPlus ? '+' : ''}${formatVND(t.amount)}
        </td>
        <td style="text-align:right; font-weight:700; color:#334155; white-space:nowrap;">${formatVND(t.balance_after)}</td>
        <td>
          <span class="badge-status ${isHolding ? 'holding' : 'success'}">
            ${isHolding ? 'Đang tạm giữ' : 'Thành công'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ================= 5. MUA GÓI ĐẨY BÀI VIP (DECOY EFFECT) =================
function openBoostModal() {
  document.getElementById('modalWalletBal').textContent = formatVND(currentWallet.balance);
  openModal('modalBoost');
}

async function buyPackage(pkgId) {
  try {
    const res = await fetch('/api/bump-packages/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      },
      body: JSON.stringify({ package_id: pkgId })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi khi mua gói', 'error');
      return;
    }

    closeModal('modalBoost');
    showToast(data.message, 'success');
    await loadMe();
    await loadTransactions();
  } catch (err) {
    showToast('Lỗi mạng khi mua gói', 'error');
  }
}

// ================= 6. ĐĂNG TIN PASS ĐỒ MỚI =================
function openPostModal() {
  openModal('modalPost');
}

async function submitPostProduct() {
  const title = document.getElementById('postTitle').value.trim();
  const category_id = document.getElementById('postCategory').value;
  const price = document.getElementById('postPrice').value;
  const original_price = document.getElementById('postOriginalPrice').value;
  const defect_note = document.getElementById('postDefect').value.trim();
  const meetup_location = document.getElementById('postLocation').value.trim();
  const auto_bump = document.getElementById('postAutoBump').checked;

  if (!title || !price) {
    showToast('Vui lòng nhập tên món đồ và giá muốn pass lại', 'error');
    return;
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id
      },
      body: JSON.stringify({
        title,
        category_id,
        price,
        original_price,
        defect_note,
        meetup_location,
        campus_cluster: 'Hòa Lạc',
        auto_bump
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi khi đăng tin', 'error');
      return;
    }

    closeModal('modalPost');
    showToast(data.message, 'success');

    // Reset form
    document.getElementById('postTitle').value = '';
    document.getElementById('postPrice').value = '';
    document.getElementById('postOriginalPrice').value = '';

    await loadMe();
    await loadProducts();
    await loadTransactions();
    switchTab('products');
  } catch (err) {
    showToast('Lỗi mạng khi đăng tin', 'error');
  }
}

// Modal helper
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}
