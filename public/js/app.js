// TakeTwo Marketplace - Frontend Application Logic (Pancake Fintab Edition)
// Comprehensive State & Fintab Thu Chi (Deposit / Transactions) Workflow

let currentUser = null;
let currentWallet = { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
let allUsers = [];
let bumpPackages = [];
let currentCategory = 'all';
let currentTransactionTab = 'all';
let checkoutProduct = null;
let bumpTargetProduct = null;
let currentTransactionsList = [];
let liveInterval = null;

// Safe DOM Access Utilities
function $id(id) {
  return document.getElementById(id);
}
function $text(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== undefined && val !== null ? val : '';
}
function $html(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html !== undefined && html !== null ? html : '';
}
function $val(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}
function $setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function $src(id, src) {
  const el = document.getElementById(id);
  if (el) el.src = src;
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
});

async function initApp() {
  try { await loadUsers(); } catch (e) { console.error('Error loadUsers:', e); }
  try { await loadMe(); } catch (e) { console.error('Error loadMe:', e); }
  try { await loadBumpPackages(); } catch (e) { console.error('Error loadBumpPackages:', e); }
  try { await loadOverview(); } catch (e) { console.error('Error loadOverview:', e); }
  try { await loadProducts(); } catch (e) { console.error('Error loadProducts:', e); }
  try { await loadOrders(); } catch (e) { console.error('Error loadOrders:', e); }
  try { await loadTransactionsTable(); } catch (e) { console.error('Error loadTransactionsTable:', e); }

  // Periodic refresh for auto-confirm 5-day SLAs & live counters
  if (liveInterval) clearInterval(liveInterval);
  liveInterval = setInterval(() => {
    try { updateCountdowns(); } catch (e) {}
  }, 1000);
}

