/* ===================================================
   RumahSewa Pro - app.js
   Full client-side app with localStorage persistence
   =================================================== */

// ========== DATA STORE ==========
const DB = {
  userKey: (key) => {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const username = user && user.username ? user.username : 'guest';
    return `${username}_${key}`;
  },
  get: (key) => JSON.parse(localStorage.getItem(DB.userKey(key)) || '[]'),
  set: (key, data) => localStorage.setItem(DB.userKey(key), JSON.stringify(data)),
  nextId: (key) => {
    const items = DB.get(key);
    return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
  }
};

const KEYS = { props: 'rs_properties', tenants: 'rs_tenants', income: 'rs_income', expenses: 'rs_expenses' };

// Seed sample data if empty
function seedData() {
  if (DB.get(KEYS.props).length > 0) return;
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user || user.username !== 'admin') return;

  const props = [
    { id: 1, name: 'Rumah Jl. Melati No.5', address: 'Jl. Melati No.5', city: 'Jakarta Selatan', type: 'Rumah', rent: 4500000, status: 'terisi', notes: '2KT, 1KM, Air PDAM, Listrik Token' },
    { id: 2, name: 'Kos Jl. Mawar No.12', address: 'Jl. Mawar No.12', city: 'Jakarta Timur', type: 'Kos', rent: 1800000, status: 'terisi', notes: '1KT, Wifi, AC' },
    { id: 3, name: 'Ruko Jl. Sudirman', address: 'Jl. Sudirman Blok A2', city: 'Jakarta Pusat', type: 'Ruko', rent: 8500000, status: 'kosong', notes: '2 lantai, area strategis' },
  ];
  DB.set(KEYS.props, props);

  const tenants = [
    { id: 1, name: 'Budi Santoso', phone: '081234567890', email: 'budi@email.com', ktp: '3201010101010001', propertyId: 1, start: '2024-01-01', end: '2025-01-01', rent: 4500000, deposit: 4500000, notes: '' },
    { id: 2, name: 'Siti Rahayu', phone: '082345678901', email: '', ktp: '', propertyId: 2, start: '2024-06-01', end: '2025-06-01', rent: 1800000, deposit: 1800000, notes: '' },
  ];
  DB.set(KEYS.tenants, tenants);

  const now = new Date();
  const incomes = [];
  const expenses = [];

  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 5);
    const dateStr = d.toISOString().split('T')[0];
    incomes.push({ id: m + 1, date: dateStr, propertyId: 1, tenantId: 1, amount: 4500000, category: 'Sewa Bulanan', method: 'Transfer Bank', note: `Sewa bulan ${d.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}` });
    incomes.push({ id: m + 7, date: dateStr, propertyId: 2, tenantId: 2, amount: 1800000, category: 'Sewa Bulanan', method: 'Transfer Bank', note: `Sewa bulan ${d.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}` });
    if (m % 2 === 0) {
      expenses.push({ id: m + 1, date: dateStr, propertyId: m === 0 ? 1 : 3, amount: m === 0 ? 350000 : 800000, category: m === 0 ? 'Listrik / Air' : 'Perbaikan & Renovasi', note: m === 0 ? 'Tagihan air PDAM' : 'Perbaikan atap bocor' });
    }
  }
  DB.set(KEYS.income, incomes);
  DB.set(KEYS.expenses, expenses);
}

// ========== UTILS ==========
const fmt = (n) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const fullMonth = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function getPropertyName(id) {
  const p = DB.get(KEYS.props).find(x => x.id == id);
  return p ? p.name : '—';
}
function getTenantName(id) {
  const t = DB.get(KEYS.tenants).find(x => x.id == id);
  return t ? t.name : '—';
}

// ========== TOAST ==========
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 2800);
}