// -------------------------------------------------------------
// USER SWITCHING & INITIALIZATION
// -------------------------------------------------------------
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    allUsers = await res.json();
    const select = $id('userSwitcher');
    if (select) {
      select.innerHTML = allUsers.map(u => `
        <option value="${u.id}">
          ${u.role === 'ADMIN' ? '🛡️ ' + u.name : (u.role === 'SELLER' ? '🏪 ' + u.name : '👤 ' + u.name)} (${u.role})
        </option>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

async function onUserSwitch(userId) {
  try {
    const res = await fetch(`/api/me?user_id=${userId}`);
    const data = await res.json();
    currentUser = data.user;
    currentWallet = data.wallet || { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
    updateHeaderWalletDisplay();
    showToast(`Đã chuyển sang tài khoản: ${currentUser.name} (${currentUser.role})`, 'success');

    // Refresh views
    loadOverview();
    loadProducts();
    loadOrders();
    loadTransactionsTable();
  } catch (err) {
    showToast('Lỗi khi đổi tài khoản', 'error');
  }
}

async function loadMe() {
  try {
    const userSelect = $id('userSwitcher');
    const activeId = (userSelect && userSelect.value) ? userSelect.value : 1;
    const res = await fetch(`/api/me?user_id=${activeId}`);
    const data = await res.json();
    currentUser = data.user;
    currentWallet = data.wallet || { available_balance: 0, escrow_balance: 0, boost_credits: 0 };
    updateHeaderWalletDisplay();
  } catch (err) {
    console.error('Error loading current user:', err);
  }
}

function updateHeaderWalletDisplay() {
  if (!currentWallet) return;
  const availText = formatVND(currentWallet.available_balance);
  const escrowText = formatVND(currentWallet.escrow_balance);
  const creditsText = `${currentWallet.boost_credits || 0} lượt`;

  $text('topbarWalletAvailable', availText);
  $text('topbarWalletEscrow', escrowText);
  $text('topbarBoostCredits', creditsText);

  // Overview Cards
  $text('kpiOverviewWalletAvail', availText);
  $text('kpiOverviewEscrow', escrowText);
  $text('kpiOverviewBoostCredits', creditsText);

  // Overview Bar
  $text('barAvailVal', availText);
  $text('barEscrowVal', escrowText);

  // Thu chi strip
  $text('stripAvailableBal', availText);
  $text('stripEscrowBal', escrowText);

  // Packages View
  $text('packagesWalletBal', availText);
  $text('packagesCurrentCredits', creditsText);

  // Modals
  $text('withdrawAvailableDisplay', availText);
  $text('checkoutCurrentBalance', `Khả dụng: ${availText}`);

  if (currentUser) {
    $text('sidebarUserName', currentUser.name);
    $text('sidebarStudentCode', currentUser.student_code || 'TAKETWO');
    $src('sidebarUserAvatar', currentUser.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');
    $text('topupUserCode', currentUser.student_code || 'TAKETWO');

    const roleBadge = document.querySelector('#sidebarUserRole .fintab-badge');
    if (roleBadge) {
      roleBadge.textContent = currentUser.role;
      roleBadge.className = `fintab-badge ${currentUser.role === 'ADMIN' ? 'fintab-badge-danger' : (currentUser.role === 'SELLER' ? 'fintab-badge-warning' : 'fintab-badge-blue')}`;
    }

    $text('barEcoVal', `${(currentUser.co2_saved_kg || 18.5).toFixed(1)} kg CO2`);
  }
}

// Quick Top-up (+100k, +500k) directly from topbar or KPI cards
async function quickTopup(amount) {
  try {
    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({
        amount: amount,
        bank_name: 'MBBank VietQR'
      })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(`⚡ Nạp thành công +${formatVND(amount)} vào ví! Mã chứng từ: ${data.voucher_code}`, 'success');
    await loadMe();
    await loadOverview();
    await loadTransactionsTable();
  } catch (err) {
    showToast('Lỗi khi nạp tiền nhanh', 'error');
  }
}

// -------------------------------------------------------------
// SIDEBAR NAVIGATION (PANCAKE FINTAB)
// -------------------------------------------------------------
function switchNav(navId) {
  const navItems = ['overview', 'marketplace', 'orders', 'transactions', 'packages', 'disputes'];
  
  navItems.forEach(id => {
    const navEl = $id(`nav-${id}`);
    const viewEl = $id(`view-${id}`);
    if (navEl) navEl.classList.toggle('active', id === navId);
    if (viewEl) viewEl.style.display = (id === navId) ? 'block' : 'none';
  });

  const pageTitles = {
    overview: 'Tổng quan hoạt động',
    marketplace: 'Sản phẩm & Đồ cũ',
    orders: 'Đơn hàng & Vận chuyển (SLA 5 Ngày)',
    transactions: 'Sổ quỹ Thu chi (Deposit & Payment)',
    packages: 'Gói đẩy tin nổi bật 1-Click',
    disputes: 'Trọng tài tranh chấp & 5 KPIs'
  };

  $text('breadcrumbCurrent', pageTitles[navId] || 'Tổng quan');

  if (navId === 'overview') loadOverview();
  if (navId === 'marketplace') loadProducts();
  if (navId === 'orders') loadOrders();
  if (navId === 'transactions') loadTransactionsTable();
  if (navId === 'packages') renderPackagesTab();
  if (navId === 'disputes') loadDisputesView();
}

function focusCampusFilter() {
  switchNav('marketplace');
  const el = $id('marketCampusSelect');
  if (el) el.focus();
}

function executeGlobalSearch() {
  const term = $val('globalSearchInput', '');
  switchNav('marketplace');
  $setVal('marketCampusSelect', 'all');
  loadProducts(term);
}

// -------------------------------------------------------------
// 1. OVERVIEW DASHBOARD (FINTAB OVERVIEW)
// -------------------------------------------------------------
async function loadOverview() {
  try {
    const resMetrics = await fetch('/api/admin/metrics');
    const metrics = await resMetrics.json();

    $text('kpiOverviewGMV', formatVND(metrics.gmv_completed || 1280000));
    $text('kpiOverviewEscrow', formatVND(metrics.escrow_held_pool || 55000));
    $text('kpiOverviewWalletAvail', formatVND(currentWallet.available_balance));
    $text('kpiOverviewBoostCredits', `${currentWallet.boost_credits || 0} lượt`);

    // Orders summary
    const resOrders = await fetch('/api/orders', {
      headers: { 'x-user-id': currentUser ? currentUser.id : 1 }
    });
    const orders = await resOrders.json();
    const activeOrders = orders.filter(o => o.status === 'DELIVERING' || o.status === 'REQUESTED');
    $text('kpiOverviewOrdersCount', `${orders.length} đơn (${activeOrders.length} đang xử lý)`);

    // Overview SLA Order Box
    const activeOrder = orders.find(o => o.status === 'DELIVERING') || orders.find(o => o.status === 'REQUESTED') || orders[0];
    const slaBox = $id('overviewSlaBox');
    if (slaBox) {
      if (activeOrder) {
        slaBox.innerHTML = `
          <div style="background: #F8FAFC; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--primary); font-size: 13px;">${activeOrder.order_code}</span>
              <span class="fintab-badge fintab-badge-warning"><span class="dot"></span> ${activeOrder.status}</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-title); line-height: 1.3; margin-bottom: 4px;">${activeOrder.product_title}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Giá trị: <strong>${formatVND(activeOrder.total_paid)}</strong> • Két Escrow khóa</div>
          </div>

          <div style="text-align: center; background: #FFFBEB; border: 1px dashed #FCD34D; border-radius: var(--radius-md); padding: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #B45309;">ĐỒNG HỒ TỰ ĐỘNG GIẢI NGÂN (SLA 5 NGÀY / 120H)</div>
            <div class="live-countdown" data-deadline="${activeOrder.auto_confirm_deadline || ''}" style="font-size: 16px; font-weight: 800; color: #D97706; margin: 4px 0;">Đang tính...</div>
            <div style="font-size: 11px; color: var(--text-muted);">Hết 5 ngày không khiếu nại -> Tiền tự động về Người bán</div>

            <div style="margin-top: 10px;">
              ${activeOrder.status === 'DELIVERING' ? `
                <button class="btn-fintab btn-fintab-amber" style="width: 100%; padding: 8px; font-weight: 700; font-size: 12px;" onclick="simulate5Days(${activeOrder.id})" title="Mô phỏng 5 ngày trôi qua không có khiếu nại -> Tiền giải ngân cho Người bán">
                  ⚡ Demo Giảng Viên: Qua 5 Ngày (Auto-Confirm)
                </button>
              ` : (activeOrder.status === 'REQUESTED' ? `
                <button class="btn-fintab btn-fintab-success" style="width: 100%; padding: 8px; font-weight: 700; font-size: 12px;" onclick="quickShipOrder(${activeOrder.id})">
                  🚚 Bấm Gửi Bưu Cục Ngay (Kích Hoạt SLA 5 Ngày)
                </button>
              ` : `
                <button class="btn-fintab btn-fintab-outline" style="width: 100%; padding: 8px; font-size: 12px;" onclick="switchNav('orders')">
                  Xem Danh Sách Đơn Hàng ↗
                </button>
              `)}
            </div>
          </div>
        `;
      } else {
        slaBox.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Không có đơn hàng nào đang chạy SLA</div>`;
      }
    }

    // Recent 5 Ledger Items
    const resTx = await fetch('/api/transactions?tab=all&view_all=true');
    const txData = await resTx.json();
    const tbody = $id('overviewLedgerTbody');
    if (tbody) {
      const recent5 = (txData.items || []).slice(0, 5);

      if (recent5.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px;">Chưa có chứng từ</td></tr>`;
      } else {
        tbody.innerHTML = recent5.map(t => {
          const isPositive = t.flow_type === 'IN';
          const amtColor = isPositive ? '#10B981' : (t.flow_type === 'HOLD' ? '#D97706' : '#EF4444');
          const amtSign = isPositive ? '+' : '';

          return `
            <tr>
              <td><strong style="color:var(--primary); font-size:12px;">${t.voucher_code || 'PT-20261102'}</strong></td>
              <td style="font-size:12.5px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.description}</td>
              <td style="font-weight:700; color:${amtColor};">${amtSign}${formatVND(t.amount)}</td>
              <td><span class="fintab-badge fintab-badge-success"><span class="dot"></span> Đã ghi sổ</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    updateCountdowns();
  } catch (err) {
    console.error('Error loading overview:', err);
  }
}

function onOverviewFilterChange() {
  const campus = $val('overviewCampusFilter', 'all');
  $text('sidebarCampusLabel', campus === 'all' ? 'Toàn Hà Nội' : `Cụm ${campus}`);
  $setVal('marketCampusSelect', campus);
  loadProducts();
}

// -------------------------------------------------------------
// 2. PRODUCT MARKETPLACE (50 REALISTIC STUDENT PRODUCTS)
// -------------------------------------------------------------
async function loadProducts(overrideSearch) {
  const campus = $val('marketCampusSelect', 'all');
  const condition = $val('conditionFilter', 'all');
  const search = overrideSearch || $val('globalSearchInput', '');

  const url = `/api/products?campus=${encodeURIComponent(campus)}&category=${encodeURIComponent(currentCategory)}&condition=${encodeURIComponent(condition)}&search=${encodeURIComponent(search)}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'x-user-id': currentUser ? currentUser.id : 1 }
    });
    const products = await res.json();
    renderProducts(products);
  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

function onFilterChange() {
  loadProducts();
}

function setCategoryPill(catId, btn) {
  currentCategory = catId;
  document.querySelectorAll('.btn-pill-group .btn-pill-item').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadProducts();
}

function renderProducts(products) {
  const grid = $id('productGrid');
  $text('productResultCount', `${products ? products.length : 0} món đồ`);
  $text('navProductCount', `${products ? products.length : 0} SP`);

  if (!grid) return;

  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border);">
        <div style="font-size: 36px; margin-bottom: 8px;">📦</div>
        <h3 style="font-size: 15px; font-weight: 700; color: var(--text-title);">Không tìm thấy sản phẩm nào</h3>
        <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">Hãy thử chọn Cụm trường khác hoặc gõ từ khóa tìm kiếm</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => {
    const isOwner = currentUser && (currentUser.id === p.seller_id);
    const isAvailable = p.status === 'AVAILABLE';

    let statusBadge = '';
    if (p.status === 'AVAILABLE') statusBadge = '<span class="fintab-badge fintab-badge-success"><span class="dot"></span> Đang bán</span>';
    else if (p.status === 'RESERVED') statusBadge = '<span class="fintab-badge fintab-badge-warning"><span class="dot"></span> Đang giữ chỗ 🔒</span>';
    else statusBadge = '<span class="fintab-badge fintab-badge-neutral"><span class="dot"></span> Đã bán ✅</span>';

    return `
      <div class="fintab-item-card">
        <div class="item-thumb-box">
          <img src="${p.image_url}" alt="${p.title}" loading="lazy">
          <div class="item-badge-corner">
            ${p.is_promoted && p.promoted_badge === 'HOT' ? '<span style="background:#DC2626; color:white; font-size:10px; font-weight:800; padding:3px 7px; border-radius:4px; box-shadow:0 2px 4px rgba(220,38,38,0.4);">🔥 CẦN PASS GẤP</span>' : ''}
            ${p.is_promoted && p.promoted_badge === 'PRO' ? '<span style="background:linear-gradient(135deg,#7C3AED,#4F46E5); color:white; font-size:10px; font-weight:800; padding:3px 7px; border-radius:4px;">⭐ TOP NỔI BẬT</span>' : ''}
          </div>
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(15,23,42,0.7); color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">
            👁️ ${p.view_count || 12} views
          </div>
        </div>

        <div class="item-card-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            ${statusBadge}
            <span style="font-size: 11px; font-weight: 600; background: #EFF6FF; color: var(--primary); padding: 2px 6px; border-radius: 4px;">${p.condition_level}</span>
          </div>

          <h3 class="item-title" title="${p.title}">${p.title}</h3>

          <div class="item-price-row">
            <span class="current-price">${formatVND(p.price)}</span>
            ${p.original_price ? `<span class="striked-price">${formatVND(p.original_price)}</span>` : ''}
          </div>

          <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
            <span>📍 ${p.campus_cluster} • ${p.meetup_location}</span>
          </div>

          <div style="background: #F8FAFC; border: 1px dashed var(--border); padding: 6px 8px; border-radius: 4px; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
            <strong>Mô tả:</strong> ${p.defect_note || 'Tình trạng còn rất tốt'}
          </div>

          <div class="item-seller-row">
            <div style="display: flex; align-items: center; gap: 6px;">
              <img src="${p.seller_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}" style="width:22px; height:22px; border-radius:50%; object-fit:cover;">
              <span style="font-size: 11.5px; font-weight: 600; color: var(--text-title);">${p.seller_name ? p.seller_name.split(' ')[0] : 'Seller'}</span>
              <span style="font-size: 10.5px; color: #F59E0B; font-weight: 700;">★ ${p.seller_rating || 5.0}</span>
            </div>

            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn-fintab btn-fintab-amber" style="padding: 4px 8px; font-size: 11.5px;" onclick="quickBumpProduct(${p.id})" title="Đẩy bài lên đầu danh mục (Trừ 1 lượt VIP hoặc 15.000đ)">
                🚀 Đẩy Top
              </button>
              ${isAvailable ? `
                <button class="btn-fintab btn-fintab-primary" style="padding: 4px 9px; font-size: 11.5px;" onclick="openCheckoutModal(${p.id})" title="Đặt mua món đồ qua Ví Escrow 5 Ngày">
                  ⚡ Mua Ngay
                </button>
              ` : `
                <button class="btn-fintab btn-fintab-outline" style="padding: 4px 8px; font-size: 11px; cursor:not-allowed; opacity:0.6;" disabled>
                  Đã Giữ
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 1-Click Bump Product to Top 1
async function quickBumpProduct(productId) {
  try {
    const res = await fetch(`/api/products/${productId}/bump`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(data.message, 'success');
    await loadMe();
    await loadProducts();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast('Lỗi khi đẩy tin lên đầu', 'error');
  }
}

// -------------------------------------------------------------
// 3. FINTAB THU CHI (TRANSACTIONS / DEPOSIT) SỔ QUÝ
// -------------------------------------------------------------
function setTransactionTab(tab, btn) {
  currentTransactionTab = tab;
  document.querySelectorAll('#view-transactions .btn-pill-group .btn-pill-item').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadTransactionsTable();
}

async function loadTransactionsTable() {
  const search = $val('transactionSearchInput', '');
  const chkEl = $id('chkViewAllLedger');
  const viewAll = chkEl ? chkEl.checked : false;

  const url = `/api/transactions?tab=${currentTransactionTab}&search=${encodeURIComponent(search)}&view_all=${viewAll}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'x-user-id': currentUser ? currentUser.id : 1 }
    });
    const data = await res.json();
    currentTransactionsList = data.items || [];

    // Update Fintab Summary Strip
    if (data.stats) {
      $text('stripTotalIncome', `+ ${formatVND(data.stats.total_income)}`);
      $text('stripTotalExpense', `- ${formatVND(data.stats.total_expense)}`);
      $text('stripAvailableBal', formatVND(currentWallet.available_balance));
      $text('stripEscrowBal', formatVND(currentWallet.escrow_balance));
    }

    const tbody = $id('transactionsTableBody');
    if (!tbody) return;

    if (!currentTransactionsList || currentTransactionsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">Không có chứng từ thu chi nào phù hợp với bộ lọc</td></tr>`;
      return;
    }

    tbody.innerHTML = currentTransactionsList.map((t, index) => {
      const isDeposit = t.flow_type === 'IN';
      const isPayment = t.flow_type === 'OUT';
      const isHold = t.flow_type === 'HOLD';

      let typeBadge = '';
      if (isDeposit) typeBadge = '<span class="fintab-badge fintab-badge-success"><span class="dot"></span> Phiếu Thu (Deposit)</span>';
      else if (isPayment) typeBadge = '<span class="fintab-badge fintab-badge-danger"><span class="dot"></span> Phiếu Chi (Payment)</span>';
      else typeBadge = '<span class="fintab-badge fintab-badge-warning"><span class="dot"></span> Tạm Giữ Escrow</span>';

      const amtColor = isDeposit ? '#10B981' : (isHold ? '#D97706' : '#EF4444');
      const amtSign = isDeposit ? '+' : '';

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--primary); font-size: 12.5px;">${t.voucher_code || 'PT-20261102-01'}</div>
            <div style="font-size: 10.5px; color: var(--text-light); font-family: monospace;">Ref: ${t.reference_id || 'REF-T2'}</div>
          </td>
          <td style="font-size: 12px; color: var(--text-muted);">${t.created_at}</td>
          <td>${typeBadge}</td>
          <td>
            <div style="font-weight: 600; font-size: 12.5px;">${t.user_name || (currentUser ? currentUser.name : 'Người dùng')}</div>
            <div style="font-size: 11px; color: var(--text-light);">${t.user_student_code || 'SINH VIÊN'}</div>
          </td>
          <td style="font-size: 12.5px; max-width: 250px;">${t.description}</td>
          <td style="font-size: 12px; color: var(--text-muted);">${t.payment_method || 'Ví TakeTwo'}</td>
          <td style="text-align: right; font-weight: 800; font-size: 13.5px; color: ${amtColor};">
            ${amtSign}${formatVND(t.amount)}
          </td>
          <td>
            <span class="fintab-badge fintab-badge-success"><span class="dot"></span> Đã ghi sổ</span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn-fintab btn-fintab-outline" style="padding: 4px 8px; font-size: 11.5px;" onclick="openVoucherReceiptModal(${index})">
              📄 Xem Chứng Từ
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading transactions table:', err);
  }
}

function openVoucherReceiptModal(index) {
  const tx = currentTransactionsList[index];
  if (!tx) return;

  const isDeposit = tx.flow_type === 'IN';
  $text('voucherHeaderType', isDeposit ? 'PHIẾU THU TIỀN ĐIỆN TỬ (DEPOSIT)' : (tx.flow_type === 'HOLD' ? 'PHIẾU TẠM GIỮ TIỀN (ESCROW HOLD)' : 'PHIẾU CHI TIỀN ĐIỆN TỬ (PAYMENT)'));
  $text('vReceiptCode', tx.voucher_code || tx.reference_id || 'PT-20261102');
  $text('vReceiptDate', `Ngày hạch toán: ${tx.created_at}`);
  $text('vReceiptParty', `${tx.user_name || (currentUser ? currentUser.name : 'Sinh Viên')} (${tx.user_student_code || 'MSSV'})`);
  $text('vReceiptMethod', tx.payment_method || 'Ví TakeTwo Shield');
  $text('vReceiptDesc', tx.description);
  
  const amtEl = $id('vReceiptAmount');
  if (amtEl) {
    amtEl.textContent = `${isDeposit ? '+' : ''}${formatVND(tx.amount)}`;
    amtEl.style.color = isDeposit ? '#10B981' : '#EF4444';
  }
  
  $text('vReceiptBalAfter', formatVND(tx.balance_after));
  $text('vSignUser', tx.user_name || (currentUser ? currentUser.name : 'Sinh Viên'));

  openModal('modalVoucherReceipt');
}

// -------------------------------------------------------------
// 4. ORDERS & SHIPPING MANAGEMENT
// -------------------------------------------------------------
async function loadOrders() {
  try {
    const res = await fetch('/api/orders', {
      headers: { 'x-user-id': currentUser ? currentUser.id : 1 }
    });
    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

function renderOrders(orders) {
  const tbody = $id('ordersTableBody');
  $text('navOrderCount', `${orders ? orders.length : 0} SLA`);

  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">Chưa có đơn hàng nào</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let statusBadge = '';
    if (o.status === 'REQUESTED') statusBadge = '<span class="fintab-badge fintab-badge-warning"><span class="dot"></span> Chờ duyệt cọc</span>';
    else if (o.status === 'ACCEPTED') statusBadge = '<span class="fintab-badge fintab-badge-warning"><span class="dot"></span> Đã duyệt (Chờ gửi)</span>';
    else if (o.status === 'DELIVERING') statusBadge = '<span class="fintab-badge fintab-badge-blue"><span class="dot"></span> 🚚 Đang vận chuyển</span>';
    else if (o.status === 'COMPLETED' || o.status === 'COMPLETED_AUTO') statusBadge = '<span class="fintab-badge fintab-badge-success"><span class="dot"></span> ✅ Đã hoàn tất</span>';
    else if (o.status === 'DISPUTED') statusBadge = '<span class="fintab-badge fintab-badge-danger"><span class="dot"></span> ⚠️ Tranh chấp</span>';
    else statusBadge = '<span class="fintab-badge fintab-badge-neutral"><span class="dot"></span> Đã hủy</span>';

    let countdownHtml = '-';
    if (o.status === 'DELIVERING' && o.auto_confirm_deadline) {
      countdownHtml = `<div class="live-countdown" data-deadline="${o.auto_confirm_deadline}" style="font-weight:700; color:#D97706; font-size:12px;">Đang tính...</div>`;
    } else if (o.status === 'COMPLETED_AUTO') {
      countdownHtml = `<span style="color:#059669; font-weight:600; font-size:11px;">Tự động giải ngân (120h)</span>`;
    } else if (o.status === 'COMPLETED') {
      countdownHtml = `<span style="color:#059669; font-weight:600; font-size:11px;">Buyer xác nhận hài lòng</span>`;
    } else if (o.status === 'DISPUTED') {
      countdownHtml = `<span style="color:#DC2626; font-weight:700; font-size:11px;">ĐÃ ĐÓNG BĂNG ĐỒNG HỒ</span>`;
    }

    let actionButtons = '';
    if (o.status === 'REQUESTED') {
      actionButtons += `
        <button class="btn-fintab btn-fintab-primary" style="margin-right:4px; padding:4px 8px; font-size:11.5px;" onclick="sellerAcceptOrder(${o.id})">Duyệt</button>
        <button class="btn-fintab btn-fintab-success" style="padding:4px 8px; font-size:11.5px;" onclick="quickShipOrder(${o.id})" title="Gửi ship ngay để kích hoạt đồng hồ 5 ngày">Gửi Ship</button>
      `;
    } else if (o.status === 'ACCEPTED') {
      actionButtons += `<button class="btn-fintab btn-fintab-success" style="padding:4px 8px; font-size:11.5px;" onclick="sellerShipOrder(${o.id})">Gửi Bưu Cục</button>`;
    } else if (o.status === 'DELIVERING') {
      actionButtons += `
        <button class="btn-fintab btn-fintab-success" style="margin-right:4px; padding:4px 8px; font-size:11.5px;" onclick="buyerConfirmOrder(${o.id})" title="Người mua xác nhận đã nhận đồ & giải phóng tiền Escrow">✅ Đã Nhận</button>
        <button class="btn-fintab btn-fintab-amber" style="margin-right:4px; padding:4px 8px; font-size:11.5px;" onclick="simulate5Days(${o.id})" title="⚡ Giả lập trôi qua 5 ngày không khiếu nại -> Tự động giải ngân cho người bán">⚡ Qua 5 Ngày</button>
        <button class="btn-fintab btn-fintab-danger" style="padding:4px 8px; font-size:11.5px;" onclick="openDisputeModal(${o.id})" title="Khiếu nại đóng băng két Escrow">⚠️ Khiếu Nại</button>
      `;
    } else if (o.status === 'DISPUTED') {
      actionButtons += `<button class="btn-fintab btn-fintab-primary" style="padding:4px 8px; font-size:11.5px;" onclick="switchNav('disputes')">⚖️ Trọng Tài</button>`;
    } else if (o.status === 'COMPLETED' || o.status === 'COMPLETED_AUTO') {
      actionButtons += `<span class="fintab-badge fintab-badge-success" style="font-size:11px;">✓ Đã giải ngân</span>`;
    }

    let deliveryLabel = '🤝 Gặp tại trường (0đ)';
    if (o.delivery_type === 'COURIER_EXPRESS') {
      deliveryLabel = `⚡ Hỏa tốc (${o.tracking_code || 'Chờ mã'})`;
    } else if (o.delivery_type === 'COURIER_ROOM' || o.delivery_type === 'COURIER') {
      deliveryLabel = `🛵 Ship phòng KTX (${o.tracking_code || 'Chờ mã'})`;
    }

    return `
      <tr>
        <td><strong style="color:var(--primary); font-size:12.5px;">${o.order_code}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${o.product_image}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;">
            <span style="font-weight: 600; font-size: 12.5px;">${o.product_title}</span>
          </div>
        </td>
        <td>
          <div style="font-size: 12px;"><strong>Mua:</strong> ${o.buyer_name}</div>
          <div style="font-size: 12px; color: var(--text-muted);"><strong>Bán:</strong> ${o.seller_name}</div>
        </td>
        <td style="font-weight: 700; color: var(--primary);">${formatVND(o.total_paid)}</td>
        <td style="font-size: 12px;">
          ${deliveryLabel}
        </td>
        <td>${statusBadge}</td>
        <td>${countdownHtml}</td>
        <td style="text-align: right; white-space: nowrap;">${actionButtons || '<span style="color:#94A3B8; font-size:12px;">-</span>'}</td>
      </tr>
    `;
  }).join('');

  updateCountdowns();
}

// ⚡ Giả lập qua 5 ngày (Auto-confirm SLA simulation for presentation)
async function simulate5Days(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/simulate-5days`, {
      method: 'POST',
      headers: {
        'x-user-id': currentUser ? currentUser.id : 1
      }
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(data.message, 'success');
    await loadMe();
    await loadOrders();
    await loadProducts();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast('Lỗi khi giả lập qua 5 ngày', 'error');
  }
}

// Quick ship order helper
async function quickShipOrder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/ship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ tracking_code: 'TK-SHIP-' + Math.floor(10000 + Math.random() * 90000) })
    });
    const data = await res.json();
    showToast(data.message, 'success');
    await loadOrders();
    await loadOverview();
  } catch (err) {
    showToast('Lỗi khi gửi đơn bưu cục', 'error');
  }
}

function updateCountdowns() {
  const elements = document.querySelectorAll('.live-countdown');
  const now = new Date().getTime();

  elements.forEach(el => {
    const deadline = new Date(el.dataset.deadline).getTime();
    if (!deadline) return;
    const diff = deadline - now;

    if (diff <= 0) {
      el.innerHTML = `<span style="color: #059669; font-weight: 700;">Hết giờ -> Tự động chuyển tiền</span>`;
    } else {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      el.innerHTML = `⏳ Còn ${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
  });
}

// -------------------------------------------------------------
// ORDER ACTIONS (SELLER / BUYER)
// -------------------------------------------------------------
async function sellerAcceptOrder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/accept`, {
      method: 'POST',
      headers: { 'x-user-id': currentUser ? currentUser.id : 1 }
    });
    const data = await res.json();
    showToast(data.message, 'success');
    loadOrders();
    loadOverview();
  } catch (err) {
    showToast('Lỗi khi duyệt đơn', 'error');
  }
}

async function sellerShipOrder(orderId) {
  const trackingCode = prompt('Nhập mã vận đơn bưu cục (hoặc để mặc định):', 'TK-SHIP-' + Math.floor(10000 + Math.random() * 90000));
  try {
    const res = await fetch(`/api/orders/${orderId}/ship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ tracking_code: trackingCode })
    });
    const data = await res.json();
    showToast(data.message, 'success');
    loadOrders();
    loadOverview();
  } catch (err) {
    showToast('Lỗi khi gửi hàng', 'error');
  }
}

async function buyerConfirmOrder(orderId) {
  if (!confirm('Bạn xác nhận đã nhận được món đồ đúng mô tả và đồng ý giải phóng tiền Escrow cho Người bán?')) return;
  try {
    const res = await fetch(`/api/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { 'x-user-id': currentUser ? currentUser.id : 1 }
    });
    const data = await res.json();
    showToast(data.message, 'success');
    await loadMe();
    await loadOrders();
    await loadProducts();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast('Lỗi khi xác nhận đơn', 'error');
  }
}

function openDisputeModal(orderId) {
  $setVal('disputeOrderId', orderId);
  openModal('modalDispute');
}

async function submitDispute() {
  const orderId = $val('disputeOrderId', '');
  const reason = $val('disputeReasonInput', '');
  if (!reason.trim()) {
    showToast('Vui lòng nhập lý do khiếu nại', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/orders/${orderId}/dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    closeModal('modalDispute');
    showToast(data.message, 'success');
    loadOrders();
    loadOverview();
  } catch (err) {
    showToast('Lỗi khi gửi khiếu nại', 'error');
  }
}

// -------------------------------------------------------------
// CHECKOUT & ESCROW ORDER MODAL
// -------------------------------------------------------------
async function openCheckoutModal(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    checkoutProduct = await res.json();

    if (currentUser && currentUser.id === checkoutProduct.seller_id) {
      showToast('Bạn không thể tự mua món đồ do chính mình đăng!', 'error');
      return;
    }

    $src('checkoutProductImg', checkoutProduct.image_url);
    $text('checkoutProductTitle', checkoutProduct.title);
    $text('checkoutProductPrice', formatVND(checkoutProduct.price));
    $text('checkoutSellerInfo', `Người bán: ${checkoutProduct.seller_name} (★ ${checkoutProduct.seller_rating})`);
    $text('checkoutMeetupAddress', `Điểm hẹn: ${checkoutProduct.meetup_location} (${checkoutProduct.campus_cluster})`);
    $text('checkoutCurrentBalance', `Khả dụng: ${formatVND(currentWallet.available_balance)}`);

    if (currentUser) {
      $setVal('checkoutRecipientName', currentUser.name);
    }
    $setVal('checkoutRecipientPhone', '0987.654.321');

    updateCheckoutTotal();
    openModal('modalCheckout');
  } catch (err) {
    showToast('Lỗi khi tải thông tin sản phẩm', 'error');
  }
}

function updateCheckoutTotal() {
  if (!checkoutProduct) return;
  const deliveryTypeEl = document.querySelector('input[name="deliveryType"]:checked');
  const deliveryType = deliveryTypeEl ? deliveryTypeEl.value : 'CAMPUS_MEETUP';

  let shippingFee = 0;
  if (deliveryType === 'COURIER_ROOM') {
    shippingFee = 15000;
  } else if (deliveryType === 'COURIER_EXPRESS') {
    shippingFee = 25000;
  }

  const isCourier = shippingFee > 0;
  const addressGroup = $id('courierAddressGroup');
  if (addressGroup) addressGroup.style.display = isCourier ? 'block' : 'none';

  const itemAmount = checkoutProduct.price;
  const discount = 5000; // 5k student voucher
  const total = Math.max(0, (itemAmount + shippingFee) - discount);

  $text('billItemAmount', formatVND(itemAmount));
  $text('billShippingFee', formatVND(shippingFee));
  $text('billTotalAmount', formatVND(total));

  const btnConfirm = $id('btnConfirmCheckout');
  if (btnConfirm) {
    if (currentWallet.available_balance < total) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = `⚠️ Ví Không Đủ (${formatVND(currentWallet.available_balance)}) - Cần Nạp Thêm`;
      btnConfirm.style.background = '#94A3B8';
    } else {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = `🔒 Xác Nhận & Giữ Chỗ Tiền (${formatVND(total)})`;
      btnConfirm.style.background = 'var(--primary)';
    }
  }
}

async function submitCheckout() {
  if (!checkoutProduct) return;
  const deliveryTypeEl = document.querySelector('input[name="deliveryType"]:checked');
  const deliveryType = deliveryTypeEl ? deliveryTypeEl.value : 'CAMPUS_MEETUP';
  const deliveryAddress = $val('checkoutDeliveryAddress', '');
  const recipientName = $val('checkoutRecipientName', currentUser ? currentUser.name : '');
  const recipientPhone = $val('checkoutRecipientPhone', '0987654321');

  if (deliveryType !== 'CAMPUS_MEETUP' && !deliveryAddress.trim()) {
    showToast('Vui lòng nhập địa chỉ nhận hàng chi tiết (Tòa KTX / Phòng / Khu trọ)', 'error');
    return;
  }

  try {
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({
        product_id: checkoutProduct.id,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        recipient_name: recipientName,
        recipient_phone: recipientPhone
      })
    });

    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalCheckout');
    showToast(`Đặt mua thành công đơn ${data.order_code}! Tiền đã khóa trong Két Escrow bảo vệ 5 ngày.`, 'success');
    await loadMe();
    await loadProducts();
    await loadOrders();
    await loadTransactionsTable();
    await loadOverview();
    switchNav('orders');
  } catch (err) {
    showToast('Lỗi gửi đơn đặt hàng', 'error');
  }
}

// -------------------------------------------------------------
// TOPUP & WITHDRAW WALLET
// -------------------------------------------------------------
function openTopupModal() {
  openModal('modalTopup');
}

function setTopupAmount(amt) {
  $setVal('topupCustomAmount', amt);
  $src('qrMockupImg', `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=TAKETWO-TOPUP-${amt}`);
}

async function simulateTopupSuccess() {
  const amt = $val('topupCustomAmount', '100000');
  try {
    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({
        amount: amt,
        bank_name: 'MBBank'
      })
    });
    const data = await res.json();
    closeModal('modalTopup');
    showToast(`Nạp thành công +${formatVND(amt)}! Mã phiếu: ${data.voucher_code}`, 'success');
    await loadMe();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast('Lỗi nạp tiền', 'error');
  }
}

function openWithdrawModal() {
  openModal('modalWithdraw');
}

async function submitWithdraw() {
  const amount = $val('withdrawAmount', '');
  const bankName = $val('withdrawBankName', 'MBBank');
  const bankAccount = $val('withdrawAccountNum', '');

  if (!amount || !bankAccount) {
    showToast('Vui lòng nhập đầy đủ số tiền và số tài khoản', 'error');
    return;
  }

  try {
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ amount, bank_name: bankName, bank_account: bankAccount })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    closeModal('modalWithdraw');
    showToast(data.message, 'success');
    await loadMe();
    await loadTransactionsTable();
    await loadOverview();
  } catch (err) {
    showToast('Lỗi rút tiền', 'error');
  }
}

// -------------------------------------------------------------
// BUMP PACKAGES & 1-CLICK BOOST
// -------------------------------------------------------------
async function loadBumpPackages() {
  try {
    const res = await fetch('/api/bump-packages');
    bumpPackages = await res.json();
  } catch (err) {
    console.error('Error loading bump packages:', err);
  }
}

function renderPackagesTab() {
  const grid = $id('packagesGrid');
  if (!grid) return;

  grid.innerHTML = bumpPackages.map(pkg => {
    const isHot = pkg.has_badge_hot === 1;
    const avgPerBump = Math.round(pkg.price / pkg.bump_credits);

    return `
      <div style="background: white; border: ${isHot ? '2px solid var(--primary)' : '1px solid var(--border)'}; border-radius: var(--radius-lg); padding: 22px; position: relative; box-shadow: ${isHot ? 'var(--shadow-md)' : 'var(--shadow-xs)'}; display: flex; flex-direction: column;">
        ${isHot ? '<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; font-size: 11px; font-weight: 800; padding: 3px 12px; border-radius: 20px;">LỰA CHỌN PHỔ BIẾN NHẤT</div>' : ''}
        
        <div style="font-size: 11.5px; font-weight: 700; color: ${isHot ? 'var(--primary)' : 'var(--text-muted)'}; text-transform: uppercase;">${pkg.tag}</div>
        <h3 style="font-size: 17px; font-weight: 800; margin: 6px 0;">${pkg.name}</h3>
        <div style="font-size: 26px; font-weight: 800; color: var(--primary); margin-bottom: 3px;">${formatVND(pkg.price)}</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">~${formatVND(avgPerBump)} / lượt đẩy bài</div>

        <ul style="list-style: none; padding: 0; font-size: 12.5px; color: var(--text-main); line-height: 2; margin-bottom: 20px; flex: 1;">
          <li>✓ <strong>${pkg.bump_credits} lượt đẩy</strong> lên Top 1 tìm kiếm</li>
          <li>✓ Hiệu lực trong <strong>${pkg.validity_days} ngày</strong></li>
          ${pkg.has_badge_hot ? '<li>🔥 Tặng <strong>Huy hiệu CẦN PASS GẤP</strong></li>' : ''}
          ${pkg.id === 'bump_vip' ? '<li>👑 <strong>Ưu tiên hiển thị Top 1</strong> tuyệt đối</li>' : ''}
          <li>✓ Trừ trực tiếp 1-click qua số dư Ví</li>
        </ul>

        <button class="btn-fintab ${isHot ? 'btn-fintab-primary' : 'btn-fintab-outline'}" style="width: 100%; padding: 10px; font-weight:700;" onclick="buyBumpPackage('${pkg.id}')">
          ⚡ Mua Gói Này Bằng Ví (${formatVND(pkg.price)})
        </button>
      </div>
    `;
  }).join('');
}

// Mua gói đẩy bài trực tiếp bằng Ví TakeTwo
async function buyBumpPackage(packageId) {
  try {
    const res = await fetch('/api/bump-packages/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ package_id: packageId })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }
    showToast(`⚡ ${data.message}`, 'success');
    await loadMe();
    await loadTransactionsTable();
    await loadOverview();
    renderPackagesTab();
  } catch (err) {
    showToast('Lỗi khi mua gói đẩy bài', 'error');
  }
}

function promptSelectProductForBump(packageId) {
  switchNav('marketplace');
  showToast('Vui lòng bấm nút "🚀 Đẩy Top" trên món đồ để áp dụng!', 'info');
}

async function openBumpModal(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    bumpTargetProduct = await res.json();

    $text('bumpProductSummary', `Món đồ: ${bumpTargetProduct.title} (${formatVND(bumpTargetProduct.price)})`);

    const container = $id('bumpModalPackagesList');
    if (container) {
      container.innerHTML = bumpPackages.map(pkg => {
        const avg = Math.round(pkg.price / pkg.bump_credits);
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: ${pkg.has_badge_hot ? '#EFF6FF' : 'white'};">
            <div>
              <div style="font-weight: 700; font-size: 13.5px;">${pkg.name} ${pkg.has_badge_hot ? '🔥' : ''}</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">${pkg.description} (~${formatVND(avg)}/lượt)</div>
            </div>
            <button class="btn-fintab btn-fintab-amber" onclick="execute1ClickBump('${pkg.id}')">
              Đẩy Bằng Gói Này (${formatVND(pkg.price)})
            </button>
          </div>
        `;
      }).join('');
    }

    openModal('modalBump');
  } catch (err) {
    showToast('Lỗi khi tải thông tin', 'error');
  }
}