// ========== NAVIGATION ==========
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === pageId) n.classList.add('active');
  });

  // Render page content
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'properties') renderProperties();
  if (pageId === 'tenants') renderTenants();
  if (pageId === 'income') { populateIncomeFilters(); renderIncome(); }
  if (pageId === 'expenses') { populateExpenseFilters(); renderExpenses(); }
  if (pageId === 'reports') renderReports();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ========== MODAL ==========
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ========== POPULATE SELECTS ==========
function populatePropertySelects() {
  const props = DB.get(KEYS.props);
  const selects = ['tenantProperty', 'incomeProperty', 'expenseProperty', 'filterIncomeProperty', 'filterExpenseProperty'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const firstOpt = el.options[0]?.value === '' ? el.options[0].text : null;
    el.innerHTML = '';
    if (firstOpt) el.innerHTML = `<option value="">${firstOpt}</option>`;
    props.forEach(p => {
      el.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
  });
}

// ========== DASHBOARD ==========
let incomeChartInstance = null;

function renderDashboard() {
  const now = new Date();
  document.getElementById('headerDate').innerHTML = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const incomes = DB.get(KEYS.income);
  const expenses = DB.get(KEYS.expenses);
  const props = DB.get(KEYS.props);

  // This month
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const monthIncome = incomes.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  });
  const monthExpense = expenses.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  });

  const totalIn = monthIncome.reduce((s, i) => s + i.amount, 0);
  const totalOut = monthExpense.reduce((s, i) => s + i.amount, 0);
  const profit = totalIn - totalOut;
  const occupied = props.filter(p => p.status === 'terisi').length;

  document.getElementById('stat-income').textContent = fmt(totalIn);
  document.getElementById('stat-income-sub').textContent = `${monthIncome.length} transaksi`;
  document.getElementById('stat-expense').textContent = fmt(totalOut);
  document.getElementById('stat-expense-sub').textContent = `${monthExpense.length} transaksi`;
  document.getElementById('stat-profit').textContent = (profit >= 0 ? '' : '-') + fmt(profit);
  document.getElementById('stat-profit').style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('stat-properties').textContent = props.length;
  document.getElementById('stat-occupied').textContent = `${occupied} terisi, ${props.length - occupied} kosong`;

  // Property status list
  const psl = document.getElementById('propertyStatusList');
  if (props.length === 0) {
    psl.innerHTML = '<div class="empty-state"><div class="empty-state-title">Belum ada properti</div></div>';
  } else {
    psl.innerHTML = props.map(p => `
      <div class="prop-status-item">
        <div>
          <div class="prop-status-name">${p.name}</div>
          <div class="prop-status-addr">${p.city || p.address}</div>
        </div>
        <span class="status-badge ${p.status}">${p.status}</span>
      </div>
    `).join('');
  }

  // Chart: 6 months
  const labels = [];
  const data = [];
  const dataExp = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(curYear, curMonth - i, 1);
    labels.push(monthNames[d.getMonth()]);
    const mIn = incomes.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);
    const mOut = expenses.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);
    data.push(mIn);
    dataExp.push(mOut);
  }

  if (incomeChartInstance) incomeChartInstance.destroy();
  const ctx = document.getElementById('incomeChart').getContext('2d');
  incomeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Pendapatan', data, backgroundColor: 'rgba(62,207,142,0.7)', borderRadius: 6, borderSkipped: false },
        { label: 'Pengeluaran', data: dataExp, backgroundColor: 'rgba(245,101,101,0.6)', borderRadius: 6, borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b90a4', font: { family: 'DM Sans', size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { color: '#252a38' }, ticks: { color: '#8b90a4' } },
        y: { grid: { color: '#252a38' }, ticks: { color: '#8b90a4', callback: v => 'Rp ' + (v/1e6).toFixed(1) + 'jt' } }
      }
    }
  });

  // Recent transactions (last 8)
  const allTx = [
    ...incomes.map(i => ({ ...i, txType: 'income' })),
    ...expenses.map(e => ({ ...e, txType: 'expense' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  const tbody = document.getElementById('recentTransactions');
  if (allTx.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Belum ada transaksi</div></td></tr>';
  } else {
    tbody.innerHTML = allTx.map(tx => `
      <tr>
        <td>${fmtDate(tx.date)}</td>
        <td>${getPropertyName(tx.propertyId)}</td>
        <td>${tx.tenantId ? getTenantName(tx.tenantId) : '—'}</td>
        <td>${tx.note || tx.category}</td>
        <td class="${tx.txType === 'income' ? 'amount-positive' : 'amount-negative'}">${tx.txType === 'income' ? '+' : '-'}${fmt(tx.amount)}</td>
        <td><span class="status-badge ${tx.txType === 'income' ? 'terisi' : 'kosong'}">${tx.txType === 'income' ? 'Masuk' : 'Keluar'}</span></td>
      </tr>
    `).join('');
  }
}

// ========== PROPERTIES ==========
function renderProperties() {
  populatePropertySelects();
  const props = DB.get(KEYS.props);
  const grid = document.getElementById('propertiesGrid');

  if (props.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🏠</div><div class="empty-state-title">Belum ada properti</div><div class="empty-state-sub">Klik "+ Tambah Properti" untuk mulai</div></div>`;
    return;
  }

  grid.innerHTML = props.map(p => `
    <div class="property-card">
      <div class="prop-card-header">
        <div>
          <div class="prop-card-name">${p.name}</div>
          <div class="prop-card-type">${p.type}</div>
        </div>
        <span class="status-badge ${p.status}">${p.status}</span>
      </div>
      <div class="prop-card-body">
        <div class="prop-card-info"><span>Alamat</span><span>${p.address}${p.city ? ', ' + p.city : ''}</span></div>
        <div class="prop-card-info"><span>Fasilitas</span><span>${p.notes || '—'}</span></div>
        <div class="prop-card-rent">${fmt(p.rent)}</div>
        <div class="prop-card-rent-label">per bulan</div>
      </div>
      <div class="prop-card-actions">
        <button class="btn btn-outline btn-sm" onclick="editProperty(${p.id})">✏ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProperty(${p.id})">🗑 Hapus</button>
      </div>
    </div>
  `).join('');
}

function openAddProperty() {
  document.getElementById('propertyId').value = '';
  document.getElementById('formProperty').reset();
  document.getElementById('modalPropertyTitle').textContent = 'Tambah Properti';
  openModal('modalProperty');
}

function editProperty(id) {
  const p = DB.get(KEYS.props).find(x => x.id === id);
  if (!p) return;
  document.getElementById('propertyId').value = p.id;
  document.getElementById('propertyName').value = p.name;
  document.getElementById('propertyAddress').value = p.address;
  document.getElementById('propertyCity').value = p.city || '';
  document.getElementById('propertyRent').value = p.rent;
  document.getElementById('propertyType').value = p.type;
  document.getElementById('propertyNotes').value = p.notes || '';
  document.getElementById('propertyStatus').value = p.status;
  document.getElementById('modalPropertyTitle').textContent = 'Edit Properti';
  openModal('modalProperty');
}

function saveProperty(e) {
  e.preventDefault();
  const id = document.getElementById('propertyId').value;
  const data = {
    name: document.getElementById('propertyName').value.trim(),
    address: document.getElementById('propertyAddress').value.trim(),
    city: document.getElementById('propertyCity').value.trim(),
    rent: parseFloat(document.getElementById('propertyRent').value),
    type: document.getElementById('propertyType').value,
    notes: document.getElementById('propertyNotes').value.trim(),
    status: document.getElementById('propertyStatus').value,
  };
  const props = DB.get(KEYS.props);
  if (id) {
    const idx = props.findIndex(x => x.id == id);
    props[idx] = { ...props[idx], ...data };
    showToast('Properti berhasil diperbarui');
  } else {
    data.id = DB.nextId(KEYS.props);
    props.push(data);
    showToast('Properti berhasil ditambahkan');
  }
  DB.set(KEYS.props, props);
  closeModal('modalProperty');
  renderProperties();
}

function deleteProperty(id) {
  if (!confirm('Hapus properti ini? Data terkait tidak akan ikut terhapus.')) return;
  const props = DB.get(KEYS.props).filter(x => x.id !== id);
  DB.set(KEYS.props, props);
  renderProperties();
  showToast('Properti dihapus', 'error');
}

// ========== TENANTS ==========
function renderTenants() {
  populatePropertySelects();
  const tenants = DB.get(KEYS.tenants);
  const tbody = document.getElementById('tenantsTable');

  if (tenants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">Belum ada penyewa</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = tenants.map(t => {
    const now = new Date();
    const end = t.end ? new Date(t.end) : null;
    const isActive = !end || end >= now;
    const daysLeft = end ? Math.ceil((end - now) / (1000*60*60*24)) : null;
    return `
      <tr>
        <td>${t.name}</td>
        <td>${getPropertyName(t.propertyId)}</td>
        <td>${t.phone}</td>
        <td>${fmtDate(t.start)}</td>
        <td>${fmtDate(t.end)}${daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 ? `<br><small style="color:var(--red)">⚠ ${daysLeft} hari lagi</small>` : ''}</td>
        <td>${fmt(t.rent)}</td>
        <td><span class="status-badge ${isActive ? 'terisi' : 'kosong'}">${isActive ? 'Aktif' : 'Habis'}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editTenant(${t.id})">✏</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTenant(${t.id})">🗑</button>
        </td>
      </tr>
    `;
  }).join('');
}

function editTenant(id) {
  const t = DB.get(KEYS.tenants).find(x => x.id === id);
  if (!t) return;
  populatePropertySelects();
  document.getElementById('tenantId').value = t.id;
  document.getElementById('tenantName').value = t.name;
  document.getElementById('tenantPhone').value = t.phone;
  document.getElementById('tenantEmail').value = t.email || '';
  document.getElementById('tenantKtp').value = t.ktp || '';
  document.getElementById('tenantProperty').value = t.propertyId;
  document.getElementById('tenantStart').value = t.start;
  document.getElementById('tenantEnd').value = t.end || '';
  document.getElementById('tenantRent').value = t.rent;
  document.getElementById('tenantDeposit').value = t.deposit || '';
  document.getElementById('tenantNotes').value = t.notes || '';
  document.getElementById('modalTenantTitle').textContent = 'Edit Penyewa';
  openModal('modalTenant');
}

function saveTenant(e) {
  e.preventDefault();
  const id = document.getElementById('tenantId').value;
  const propId = parseInt(document.getElementById('tenantProperty').value);
  const data = {
    name: document.getElementById('tenantName').value.trim(),
    phone: document.getElementById('tenantPhone').value.trim(),
    email: document.getElementById('tenantEmail').value.trim(),
    ktp: document.getElementById('tenantKtp').value.trim(),
    propertyId: propId,
    start: document.getElementById('tenantStart').value,
    end: document.getElementById('tenantEnd').value,
    rent: parseFloat(document.getElementById('tenantRent').value),
    deposit: parseFloat(document.getElementById('tenantDeposit').value) || 0,
    notes: document.getElementById('tenantNotes').value.trim(),
  };
  const tenants = DB.get(KEYS.tenants);
  if (id) {
    const idx = tenants.findIndex(x => x.id == id);
    tenants[idx] = { ...tenants[idx], ...data };
    showToast('Data penyewa diperbarui');
  } else {
    data.id = DB.nextId(KEYS.tenants);
    tenants.push(data);
    // Update property status
    const props = DB.get(KEYS.props);
    const pi = props.findIndex(x => x.id === propId);
    if (pi > -1) { props[pi].status = 'terisi'; DB.set(KEYS.props, props); }
    showToast('Penyewa berhasil ditambahkan');
  }
  DB.set(KEYS.tenants, tenants);
  closeModal('modalTenant');
  renderTenants();
}

function deleteTenant(id) {
  if (!confirm('Hapus data penyewa ini?')) return;
  const tenants = DB.get(KEYS.tenants).filter(x => x.id !== id);
  DB.set(KEYS.tenants, tenants);
  renderTenants();
  showToast('Penyewa dihapus', 'error');
}

// ========== INCOME ==========
function populateIncomeFilters() {
  populatePropertySelects();
  const sel = document.getElementById('filterIncomeMonth');
  sel.innerHTML = '<option value="">Semua Bulan</option>';
  fullMonth.forEach((m, i) => {
    sel.innerHTML += `<option value="${i}">${m}</option>`;
  });
  const selY = document.getElementById('filterIncomeYear');
  selY.innerHTML = '<option value="">Semua Tahun</option>';
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    selY.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

function onIncomePropertyChange() {
  const propId = document.getElementById('incomeProperty').value;
  const tenants = DB.get(KEYS.tenants).filter(t => t.propertyId == propId);
  const sel = document.getElementById('incomeTenant');
  sel.innerHTML = '<option value="">— Pilih Penyewa —</option>';
  tenants.forEach(t => {
    sel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
}

function renderIncome() {
  let incomes = DB.get(KEYS.income);
  const fProp = document.getElementById('filterIncomeProperty')?.value;
  const fMonth = document.getElementById('filterIncomeMonth')?.value;
  const fYear = document.getElementById('filterIncomeYear')?.value;

  if (fProp) incomes = incomes.filter(i => i.propertyId == fProp);
  if (fMonth !== '' && fMonth !== undefined) incomes = incomes.filter(i => new Date(i.date).getMonth() == fMonth);
  if (fYear) incomes = incomes.filter(i => new Date(i.date).getFullYear() == fYear);

  incomes.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('incomeTable');
  if (incomes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-title">Tidak ada data pendapatan</div></div></td></tr>`;
  } else {
    tbody.innerHTML = incomes.map(i => `
      <tr>
        <td>${fmtDate(i.date)}</td>
        <td>${getPropertyName(i.propertyId)}</td>
        <td>${i.tenantId ? getTenantName(i.tenantId) : '—'}</td>
        <td>${i.note || '—'}</td>
        <td class="amount-positive">${fmt(i.amount)}</td>
        <td>${i.method}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editIncome(${i.id})">✏</button>
          <button class="btn btn-danger btn-sm" onclick="deleteIncome(${i.id})">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  const total = incomes.reduce((s, i) => s + i.amount, 0);
  document.getElementById('incomeTotalDisplay').textContent = fmt(total);
}

function editIncome(id) {
  const inc = DB.get(KEYS.income).find(x => x.id === id);
  if (!inc) return;
  populatePropertySelects();
  document.getElementById('incomeId').value = inc.id;
  document.getElementById('incomeDate').value = inc.date;
  document.getElementById('incomeProperty').value = inc.propertyId;
  onIncomePropertyChange();
  setTimeout(() => {
    document.getElementById('incomeTenant').value = inc.tenantId || '';
    document.getElementById('incomeCategory').value = inc.category;
    document.getElementById('incomeMethod').value = inc.method;
    document.getElementById('incomeNote').value = inc.note || '';
    document.getElementById('incomeAmount').value = inc.amount;
  }, 50);
  document.getElementById('modalIncomeTitle').textContent = 'Edit Pendapatan';
  openModal('modalIncome');
}

function saveIncome(e) {
  e.preventDefault();
  const id = document.getElementById('incomeId').value;
  const data = {
    date: document.getElementById('incomeDate').value,
    propertyId: parseInt(document.getElementById('incomeProperty').value),
    tenantId: parseInt(document.getElementById('incomeTenant').value) || null,
    amount: parseFloat(document.getElementById('incomeAmount').value),
    category: document.getElementById('incomeCategory').value,
    method: document.getElementById('incomeMethod').value,
    note: document.getElementById('incomeNote').value.trim(),
  };
  const incomes = DB.get(KEYS.income);
  if (id) {
    const idx = incomes.findIndex(x => x.id == id);
    incomes[idx] = { ...incomes[idx], ...data };
    showToast('Pendapatan diperbarui');
  } else {
    data.id = DB.nextId(KEYS.income);
    incomes.push(data);
    showToast('Pendapatan berhasil dicatat ✓');
  }
  DB.set(KEYS.income, incomes);
  closeModal('modalIncome');
  renderIncome();
}

function deleteIncome(id) {
  if (!confirm('Hapus data pendapatan ini?')) return;
  DB.set(KEYS.income, DB.get(KEYS.income).filter(x => x.id !== id));
  renderIncome();
  showToast('Data dihapus', 'error');
}

// ========== EXPENSES ==========
function populateExpenseFilters() {
  populatePropertySelects();
  const sel = document.getElementById('filterExpenseMonth');
  sel.innerHTML = '<option value="">Semua Bulan</option>';
  fullMonth.forEach((m, i) => {
    sel.innerHTML += `<option value="${i}">${m}</option>`;
  });
}

function renderExpenses() {
  let exps = DB.get(KEYS.expenses);
  const fProp = document.getElementById('filterExpenseProperty')?.value;
  const fMonth = document.getElementById('filterExpenseMonth')?.value;

  if (fProp) exps = exps.filter(i => i.propertyId == fProp);
  if (fMonth !== '' && fMonth !== undefined) exps = exps.filter(i => new Date(i.date).getMonth() == fMonth);

  exps.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('expensesTable');
  if (exps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-title">Tidak ada data pengeluaran</div></div></td></tr>`;
  } else {
    tbody.innerHTML = exps.map(i => `
      <tr>
        <td>${fmtDate(i.date)}</td>
        <td>${getPropertyName(i.propertyId)}</td>
        <td>${i.category}</td>
        <td>${i.note}</td>
        <td class="amount-negative">-${fmt(i.amount)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editExpense(${i.id})">✏</button>
          <button class="btn btn-danger btn-sm" onclick="deleteExpense(${i.id})">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  const total = exps.reduce((s, i) => s + i.amount, 0);
  document.getElementById('expenseTotalDisplay').textContent = fmt(total);
}

function editExpense(id) {
  const exp = DB.get(KEYS.expenses).find(x => x.id === id);
  if (!exp) return;
  populatePropertySelects();
  document.getElementById('expenseId').value = exp.id;
  document.getElementById('expenseDate').value = exp.date;
  document.getElementById('expenseProperty').value = exp.propertyId;
  document.getElementById('expenseCategory').value = exp.category;
  document.getElementById('expenseAmount').value = exp.amount;
  document.getElementById('expenseNote').value = exp.note;
  document.getElementById('modalExpenseTitle').textContent = 'Edit Pengeluaran';
  openModal('modalExpense');
}

function saveExpense(e) {
  e.preventDefault();
  const id = document.getElementById('expenseId').value;
  const data = {
    date: document.getElementById('expenseDate').value,
    propertyId: parseInt(document.getElementById('expenseProperty').value),
    category: document.getElementById('expenseCategory').value,
    amount: parseFloat(document.getElementById('expenseAmount').value),
    note: document.getElementById('expenseNote').value.trim(),
  };
  const exps = DB.get(KEYS.expenses);
  if (id) {
    const idx = exps.findIndex(x => x.id == id);
    exps[idx] = { ...exps[idx], ...data };
    showToast('Pengeluaran diperbarui');
  } else {
    data.id = DB.nextId(KEYS.expenses);
    exps.push(data);
    showToast('Pengeluaran berhasil dicatat');
  }
  DB.set(KEYS.expenses, exps);
  closeModal('modalExpense');
  renderExpenses();
}

function deleteExpense(id) {
  if (!confirm('Hapus data pengeluaran ini?')) return;
  DB.set(KEYS.expenses, DB.get(KEYS.expenses).filter(x => x.id !== id));
  renderExpenses();
  showToast('Data dihapus', 'error');
}

// ========== REPORTS ==========
let reportChartInstance = null;

function renderReports() {
  const now = new Date();
  const selY = document.getElementById('reportYear');
  if (selY.options.length <= 1) {
    selY.innerHTML = '';
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
      selY.innerHTML += `<option value="${y}">${y}</option>`;
    }
  }

  const year = parseInt(document.getElementById('reportYear').value) || now.getFullYear();
  const incomes = DB.get(KEYS.income).filter(i => new Date(i.date).getFullYear() === year);
  const expenses = DB.get(KEYS.expenses).filter(i => new Date(i.date).getFullYear() === year);
  const props = DB.get(KEYS.props);

  const totalIn = incomes.reduce((s, i) => s + i.amount, 0);
  const totalOut = expenses.reduce((s, i) => s + i.amount, 0);
  const occupied = props.filter(p => p.status === 'terisi').length;

  document.getElementById('rep-income').textContent = fmt(totalIn);
  document.getElementById('rep-expense').textContent = fmt(totalOut);
  document.getElementById('rep-profit').textContent = fmt(totalIn - totalOut);
  document.getElementById('rep-profit').style.color = totalIn >= totalOut ? 'var(--green)' : 'var(--red)';
  document.getElementById('rep-occupancy').textContent = props.length ? Math.round(occupied / props.length * 100) + '%' : '0%';

  // Monthly chart
  const labels = fullMonth.map(m => m.substring(0, 3));
  const dataIn = Array(12).fill(0);
  const dataOut = Array(12).fill(0);
  incomes.forEach(i => { dataIn[new Date(i.date).getMonth()] += i.amount; });
  expenses.forEach(i => { dataOut[new Date(i.date).getMonth()] += i.amount; });

  if (reportChartInstance) reportChartInstance.destroy();
  const ctx = document.getElementById('reportChart').getContext('2d');
  reportChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Pendapatan', data: dataIn, borderColor: 'var(--green)', backgroundColor: 'rgba(62,207,142,0.1)', tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'Pengeluaran', data: dataOut, borderColor: 'var(--red)', backgroundColor: 'rgba(245,101,101,0.08)', tension: 0.4, fill: true, pointRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b90a4', font: { family: 'DM Sans', size: 12 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: { grid: { color: '#252a38' }, ticks: { color: '#8b90a4' } },
        y: { grid: { color: '#252a38' }, ticks: { color: '#8b90a4', callback: v => 'Rp ' + (v/1e6).toFixed(1) + 'jt' } }
      }
    }
  });

  // Per property summary
  const table = document.getElementById('reportPropertyTable');
  if (props.length === 0) {
    table.innerHTML = '<div class="empty-state"><div class="empty-state-title">Belum ada properti</div></div>';
    return;
  }
  table.innerHTML = '<div class="report-prop-table">' + props.map(p => {
    const pIn = incomes.filter(i => i.propertyId === p.id).reduce((s, i) => s + i.amount, 0);
    const pOut = expenses.filter(i => i.propertyId === p.id).reduce((s, i) => s + i.amount, 0);
    return `
      <div class="report-prop-row">
        <div>
          <div class="report-prop-name">${p.name}</div>
          <small style="color:var(--text3)">${p.type}</small>
        </div>
        <div class="report-prop-vals">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px">MASUK</div><div class="report-prop-in">${fmt(pIn)}</div></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px">KELUAR</div><div class="report-prop-out">${fmt(pOut)}</div></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:2px">BERSIH</div><div style="font-weight:600;color:${pIn-pOut>=0?'var(--green)':'var(--red)'}">${fmt(pIn-pOut)}</div></div>
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

// ========== EXPORT ==========
function exportReport() {
  const year = parseInt(document.getElementById('reportYear').value) || new Date().getFullYear();
  const incomes = DB.get(KEYS.income).filter(i => new Date(i.date).getFullYear() === year);
  const expenses = DB.get(KEYS.expenses).filter(i => new Date(i.date).getFullYear() === year);

  let csv = 'Tanggal,Properti,Penyewa,Keterangan,Tipe,Jumlah\n';
  const all = [
    ...incomes.map(i => ({ date: i.date, prop: getPropertyName(i.propertyId), tenant: i.tenantId ? getTenantName(i.tenantId) : '', note: i.note || i.category, type: 'Pendapatan', amount: i.amount })),
    ...expenses.map(e => ({ date: e.date, prop: getPropertyName(e.propertyId), tenant: '', note: e.note, type: 'Pengeluaran', amount: -e.amount }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  all.forEach(r => {
    csv += `"${r.date}","${r.prop}","${r.tenant}","${r.note}","${r.type}","${r.amount}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_${year}.csv`;
  a.click();
  showToast('Laporan CSV berhasil diunduh ✓');
}

// ========== INIT ==========
function initApp() {
  const today = new Date().toISOString().split('T')[0];

  if (!window.appInitialized) {
    window.appInitialized = true;

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(item.dataset.page);
      });
    });

    // Card links
    document.querySelectorAll('.card-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(link.dataset.page);
      });
    });

    // Mobile toggle
    document.getElementById('mobileToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Modal "Tambah" buttons set reset state
    document.getElementById('modalProperty').addEventListener('click', () => {});
    document.querySelectorAll('[onclick*="openModal(\'modalProperty\')"]').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById('propertyId').value = '';
        document.getElementById('formProperty').reset();
        document.getElementById('modalPropertyTitle').textContent = 'Tambah Properti';
      });
    });
    document.querySelectorAll('[onclick*="openModal(\'modalTenant\')"]').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById('tenantId').value = '';
        document.getElementById('formTenant').reset();
        document.getElementById('modalTenantTitle').textContent = 'Tambah Penyewa';
        populatePropertySelects();
      });
    });
    document.querySelectorAll('[onclick*="openModal(\'modalIncome\')"]').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById('incomeId').value = '';
        document.getElementById('formIncome').reset();
        document.getElementById('incomeDate').value = today;
        document.getElementById('modalIncomeTitle').textContent = 'Catat Pendapatan';
        populatePropertySelects();
      });
    });
    document.querySelectorAll('[onclick*="openModal(\'modalExpense\')"]').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById('expenseId').value = '';
        document.getElementById('formExpense').reset();
        document.getElementById('expenseDate').value = today;
        document.getElementById('modalExpenseTitle').textContent = 'Catat Pengeluaran';
        populatePropertySelects();
      });
    });

    // Report year
    document.getElementById('reportYear').addEventListener('change', renderReports);
  }

  seedData();
  populatePropertySelects();

  // Set today's date on date inputs
  ['incomeDate', 'expenseDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  // Initial render
  navigateTo('dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
  initLogin && initLogin();

  if (isLoggedIn && isLoggedIn()) {
    document.body.classList.remove('login-screen');
    initApp();
  } else {
    openLoginScreen && openLoginScreen();
  }
});