async function execute1ClickBump(packageId) {
  if (!bumpTargetProduct) return;
  try {
    const res = await fetch(`/api/products/${bumpTargetProduct.id}/bump`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ package_id: packageId })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalBump');
    showToast(data.message, 'success');
    await loadMe();
    await loadProducts();
    await loadTransactionsTable();
  } catch (err) {
    showToast('Lỗi khi đẩy tin', 'error');
  }
}

// -------------------------------------------------------------
// POST NEW LISTING
// -------------------------------------------------------------
function openCreateListingModal() {
  openModal('modalCreateListing');
}

async function submitCreateListing() {
  const title = $val('newPostTitle', '');
  const category_id = $val('newPostCategory', 'books');
  const condition_level = $val('newPostCondition', 'Tốt 90%');
  const price = $val('newPostPrice', '');
  const original_price = $val('newPostOriginalPrice', '');
  const campus_cluster = $val('newPostCampusCluster', 'Hòa Lạc');
  const meetup_location = $val('newPostMeetupLocation', '');
  const defect_note = $val('newPostDefectNote', '');
  const image_url = $val('newPostImageUrl', '');

  if (!title || !price || !meetup_location) {
    showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*)', 'error');
    return;
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({
        title, category_id, condition_level, price, original_price,
        campus_cluster, meetup_location, defect_note, image_url
      })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      return;
    }

    closeModal('modalCreateListing');
    showToast('Đăng tin thành công lên TakeTwo!', 'success');
    loadProducts();
    loadOverview();
  } catch (err) {
    showToast('Lỗi khi đăng tin', 'error');
  }
}

// -------------------------------------------------------------
// DISPUTES & ADMIN 5 KPIS
// -------------------------------------------------------------
async function loadDisputesView() {
  try {
    const resMetrics = await fetch('/api/admin/metrics');
    const data = await resMetrics.json();
    $text('metricNorthStar', data.north_star_verified_transactions);
    $text('metricGMV', formatVND(data.gmv_completed));
    $text('metricActiveListings', data.active_real_listings);
    $text('metricRepeatRate', (data.repeat_seller_rate || 100) + '%');

    const resOrders = await fetch('/api/orders');
    const orders = await resOrders.json();
    const disputes = orders.filter(o => o.status === 'DISPUTED');
    renderAdminDisputes(disputes);
  } catch (err) {
    console.error('Error loading disputes:', err);
  }
}

function renderAdminDisputes(disputes) {
  const tbody = $id('adminDisputesBody');
  if (!tbody) return;

  if (!disputes || disputes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#10B981; font-weight:600;">🎉 Hiện không có tranh chấp khiếu nại nào cần xử lý.</td></tr>`;
    return;
  }

  tbody.innerHTML = disputes.map(d => `
    <tr>
      <td style="font-weight:700; color:var(--primary);">${d.order_code}</td>
      <td><strong>${d.product_title}</strong></td>
      <td>${d.buyer_name} (${d.buyer_email})</td>
      <td style="color:#DC2626; font-size:12px;">${d.dispute_reason || 'Hàng lỗi / sai mô tả'}</td>
      <td style="font-weight:800; color:#D97706;">${formatVND(d.total_paid)}</td>
      <td style="text-align:right;">
        <button class="btn-fintab btn-fintab-success" style="margin-right:4px;" onclick="resolveDisputeAdmin(${d.id}, 'REFUND_BUYER')">
          ✓ Hoàn 100% Tiền Cho Buyer
        </button>
        <button class="btn-fintab btn-fintab-primary" onclick="resolveDisputeAdmin(${d.id}, 'RELEASE_SELLER')">
          ✓ Bác Bỏ & Chuyển Tiền Cho Seller
        </button>
      </td>
    </tr>
  `).join('');
}

async function resolveDisputeAdmin(orderId, decision) {
  if (!confirm(`Bạn chắc chắn muốn thực thi phán quyết "${decision}" cho đơn hàng này?`)) return;
  try {
    const res = await fetch(`/api/orders/${orderId}/admin-resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser ? currentUser.id : 1
      },
      body: JSON.stringify({ decision })
    });
    const data = await res.json();
    showToast(data.message, 'success');
    loadDisputesView();
    loadOrders();
    loadMe();
    loadTransactionsTable();
  } catch (err) {
    showToast('Lỗi xử lý phán quyết', 'error');
  }
}

// -------------------------------------------------------------
// UTILITIES & MODAL
// -------------------------------------------------------------
function formatVND(amount) {
  if (amount === undefined || amount === null) return '0 đ';
  return Number(amount).toLocaleString('vi-VN') + ' đ';
}

function openModal(id) {
  const el = $id(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = $id(id);
  if (el) el.classList.remove('open');
}

function showToast(message, type = 'info') {
  const container = $id('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `fintab-toast ${type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : '')}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// =============================================================
// GLOBAL WINDOW SCOPE EXPOSURE (FOR ALL HTML ONCLICK HANDLERS)
// =============================================================
window.switchNav = switchNav;
window.initApp = initApp;
window.onUserSwitch = onUserSwitch;
window.focusCampusFilter = focusCampusFilter;
window.executeGlobalSearch = executeGlobalSearch;
window.onOverviewFilterChange = onOverviewFilterChange;
window.onFilterChange = onFilterChange;
window.setCategoryPill = setCategoryPill;
window.quickBumpProduct = quickBumpProduct;
window.openBumpModal = openBumpModal;
window.execute1ClickBump = execute1ClickBump;
window.buyBumpPackage = buyBumpPackage;
window.promptSelectProductForBump = promptSelectProductForBump;
window.openCheckoutModal = openCheckoutModal;
window.updateCheckoutTotal = updateCheckoutTotal;
window.submitCheckout = submitCheckout;
window.openTopupModal = openTopupModal;
window.setTopupAmount = setTopupAmount;
window.simulateTopupSuccess = simulateTopupSuccess;
window.quickTopup = quickTopup;
window.openWithdrawModal = openWithdrawModal;
window.submitWithdraw = submitWithdraw;
window.sellerAcceptOrder = sellerAcceptOrder;
window.sellerShipOrder = sellerShipOrder;
window.quickShipOrder = quickShipOrder;
window.buyerConfirmOrder = buyerConfirmOrder;
window.simulate5Days = simulate5Days;
window.openDisputeModal = openDisputeModal;
window.submitDispute = submitDispute;
window.openCreateListingModal = openCreateListingModal;
window.submitCreateListing = submitCreateListing;
window.openVoucherReceiptModal = openVoucherReceiptModal;
window.resolveDisputeAdmin = resolveDisputeAdmin;
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.setTransactionTab = setTransactionTab;
window.loadTransactionsTable = loadTransactionsTable;
window.loadOrders = loadOrders;
window.loadProducts = loadProducts;
window.loadOverview = loadOverview;
