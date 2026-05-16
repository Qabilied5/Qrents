/* ===================================================
   RumahSewa Pro - app-api.js
   API-based app dengan MongoDB backend
   =================================================== */

// ========== UTILS ==========
const fmt = (n) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const fullMonth = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

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
  if (pageId === 'internal-incomes') {
    populateInternalFilters('intInc');
    populateIntCategoryFilter('filterIntIncCategory', STORAGE_KEY_INC, DEFAULT_INC_CATS);
    renderInternalIncomes();
  }
  if (pageId === 'internal-expenses') {
    populateInternalFilters('intExp');
    populateIntCategoryFilter('filterIntExpCategory', STORAGE_KEY_EXP, DEFAULT_EXP_CATS);
    renderInternalExpenses();
  }
  if (pageId === 'reports') renderReports();
  if (pageId === 'cicilan') { populateCicilanFilters(); renderCicilan(); }
  if (pageId === 'reminders') renderReminders();

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

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ========== API HELPERS ==========
const API = {
  async get(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    return res.json();
  },
  async post(endpoint, data) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Error: ${res.status}`);
    }
    return res.json();
  },
  async put(endpoint, data) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Error: ${res.status}`);
    }
    return res.json();
  },
  async delete(endpoint) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Error: ${res.status}`);
    }
    return res.json();
  }
};

// ========== POPULATE SELECTS ==========
async function populatePropertySelects() {
  try {
    const props = await API.get('/properties');
    const selects = ['tenantProperty', 'incomeProperty', 'expenseProperty', 'filterIncomeProperty', 'filterExpenseProperty'];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const defaultOptionText = el.options[0]?.value === '' ? el.options[0].text : (id === 'tenantProperty' ? 'Pilih properti' : 'Semua Properti');
      el.innerHTML = `<option value="">${defaultOptionText}</option>`;
      if (props.length === 0) {
        if (id === 'tenantProperty') {
          el.innerHTML = '<option value="">Tambah properti terlebih dahulu</option>';
        }
        return;
      }
      props.forEach(p => {
        el.innerHTML += `<option value="${p._id}">${p.name}</option>`;
      });
    });
    if (props.length === 0) {
      console.warn('Tidak ada properti yang ditemukan. Tambahkan properti terlebih dahulu.');
    }
  } catch (error) {
    console.error('Error populating selects:', error);
  }
}

// ========== POPULATE TENANT SELECT ==========
async function populateTenantSelects(propertyId) {
  try {
    const el = document.getElementById('incomeTenant');
    if (!el) return;
    el.innerHTML = '<option value="">Pilih penyewa (opsional)</option>';
    if (!propertyId) return;

    const tenants = await API.get(`/tenants/property/${propertyId}`);
    tenants.forEach(t => {
      el.innerHTML += `<option value="${t._id}">${t.name}</option>`;
    });
  } catch (error) {
    console.error('Error populating tenant selects:', error);
  }
}

// ========== DASHBOARD ==========
let incomeChartInstance = null;

async function renderDashboard() {
  try {
    const now = new Date();
    document.getElementById('headerDate').innerHTML = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const [incomes, expenses, intIncomes, intExpenses, props] = await Promise.all([
      API.get('/income'),
      API.get('/expenses'),
      API.get('/internal-incomes'),
      API.get('/internal-expenses'),
      API.get('/properties'),
    ]);

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
    const monthIntIncome = intIncomes.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });
    const monthIntExpense = intExpenses.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });

    const totalIn  = monthIncome.reduce((s, i) => s + i.amount, 0)
                   + monthIntIncome.reduce((s, i) => s + i.amount, 0);
    const totalOut = monthExpense.reduce((s, i) => s + i.amount, 0)
                   + monthIntExpense.reduce((s, i) => s + i.amount, 0);
    const profit = totalIn - totalOut;

    // Hitung jumlah transaksi gabungan untuk subtitle
    const totalInCount  = monthIncome.length + monthIntIncome.length;
    const totalOutCount = monthExpense.length + monthIntExpense.length;
    const occupied = props.filter(p => p.status === 'terisi').length;

    document.getElementById('stat-income').textContent = fmt(totalIn);
    document.getElementById('stat-income-sub').textContent = `${totalInCount} transaksi`;
    document.getElementById('stat-expense').textContent = fmt(totalOut);
    document.getElementById('stat-expense-sub').textContent = `${totalOutCount} transaksi`;
    document.getElementById('stat-profit').textContent = (profit >= 0 ? '' : '-') + fmt(profit);
    document.getElementById('stat-profit').style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
    document.getElementById('stat-properties').textContent = props.length;
    document.getElementById('stat-occupied').textContent = `${occupied} terisi, ${props.length - occupied} kosong`;

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

    const labels = [];
    const data = [];
    const dataExp = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      labels.push(monthNames[d.getMonth()]);
      const mIn = incomes.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      }).reduce((s, t) => s + t.amount, 0)
      + intIncomes.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      }).reduce((s, t) => s + t.amount, 0);
      const mOut = expenses.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
      }).reduce((s, t) => s + t.amount, 0)
      + intExpenses.filter(t => {
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
          tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.raw)}` } }
        },
        scales: {
          x: { grid: { color: '#252a38' }, ticks: { color: '#8b90a4' } },
          y: { grid: { color: '#252a38' }, ticks: { color: '#8b90a4', callback: v => 'Rp ' + (v/1e6).toFixed(1) + 'jt' } }
        }
      }
    });

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
          <td>${tx.propertyId?.name || '—'}</td>
          <td>${tx.tenantId?.name || '—'}</td>
          <td>${tx.note || tx.category}</td>
          <td class="${tx.txType === 'income' ? 'amount-positive' : 'amount-negative'}">${tx.txType === 'income' ? '+' : '-'}${fmt(tx.amount)}</td>
          <td><span class="status-badge ${tx.txType === 'income' ? 'terisi' : 'kosong'}">${tx.txType === 'income' ? 'Masuk' : 'Keluar'}</span></td>
        </tr>
      `).join('');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== PROPERTIES ==========
async function renderProperties() {
  try {
    await populatePropertySelects();
    const props = await API.get('/properties');
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
          <button class="btn btn-outline btn-sm" onclick="editProperty('${p._id}')">✏ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProperty('${p._id}')">🗑 Hapus</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function openAddProperty() {
  document.getElementById('propertyId').value = '';
  document.getElementById('formProperty').reset();
  document.getElementById('modalPropertyTitle').textContent = 'Tambah Properti';
  openModal('modalProperty');
}

async function editProperty(id) {
  try {
    const p = await API.get(`/properties/${id}`);
    document.getElementById('propertyId').value = p._id;
    document.getElementById('propertyName').value = p.name;
    document.getElementById('propertyAddress').value = p.address;
    document.getElementById('propertyCity').value = p.city || '';
    document.getElementById('propertyRent').value = p.rent;
    document.getElementById('propertyType').value = p.type;
    document.getElementById('propertyNotes').value = p.notes || '';
    document.getElementById('propertyStatus').value = p.status;
    document.getElementById('modalPropertyTitle').textContent = 'Edit Properti';
    openModal('modalProperty');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveProperty(e) {
  e.preventDefault();
  try {
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

    if (id) {
      await API.put(`/properties/${id}`, data);
      showToast('Properti berhasil diperbarui');
    } else {
      await API.post('/properties', data);
      showToast('Properti berhasil ditambahkan');
    }

    closeModal('modalProperty');
    await populatePropertySelects();
    renderProperties();
    renderDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteProperty(id) {
  if (!confirm('Hapus properti ini?')) return;
  try {
    await API.delete(`/properties/${id}`);
    renderProperties();
    renderDashboard();
    showToast('Properti dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== TENANTS ==========
async function renderTenants() {
  try {
    await populatePropertySelects();
    const tenants = await API.get('/tenants');
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

      // Auto-renew: jika tanggal akhir = hari ini (daysLeft <= 0), perpanjang +30 hari
      if (end && daysLeft !== null && daysLeft <= 0) {
        const newEnd = new Date(end);
        newEnd.setDate(newEnd.getDate() + 30);
        const newEndStr = newEnd.toISOString().split('T')[0];
        API.put(`/tenants/${t._id}`, { ...t, propertyId: t.propertyId?._id || t.propertyId, end: newEndStr })
          .then(() => renderTenants())
          .catch(() => {}); // silent — tidak ganggu tampilan
      }
      return `
        <tr class="tenant-row" onclick="showTenantPayments('${t._id}', '${(t.name||'').replace(/'/g,'\\\'')}')" style="cursor:pointer;" title="Klik untuk lihat riwayat pembayaran">
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <span>${t.name}</span>
              <span class="tenant-row-hint">📋</span>
            </div>
          </td>
          <td>${t.propertyId?.name || '—'}</td>
          <td>${t.phone}</td>
          <td>${fmtDate(t.start)}</td>
          <td>${fmtDate(t.end)}${daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 ? `<br><small style="color:var(--red)">⚠ ${daysLeft} hari tersisa</small>` : ''}</td>
          <td>${fmt(t.rent)}</td>
          <td><span class="status-badge ${isActive ? 'terisi' : 'kosong'}">${isActive ? 'Aktif' : 'Habis'}</span></td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-sm" onclick="editTenant('${t._id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTenant('${t._id}')">🗑</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function showTenantPayments(tenantId, tenantName) {
  try {
    document.getElementById('modalPaymentsTitle').textContent = `Riwayat Pembayaran — ${tenantName}`;
    const content = document.getElementById('tenantPaymentsContent');
    content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat data...</div></div>';
    openModal('modalTenantPayments');

    const allIncome = await API.get('/income');
    const payments = allIncome.filter(i => i.tenantId && i.tenantId._id === tenantId);

    if (payments.length === 0) {
      content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Belum ada riwayat pembayaran</div><div class="empty-state-sub">Tidak ditemukan transaksi untuk penyewa ini</div></div>';
      return;
    }

    // Group by year then month
    const grouped = {};
    payments.forEach(p => {
      const d = new Date(p.date);
      const year = d.getFullYear();
      const month = d.getMonth();
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(p);
    });

    const years = Object.keys(grouped).sort((a, b) => b - a);
    let html = '';

    years.forEach(year => {
      const yearTotal = Object.values(grouped[year]).flat().reduce((s, p) => s + p.amount, 0);
      html += `
        <div class="payment-year-section">
          <div class="payment-year-header">
            <span class="payment-year-label">${year}</span>
            <span class="payment-year-total">${fmt(yearTotal)}</span>
          </div>
      `;

      const months = Object.keys(grouped[year]).sort((a, b) => b - a);
      months.forEach(month => {
        const monthPayments = grouped[year][month].sort((a, b) => new Date(b.date) - new Date(a.date));
        const monthTotal = monthPayments.reduce((s, p) => s + p.amount, 0);
        html += `
          <div class="payment-month-section">
            <div class="payment-month-header">
              <span class="payment-month-label">${fullMonth[parseInt(month)]}</span>
              <span class="payment-month-total">${fmt(monthTotal)}</span>
            </div>
            ${monthPayments.map(p => `
              <div class="payment-item">
                <div class="payment-item-left">
                  <div class="payment-item-date">${fmtDate(p.date)}</div>
                  <div class="payment-item-desc">${p.note || p.category || 'Pembayaran'}</div>
                  <div class="payment-item-meta">${p.method || ''} ${p.propertyId?.name ? '· ' + p.propertyId.name : ''}</div>
                </div>
                <div class="payment-item-amount">${fmt(p.amount)}</div>
              </div>
            `).join('')}
          </div>
        `;
      });

      html += `</div>`;
    });

    const grandTotal = payments.reduce((s, p) => s + p.amount, 0);
    html += `
      <div class="payment-grand-total">
        <span>Total Keseluruhan</span>
        <span>${fmt(grandTotal)}</span>
      </div>
    `;

    content.innerHTML = html;
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function editTenant(id) {
  try {
    const t = await API.get(`/tenants/${id}`);
    await populatePropertySelects();
    document.getElementById('tenantId').value = t._id;
    document.getElementById('tenantName').value = t.name;
    document.getElementById('tenantPhone').value = t.phone;
    document.getElementById('tenantEmail').value = t.email || '';
    document.getElementById('tenantKtp').value = t.ktp || '';
    document.getElementById('tenantProperty').value = t.propertyId._id;
    document.getElementById('tenantStart').value = t.start.split('T')[0];
    document.getElementById('tenantEnd').value = t.end ? t.end.split('T')[0] : '';
    // Jika belum ada tanggal akhir, set otomatis +30 hari dari tanggal mulai
    if (!t.end && typeof autoSetTenantEnd === 'function') autoSetTenantEnd();
    document.getElementById('tenantRent').value = t.rent;
    document.getElementById('tenantDeposit').value = t.deposit || '';
    document.getElementById('tenantNotes').value = t.notes || '';
    document.getElementById('modalTenantTitle').textContent = 'Edit Penyewa';
    openModal('modalTenant');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveTenant(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('tenantId').value;
    const propId = document.getElementById('tenantProperty').value;
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

    if (id) {
      await API.put(`/tenants/${id}`, data);
      showToast('Data penyewa diperbarui');
    } else {
      await API.post('/tenants', data);
      showToast('Penyewa berhasil ditambahkan');
    }

    closeModal('modalTenant');
    await populatePropertySelects();
    renderTenants();
    renderProperties();
    renderDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteTenant(id) {
  if (!confirm('Hapus data penyewa ini?')) return;
  try {
    await API.delete(`/tenants/${id}`);
    renderTenants();
    renderProperties();
    renderDashboard();
    showToast('Penyewa dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== INCOME ==========
async function populateIncomeFilters() {
  await populatePropertySelects();
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
  const propertyId = document.getElementById('incomeProperty').value;
  populateTenantSelects(propertyId);
}

async function renderIncome() {
  try {
    let incomes = await API.get('/income');
    const fProp = document.getElementById('filterIncomeProperty')?.value;
    const fMonth = document.getElementById('filterIncomeMonth')?.value;
    const fYear = document.getElementById('filterIncomeYear')?.value;

    if (fProp) incomes = incomes.filter(i => i.propertyId._id == fProp);
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
          <td>${i.propertyId?.name || '—'}</td>
          <td>${i.tenantId?.name || '—'}</td>
          <td>${i.note || '—'}</td>
          <td class="amount-positive">${fmt(i.amount)}</td>
          <td>${i.method}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="editIncome('${i._id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="deleteIncome('${i._id}')">🗑</button>
          </td>
        </tr>
      `).join('');
    }

    const total = incomes.reduce((s, i) => s + i.amount, 0);
    document.getElementById('incomeTotalDisplay').textContent = fmt(total);
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function editIncome(id) {
  try {
    const inc = await API.get(`/income/${id}`);
    await populatePropertySelects();
    await populateTenantSelects(inc.propertyId._id);
    document.getElementById('incomeId').value = inc._id;
    document.getElementById('incomeDate').value = inc.date.split('T')[0];
    document.getElementById('incomeProperty').value = inc.propertyId._id;
    setTimeout(() => {
      document.getElementById('incomeTenant').value = inc.tenantId?._id || '';
      document.getElementById('incomeCategory').value = inc.category;
      document.getElementById('incomeMethod').value = inc.method;
      document.getElementById('incomeNote').value = inc.note || '';
      document.getElementById('incomeAmount').value = inc.amount;
    }, 50);
    document.getElementById('modalIncomeTitle').textContent = 'Edit Pendapatan';
    openModal('modalIncome');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveIncome(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('incomeId').value;
    const data = {
      date: document.getElementById('incomeDate').value,
      propertyId: document.getElementById('incomeProperty').value,
      tenantId: document.getElementById('incomeTenant').value || null,
      amount: parseFloat(document.getElementById('incomeAmount').value),
      category: document.getElementById('incomeCategory').value,
      method: document.getElementById('incomeMethod').value,
      note: document.getElementById('incomeNote').value.trim(),
    };

    if (id) {
      await API.put(`/income/${id}`, data);
      showToast('Pendapatan diperbarui');
    } else {
      await API.post('/income', data);
      showToast('Pendapatan berhasil dicatat ✓');
    }

    closeModal('modalIncome');
    renderIncome();
    renderDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteIncome(id) {
  if (!confirm('Hapus data pendapatan ini?')) return;
  try {
    await API.delete(`/income/${id}`);
    renderIncome();
    renderDashboard();
    showToast('Data dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== EXPENSES ==========
async function populateExpenseFilters() {
  await populatePropertySelects();
  const sel = document.getElementById('filterExpenseMonth');
  sel.innerHTML = '<option value="">Semua Bulan</option>';
  fullMonth.forEach((m, i) => {
    sel.innerHTML += `<option value="${i}">${m}</option>`;
  });
}

async function renderExpenses() {
  try {
    let exps = await API.get('/expenses');
    const fProp = document.getElementById('filterExpenseProperty')?.value;
    const fMonth = document.getElementById('filterExpenseMonth')?.value;

    if (fProp) exps = exps.filter(i => i.propertyId._id == fProp);
    if (fMonth !== '' && fMonth !== undefined) exps = exps.filter(i => new Date(i.date).getMonth() == fMonth);

    exps.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('expensesTable');
    if (exps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-title">Tidak ada data pengeluaran</div></div></td></tr>`;
    } else {
      tbody.innerHTML = exps.map(i => `
        <tr>
          <td>${fmtDate(i.date)}</td>
          <td>${i.propertyId?.name || '—'}</td>
          <td>${i.category}</td>
          <td>${i.note}</td>
          <td class="amount-negative">-${fmt(i.amount)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="editExpense('${i._id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="deleteExpense('${i._id}')">🗑</button>
          </td>
        </tr>
      `).join('');
    }

    const total = exps.reduce((s, i) => s + i.amount, 0);
    document.getElementById('expenseTotalDisplay').textContent = fmt(total);
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function editExpense(id) {
  try {
    const exp = await API.get(`/expenses/${id}`);
    await populatePropertySelects();
    document.getElementById('expenseId').value = exp._id;
    document.getElementById('expenseDate').value = exp.date.split('T')[0];
    document.getElementById('expenseProperty').value = exp.propertyId._id;
    document.getElementById('expenseCategory').value = exp.category;
    document.getElementById('expenseAmount').value = exp.amount;
    document.getElementById('expenseNote').value = exp.note;
    document.getElementById('modalExpenseTitle').textContent = 'Edit Pengeluaran';
    openModal('modalExpense');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveExpense(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('expenseId').value;
    const data = {
      date: document.getElementById('expenseDate').value,
      propertyId: document.getElementById('expenseProperty').value,
      category: document.getElementById('expenseCategory').value,
      amount: parseFloat(document.getElementById('expenseAmount').value),
      note: document.getElementById('expenseNote').value.trim(),
    };

    if (id) {
      await API.put(`/expenses/${id}`, data);
      showToast('Pengeluaran diperbarui');
    } else {
      await API.post('/expenses', data);
      showToast('Pengeluaran berhasil dicatat');
    }

    closeModal('modalExpense');
    renderExpenses();
    renderDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Hapus data pengeluaran ini?')) return;
  try {
    await API.delete(`/expenses/${id}`);
    renderExpenses();
    showToast('Data dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== REPORTS ==========
let reportChartInstance = null;
let currentReportPeriod = 'year'; // 'month' | '3month' | '6month' | 'year'

function setReportPeriod(period) {
  currentReportPeriod = period;
  // Update active button
  document.querySelectorAll('.period-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.period === period);
  });
  // Show/hide year & month selectors
  const selY = document.getElementById('reportYear');
  const selM = document.getElementById('reportMonth');
  if (period === 'year') {
    selY.style.display = '';
    selM.style.display = 'none';
  } else if (period === 'month') {
    selY.style.display = '';
    selM.style.display = '';
  } else {
    selY.style.display = 'none';
    selM.style.display = 'none';
  }
  renderReports();
}

function getReportDateRange() {
  const now = new Date();
  const period = currentReportPeriod;

  if (period === 'month') {
    const y = parseInt(document.getElementById('reportYear').value) || now.getFullYear();
    const m = document.getElementById('reportMonth').value !== ''
      ? parseInt(document.getElementById('reportMonth').value)
      : now.getMonth();
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 0, 23, 59, 59);
    return { start, end, period, label: `${fullMonth[m]} ${y}` };
  }

  if (period === '3month') {
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { start, end, period, label: `${fullMonth[start.getMonth()]} – ${fullMonth[now.getMonth()]} ${now.getFullYear()}` };
  }

  if (period === '6month') {
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return { start, end, period, label: `${fullMonth[start.getMonth()]} – ${fullMonth[now.getMonth()]} ${now.getFullYear()}` };
  }

  // year (default)
  const year  = parseInt(document.getElementById('reportYear').value) || now.getFullYear();
  const start = new Date(year, 0, 1);
  const end   = new Date(year, 11, 31, 23, 59, 59);
  return { start, end, period: 'year', label: `Tahun ${year}`, year };
}

async function renderReports() {
  try {
    const now = new Date();

    // Populate year selector
    const selY = document.getElementById('reportYear');
    if (selY.options.length === 0) {
      for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
        selY.innerHTML += `<option value="${y}">${y}</option>`;
      }
    }

    // Populate month selector
    const selM = document.getElementById('reportMonth');
    if (selM.options.length === 0) {
      fullMonth.forEach((m, i) => {
        selM.innerHTML += `<option value="${i}"${i === now.getMonth() ? ' selected' : ''}>${m}</option>`;
      });
    }

    // Sync visibility based on current period
    const period = currentReportPeriod;
    if (period === 'year') {
      selY.style.display = '';
      selM.style.display = 'none';
    } else if (period === 'month') {
      selY.style.display = '';
      selM.style.display = '';
    } else {
      selY.style.display = 'none';
      selM.style.display = 'none';
    }

    const range = getReportDateRange();
    document.getElementById('reportPeriodLabel').textContent = range.label;

    const [allIncome, allExpenses, allIntIncomes, allIntExpenses, props] = await Promise.all([
      API.get('/income'),
      API.get('/expenses'),
      API.get('/internal-incomes'),
      API.get('/internal-expenses'),
      API.get('/properties'),
    ]);

    // Filter by date range
    const inRange = (dateStr) => {
      const d = new Date(dateStr);
      return d >= range.start && d <= range.end;
    };
    const incomes     = allIncome.filter(i => inRange(i.date));
    const expenses    = allExpenses.filter(i => inRange(i.date));
    const intIncomes  = allIntIncomes.filter(i => inRange(i.date));
    const intExpenses = allIntExpenses.filter(i => inRange(i.date));

    const totalPropIn  = incomes.reduce((s, i) => s + i.amount, 0);
    const totalPropOut = expenses.reduce((s, i) => s + i.amount, 0);
    const totalKasIn   = intIncomes.reduce((s, i) => s + i.amount, 0);
    const totalKasOut  = intExpenses.reduce((s, i) => s + i.amount, 0);
    const totalIn      = totalPropIn + totalKasIn;
    const totalOut     = totalPropOut + totalKasOut;
    const occupied     = props.filter(p => p.status === 'terisi').length;

    // Update label based on period
    const labelIn  = period === 'year' ? 'Total Pendapatan Tahunan' : `Total Pendapatan (${range.label})`;
    const labelOut = period === 'year' ? 'Total Pengeluaran Tahunan' : `Total Pengeluaran (${range.label})`;
    document.getElementById('rep-income-label').textContent = labelIn;
    document.getElementById('rep-expense-label').textContent = labelOut;

    document.getElementById('rep-income').textContent = fmt(totalIn);
    document.getElementById('rep-expense').textContent = fmt(totalOut);
    document.getElementById('rep-profit').textContent = fmt(totalIn - totalOut);
    document.getElementById('rep-profit').style.color = totalIn >= totalOut ? 'var(--green)' : 'var(--red)';
    document.getElementById('rep-occupancy').textContent = props.length ? Math.round(occupied / props.length * 100) + '%' : '0%';

    // ---- CHART ----
    let labels = [];
    let dataIn = [];
    let dataOut = [];
    let chartType = 'line';
    let chartTitle = 'Pendapatan per Bulan';

    if (period === 'year') {
      // 12 monthly bars for the year
      labels = fullMonth.map(m => m.substring(0, 3));
      dataIn  = Array(12).fill(0);
      dataOut = Array(12).fill(0);
      incomes.forEach(i => { dataIn[new Date(i.date).getMonth()]  += i.amount; });
      expenses.forEach(i => { dataOut[new Date(i.date).getMonth()] += i.amount; });
      intIncomes.forEach(i => { dataIn[new Date(i.date).getMonth()]  += i.amount; });
      intExpenses.forEach(i => { dataOut[new Date(i.date).getMonth()] += i.amount; });
      chartTitle = `Pendapatan per Bulan — ${range.year}`;
    } else if (period === 'month') {
      // Daily breakdown for the selected month
      const daysInMonth = new Date(range.end.getFullYear(), range.end.getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      dataIn  = Array(daysInMonth).fill(0);
      dataOut = Array(daysInMonth).fill(0);
      incomes.forEach(i => { const d = new Date(i.date).getDate() - 1; dataIn[d]  += i.amount; });
      expenses.forEach(i => { const d = new Date(i.date).getDate() - 1; dataOut[d] += i.amount; });
      intIncomes.forEach(i => { const d = new Date(i.date).getDate() - 1; dataIn[d]  += i.amount; });
      intExpenses.forEach(i => { const d = new Date(i.date).getDate() - 1; dataOut[d] += i.amount; });
      chartTitle = `Arus Kas Harian — ${range.label}`;
      chartType = 'bar';
    } else {
      // Monthly breakdown for 3 or 6 month range
      const months = period === '3month' ? 3 : 6;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(monthNames[d.getMonth()]);
        const mIn  = [...incomes, ...intIncomes].filter(t => {
          const td = new Date(t.date);
          return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        }).reduce((s, t) => s + t.amount, 0);
        const mOut = [...expenses, ...intExpenses].filter(t => {
          const td = new Date(t.date);
          return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        }).reduce((s, t) => s + t.amount, 0);
        dataIn.push(mIn);
        dataOut.push(mOut);
      }
      chartTitle = `Arus Kas ${months} Bulan Terakhir`;
    }

    const chartTitleEl = document.getElementById('reportChartTitle');
    if (chartTitleEl) chartTitleEl.textContent = chartTitle;

    if (reportChartInstance) reportChartInstance.destroy();
    const ctx = document.getElementById('reportChart').getContext('2d');
    reportChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels,
        datasets: [
          { label: 'Pemasukan', data: dataIn,  borderColor: 'var(--green)', backgroundColor: 'rgba(62,207,142,0.15)', tension: 0.4, fill: true, pointRadius: chartType === 'line' ? 4 : 0, borderRadius: chartType === 'bar' ? 5 : 0, borderSkipped: false },
          { label: 'Pengeluaran', data: dataOut, borderColor: 'var(--red)',   backgroundColor: 'rgba(245,101,101,0.12)', tension: 0.4, fill: true, pointRadius: chartType === 'line' ? 4 : 0, borderRadius: chartType === 'bar' ? 5 : 0, borderSkipped: false }
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

    // ---- RINGKASAN PER PROPERTI ----
    const table = document.getElementById('reportPropertyTable');
    if (props.length === 0) {
      table.innerHTML = '<div class="empty-state"><div class="empty-state-title">Belum ada properti</div></div>';
    } else {
      table.innerHTML = '<div class="report-prop-table">' + props.map(p => {
        const pIn  = incomes.filter(i => i.propertyId._id === p._id).reduce((s, i) => s + i.amount, 0);
        const pOut = expenses.filter(i => i.propertyId._id === p._id).reduce((s, i) => s + i.amount, 0);
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

    // ---- RINGKASAN KAS ----
    const kasTable = document.getElementById('reportKasTable');
    const kasRows = [
      { label: 'Pendapatan Sewa', amount: totalPropIn, type: 'in', icon: '🏠' },
      { label: 'Kas Masuk (Non-Sewa)', amount: totalKasIn, type: 'in', icon: '💰' },
      { label: 'Pengeluaran Properti', amount: totalPropOut, type: 'out', icon: '🔧' },
      { label: 'Kas Keluar (Non-Properti)', amount: totalKasOut, type: 'out', icon: '🛒' },
    ];
    kasTable.innerHTML = '<div class="report-prop-table">' + kasRows.map(r => `
      <div class="report-prop-row">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.3rem;">${r.icon}</span>
          <div>
            <div class="report-prop-name" style="font-size:0.9rem;">${r.label}</div>
            <small style="color:var(--text3)">${r.type === 'in' ? 'Pemasukan' : 'Pengeluaran'}</small>
          </div>
        </div>
        <div class="report-prop-vals">
          <div><div class="${r.type === 'in' ? 'report-prop-in' : 'report-prop-out'}" style="font-size:1rem;">${r.type === 'in' ? '+' : '-'}${fmt(r.amount)}</div></div>
        </div>
      </div>
    `).join('') + '</div>';

    // ---- SALDO KAS BERSIH ----
    const kasSummaryEl = document.getElementById('reportKasSummary');
    const saldoBersih  = totalIn - totalOut;
    const saldoColor   = saldoBersih >= 0 ? 'var(--green)' : 'var(--red)';
    const roiPct       = totalOut > 0 ? ((saldoBersih / totalOut) * 100).toFixed(1) : '—';
    kasSummaryEl.innerHTML = `
      <div style="padding:16px 4px;">
        <div class="report-prop-row" style="border-bottom:1px solid var(--border,#252a38);padding-bottom:12px;margin-bottom:12px;">
          <div><div class="report-prop-name">Total Pemasukan</div></div>
          <div class="report-prop-in" style="font-size:1rem;font-weight:600;">+${fmt(totalIn)}</div>
        </div>
        <div class="report-prop-row" style="border-bottom:1px solid var(--border,#252a38);padding-bottom:12px;margin-bottom:12px;">
          <div><div class="report-prop-name">Total Pengeluaran</div></div>
          <div class="report-prop-out" style="font-size:1rem;font-weight:600;">-${fmt(totalOut)}</div>
        </div>
        <div class="report-prop-row" style="border-bottom:1px solid var(--border,#252a38);padding-bottom:12px;margin-bottom:12px;">
          <div><div class="report-prop-name">Keuntungan Bersih</div><small style="color:var(--text3)">Pemasukan − Pengeluaran</small></div>
          <div style="font-size:1.15rem;font-weight:700;color:${saldoColor};">${saldoBersih >= 0 ? '+' : ''}${fmt(saldoBersih)}</div>
        </div>
        <div class="report-prop-row">
          <div><div class="report-prop-name">Return on Cost</div><small style="color:var(--text3)">Bersih ÷ Pengeluaran × 100%</small></div>
          <div style="font-size:1rem;font-weight:600;color:${saldoColor};">${roiPct}${roiPct !== '—' ? '%' : ''}</div>
        </div>
      </div>
    `;
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== EXPORT ==========
async function exportReport() {
  try {
    const year = parseInt(document.getElementById('reportYear').value) || new Date().getFullYear();
    const incomes = (await API.get('/income')).filter(i => new Date(i.date).getFullYear() === year);
    const expenses = (await API.get('/expenses')).filter(i => new Date(i.date).getFullYear() === year);

    let csv = 'Tanggal,Properti,Penyewa,Keterangan,Tipe,Jumlah\n';
    const all = [
      ...incomes.map(i => ({ date: i.date.split('T')[0], prop: i.propertyId?.name || '', tenant: i.tenantId?.name || '', note: i.note || i.category, type: 'Pendapatan', amount: i.amount })),
      ...expenses.map(e => ({ date: e.date.split('T')[0], prop: e.propertyId?.name || '', tenant: '', note: e.note, type: 'Pengeluaran', amount: -e.amount }))
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
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== INTERNAL INCOMES ==========
function populateInternalFilters(prefix) {
  const now = new Date();
  const capPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  const monthSel = document.getElementById(`filter${capPrefix}Month`);
  const yearSel  = document.getElementById(`filter${capPrefix}Year`);
  if (!monthSel || !yearSel) return;

  if (monthSel.options.length <= 1) {
    fullMonth.forEach((m, i) => {
      monthSel.innerHTML += `<option value="${i}">${m}</option>`;
    });
  }
  if (yearSel.options.length <= 1) {
    yearSel.innerHTML = '<option value="">Semua Tahun</option>';
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
      yearSel.innerHTML += `<option value="${y}">${y}</option>`;
    }
  }
}

function populateIntCategoryFilter(selectId, storageKey, defaults) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const currentVal = sel.value;
  const cats = getIntCategories(storageKey, defaults);
  sel.innerHTML = '<option value="">Semua Jenis</option>';
  cats.forEach(c => {
    sel.innerHTML += `<option value="${c}">${c}</option>`;
  });
  // Pertahankan pilihan sebelumnya jika masih ada
  if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
    sel.value = currentVal;
  }
}

async function renderInternalIncomes() {
  try {
    let data = await API.get('/internal-incomes');
    const fMonth    = document.getElementById('filterIntIncMonth')?.value;
    const fYear     = document.getElementById('filterIntIncYear')?.value;
    const fCategory = document.getElementById('filterIntIncCategory')?.value;

    if (fMonth !== '' && fMonth !== undefined) data = data.filter(i => new Date(i.date).getMonth() == fMonth);
    if (fYear) data = data.filter(i => new Date(i.date).getFullYear() == fYear);
    if (fCategory) data = data.filter(i => i.category === fCategory);

    // Refresh opsi filter category dari data yang tersedia + localStorage
    populateIntCategoryFilter('filterIntIncCategory', STORAGE_KEY_INC, DEFAULT_INC_CATS);

    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('internalIncomeTable');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-title">Belum ada data kas masuk</div></div></td></tr>`;
    } else {
      tbody.innerHTML = data.map(i => `
        <tr>
          <td>${fmtDate(i.date)}</td>
          <td><span style="background:rgba(var(--green-rgb,80,200,120),0.12);color:var(--green,#50c878);padding:2px 8px;border-radius:20px;font-size:0.8rem;white-space:nowrap;">${i.category || '—'}</span></td>
          <td>${i.name}</td>
          <td class="amount-positive">+${fmt(i.amount)}</td>
          <td>${i.note || '—'}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="editInternalIncome('${i._id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="deleteInternalIncome('${i._id}')">🗑</button>
          </td>
        </tr>
      `).join('');
    }
    const total = data.reduce((s, i) => s + i.amount, 0);
    document.getElementById('internalIncomeTotalDisplay').textContent = fmt(total);
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function openAddInternalIncome() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('internalIncomeId').value = '';
  document.getElementById('formInternalIncome').reset();
  document.getElementById('intIncDate').value = today;
  document.getElementById('modalInternalIncomeTitle').textContent = 'Catat Kas Masuk';
  populateIntCategorySelect('intIncCategory', 'intIncNewCategoryWrap', STORAGE_KEY_INC, DEFAULT_INC_CATS);
  // Jika belum ada kategori sama sekali, langsung tampilkan form buat baru
  const cats = getIntCategories(STORAGE_KEY_INC, DEFAULT_INC_CATS);
  if (cats.length === 0) {
    document.getElementById('intIncNewCategoryWrap').style.display = 'block';
  }
  openModal('modalInternalIncome');
}

async function editInternalIncome(id) {
  try {
    const item = await API.get(`/internal-incomes/${id}`);
    document.getElementById('internalIncomeId').value = item._id;
    document.getElementById('intIncDate').value = item.date.split('T')[0];
    document.getElementById('intIncName').value = item.name;
    document.getElementById('intIncAmount').value = item.amount;
    document.getElementById('intIncNote').value = item.note || '';
    document.getElementById('modalInternalIncomeTitle').textContent = 'Edit Kas Masuk';

    // Populate kategori, lalu set nilai tersimpan
    populateIntCategorySelect('intIncCategory', 'intIncNewCategoryWrap', STORAGE_KEY_INC, DEFAULT_INC_CATS);
    const catSel = document.getElementById('intIncCategory');
    if (item.category) {
      // Pastikan opsi ada; jika tidak, tambahkan sementara
      if (![...catSel.options].some(o => o.value === item.category)) {
        const opt = new Option(item.category, item.category);
        catSel.insertBefore(opt, catSel.options[catSel.options.length - 1]);
      }
      catSel.value = item.category;
    }
    document.getElementById('intIncNewCategoryWrap').style.display = 'none';

    openModal('modalInternalIncome');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveInternalIncome(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('internalIncomeId').value;
    const catVal = document.getElementById('intIncCategory').value;
    if (!catVal || catVal === '__new__') {
      showToast('Pilih atau buat jenis pemasukan terlebih dahulu', 'error');
      return;
    }
    const data = {
      date:     document.getElementById('intIncDate').value,
      name:     document.getElementById('intIncName').value.trim(),
      amount:   parseFloat(document.getElementById('intIncAmount').value),
      note:     document.getElementById('intIncNote').value.trim(),
      category: catVal,
    };
    if (id) {
      await API.put(`/internal-incomes/${id}`, data);
      showToast('Kas masuk diperbarui ✓');
    } else {
      await API.post('/internal-incomes', data);
      showToast('Kas masuk berhasil dicatat ✓');
    }
    closeModal('modalInternalIncome');
    renderInternalIncomes();
    renderDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteInternalIncome(id) {
  if (!confirm('Hapus data kas masuk ini?')) return;
  try {
    await API.delete(`/internal-incomes/${id}`);
    renderInternalIncomes();
    renderDashboard();
    showToast('Data dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== INTERNAL CATEGORY HELPERS ==========
// Jenis disimpan di localStorage agar persisten tanpa endpoint baru

const STORAGE_KEY_INC = 'qrents_intInc_categories';
const STORAGE_KEY_EXP = 'qrents_intExp_categories';

const DEFAULT_INC_CATS = [];
const DEFAULT_EXP_CATS = [];

function getIntCategories(key, defaults) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [...defaults];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...defaults];
  } catch { return [...defaults]; }
}

function saveIntCategories(key, cats) {
  localStorage.setItem(key, JSON.stringify(cats));
}

function populateIntCategorySelect(selectId, wrapId, key, defaults) {
  const sel  = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  if (!sel) return;

  const cats = getIntCategories(key, defaults);
  sel.innerHTML = '<option value="">Pilih Jenis</option>';
  cats.forEach(c => {
    sel.innerHTML += `<option value="${c}">${c}</option>`;
  });
  // Option untuk buat jenis baru
  sel.innerHTML += '<option value="__new__">＋ Buat Jenis Baru...</option>';

  // Tampilkan wrap "buat baru" hanya jika belum ada kategori sama sekali
  if (wrap) {
    wrap.style.display = (cats.length === 0) ? 'block' : 'none';
  }
}

// Kas Masuk
function onIntIncCategoryChange() {
  const sel  = document.getElementById('intIncCategory');
  const wrap = document.getElementById('intIncNewCategoryWrap');
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === '__new__' ? 'block' : 'none';
  if (sel.value === '__new__') {
    document.getElementById('intIncNewCategory').focus();
  }
}

function addIntIncCategory() {
  const input = document.getElementById('intIncNewCategory');
  const name  = input ? input.value.trim() : '';
  if (!name) { showToast('Nama jenis tidak boleh kosong', 'error'); return; }

  const cats = getIntCategories(STORAGE_KEY_INC, DEFAULT_INC_CATS);
  if (cats.includes(name)) { showToast('Jenis sudah ada', 'error'); return; }

  cats.push(name);
  saveIntCategories(STORAGE_KEY_INC, cats);

  // Refresh select & pilih yang baru
  populateIntCategorySelect('intIncCategory', 'intIncNewCategoryWrap', STORAGE_KEY_INC, DEFAULT_INC_CATS);
  document.getElementById('intIncCategory').value = name;
  document.getElementById('intIncNewCategoryWrap').style.display = 'none';
  if (input) input.value = '';
  // Refresh filter category di halaman
  populateIntCategoryFilter('filterIntIncCategory', STORAGE_KEY_INC, DEFAULT_INC_CATS);
  showToast(`Jenis "${name}" ditambahkan ✓`);
}

// Kas Keluar
function onIntExpCategoryChange() {
  const sel  = document.getElementById('intExpCategory');
  const wrap = document.getElementById('intExpNewCategoryWrap');
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === '__new__' ? 'block' : 'none';
  if (sel.value === '__new__') {
    document.getElementById('intExpNewCategory').focus();
  }
}

function addIntExpCategory() {
  const input = document.getElementById('intExpNewCategory');
  const name  = input ? input.value.trim() : '';
  if (!name) { showToast('Nama jenis tidak boleh kosong', 'error'); return; }

  const cats = getIntCategories(STORAGE_KEY_EXP, DEFAULT_EXP_CATS);
  if (cats.includes(name)) { showToast('Jenis sudah ada', 'error'); return; }

  cats.push(name);
  saveIntCategories(STORAGE_KEY_EXP, cats);

  populateIntCategorySelect('intExpCategory', 'intExpNewCategoryWrap', STORAGE_KEY_EXP, DEFAULT_EXP_CATS);
  document.getElementById('intExpCategory').value = name;
  document.getElementById('intExpNewCategoryWrap').style.display = 'none';
  if (input) input.value = '';
  showToast(`Jenis "${name}" ditambahkan ✓`);
}

// ========== INTERNAL EXPENSES ==========
async function renderInternalExpenses() {
  try {
    let data = await API.get('/internal-expenses');
    const fMonth    = document.getElementById('filterIntExpMonth')?.value;
    const fYear     = document.getElementById('filterIntExpYear')?.value;
    const fCategory = document.getElementById('filterIntExpCategory')?.value;

    if (fMonth !== '' && fMonth !== undefined) data = data.filter(i => new Date(i.date).getMonth() == fMonth);
    if (fYear) data = data.filter(i => new Date(i.date).getFullYear() == fYear);
    if (fCategory) data = data.filter(i => i.category === fCategory);

    // Refresh opsi filter category dari data yang tersedia + localStorage
    populateIntCategoryFilter('filterIntExpCategory', STORAGE_KEY_EXP, DEFAULT_EXP_CATS);

    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('internalExpenseTable');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Belum ada data kas keluar</div></div></td></tr>`;
    } else {
      tbody.innerHTML = data.map(i => `
        <tr>
          <td>${fmtDate(i.date)}</td>
          <td><span style="background:rgba(var(--red-rgb,224,85,85),0.12);color:var(--red,#e05555);padding:2px 8px;border-radius:20px;font-size:0.8rem;white-space:nowrap;">${i.category || '—'}</span></td>
          <td>${i.name}</td>
          <td class="amount-negative">-${fmt(i.amount)}</td>
          <td>${i.note || '—'}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="editInternalExpense('${i._id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="deleteInternalExpense('${i._id}')">🗑</button>
          </td>
        </tr>
      `).join('');
    }
    const total = data.reduce((s, i) => s + i.amount, 0);
    document.getElementById('internalExpenseTotalDisplay').textContent = fmt(total);
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function openAddInternalExpense() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('internalExpenseId').value = '';
  document.getElementById('formInternalExpense').reset();
  document.getElementById('intExpDate').value = today;
  document.getElementById('modalInternalExpenseTitle').textContent = 'Catat Kas Keluar';
  populateIntCategorySelect('intExpCategory', 'intExpNewCategoryWrap', STORAGE_KEY_EXP, DEFAULT_EXP_CATS);
  const cats = getIntCategories(STORAGE_KEY_EXP, DEFAULT_EXP_CATS);
  if (cats.length === 0) {
    document.getElementById('intExpNewCategoryWrap').style.display = 'block';
  }
  openModal('modalInternalExpense');
}

async function editInternalExpense(id) {
  try {
    const item = await API.get(`/internal-expenses/${id}`);
    document.getElementById('internalExpenseId').value = item._id;
    document.getElementById('intExpDate').value = item.date.split('T')[0];
    document.getElementById('intExpName').value = item.name;
    document.getElementById('intExpAmount').value = item.amount;
    document.getElementById('intExpNote').value = item.note || '';
    document.getElementById('modalInternalExpenseTitle').textContent = 'Edit Kas Keluar';

    populateIntCategorySelect('intExpCategory', 'intExpNewCategoryWrap', STORAGE_KEY_EXP, DEFAULT_EXP_CATS);
    const catSel = document.getElementById('intExpCategory');
    if (item.category) {
      if (![...catSel.options].some(o => o.value === item.category)) {
        const opt = new Option(item.category, item.category);
        catSel.insertBefore(opt, catSel.options[catSel.options.length - 1]);
      }
      catSel.value = item.category;
    }
    document.getElementById('intExpNewCategoryWrap').style.display = 'none';

    openModal('modalInternalExpense');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveInternalExpense(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('internalExpenseId').value;
    const catVal = document.getElementById('intExpCategory').value;
    if (!catVal || catVal === '__new__') {
      showToast('Pilih atau buat jenis pengeluaran terlebih dahulu', 'error');
      return;
    }
    const data = {
      date:     document.getElementById('intExpDate').value,
      name:     document.getElementById('intExpName').value.trim(),
      amount:   parseFloat(document.getElementById('intExpAmount').value),
      note:     document.getElementById('intExpNote').value.trim(),
      category: catVal,
    };
    if (id) {
      await API.put(`/internal-expenses/${id}`, data);
      showToast('Kas keluar diperbarui ✓');
    } else {
      await API.post('/internal-expenses', data);
      showToast('Kas keluar berhasil dicatat ✓');
    }
    closeModal('modalInternalExpense');
    renderInternalExpenses();
    renderDashboard();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteInternalExpense(id) {
  if (!confirm('Hapus data kas keluar ini?')) return;
  try {
    await API.delete(`/internal-expenses/${id}`);
    renderInternalExpenses();
    renderDashboard();
    showToast('Data dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== CICILAN ==========
const STORAGE_KEY_CICILAN_CATS = 'qrents_cicilan_cats';
const DEFAULT_CICILAN_CATS = ['Kendaraan', 'Elektronik', 'Properti', 'Kartu Kredit', 'Pinjaman', 'Lainnya'];

function getCicilanCategories() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CICILAN_CATS);
    return stored ? JSON.parse(stored) : [...DEFAULT_CICILAN_CATS];
  } catch { return [...DEFAULT_CICILAN_CATS]; }
}

function saveCicilanCategories(cats) {
  localStorage.setItem(STORAGE_KEY_CICILAN_CATS, JSON.stringify(cats));
}

function populateCicilanCategorySelect() {
  const cats = getCicilanCategories();
  const sel = document.getElementById('cicilanCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Pilih Kategori —</option>';
  cats.forEach(c => { sel.innerHTML += `<option value="${c}">${c}</option>`; });
  sel.innerHTML += '<option value="__new__">+ Tambah Kategori Baru...</option>';
}

function onCicilanCategoryChange() {
  const sel = document.getElementById('cicilanCategory');
  const wrap = document.getElementById('cicilanNewCategoryWrap');
  if (sel.value === '__new__') {
    wrap.style.display = 'block';
    document.getElementById('cicilanNewCategory').focus();
  } else {
    wrap.style.display = 'none';
  }
}

function addCicilanCategory() {
  const input = document.getElementById('cicilanNewCategory');
  const newCat = input.value.trim();
  if (!newCat) { showToast('Isi nama kategori terlebih dahulu', 'error'); return; }
  const cats = getCicilanCategories();
  if (cats.includes(newCat)) { showToast('Kategori sudah ada', 'error'); return; }
  cats.push(newCat);
  saveCicilanCategories(cats);
  populateCicilanCategorySelect();
  document.getElementById('cicilanCategory').value = newCat;
  document.getElementById('cicilanNewCategoryWrap').style.display = 'none';
  input.value = '';
  showToast('Kategori baru ditambahkan ✓');
}

function autoCalcCicilanBulanan() {
  const total = parseFloat(document.getElementById('cicilanTotalAmount').value) || 0;
  const bulan = parseInt(document.getElementById('cicilanTotalBulan').value) || 0;
  const bulanan = document.getElementById('cicilanBulanan');
  if (total > 0 && bulan > 0) {
    bulanan.value = Math.ceil(total / bulan);
  } else {
    bulanan.value = '';
  }
}

async function populateCicilanFilters() {
  // Category filter
  const cats = getCicilanCategories();
  const catSel = document.getElementById('filterCicilanCategory');
  if (catSel) {
    catSel.innerHTML = '<option value="">Semua Kategori</option>';
    cats.forEach(c => { catSel.innerHTML += `<option value="${c}">${c}</option>`; });
  }

  // Month filter
  const mSel = document.getElementById('filterCicilanMonth');
  if (mSel) {
    mSel.innerHTML = '<option value="">Semua Bulan</option>';
    fullMonth.forEach((m, i) => { mSel.innerHTML += `<option value="${i}">${m}</option>`; });
  }

  // Year filter
  const ySel = document.getElementById('filterCicilanYear');
  if (ySel) {
    ySel.innerHTML = '<option value="">Semua Tahun</option>';
    const now = new Date();
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 4; y--) {
      ySel.innerHTML += `<option value="${y}">${y}</option>`;
    }
  }
}

async function renderCicilan() {
  try {
    let data = await API.get('/cicilan');
    const fCat    = document.getElementById('filterCicilanCategory')?.value;
    const fStatus = document.getElementById('filterCicilanStatus')?.value;
    const fMonth  = document.getElementById('filterCicilanMonth')?.value;
    const fYear   = document.getElementById('filterCicilanYear')?.value;

    if (fCat)    data = data.filter(c => c.category === fCat);
    if (fMonth !== '' && fMonth !== undefined) data = data.filter(c => new Date(c.date).getMonth() == fMonth);
    if (fYear)   data = data.filter(c => new Date(c.date).getFullYear() == fYear);

    // Compute derived fields
    data = data.map(c => {
      const totalPaid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
      const sisaBayar = Math.max(0, c.totalAmount - totalPaid);
      const sisaBulan = sisaBayar > 0 ? Math.ceil(sisaBayar / c.bulanan) : 0;
      const status    = sisaBayar <= 0 ? 'lunas' : 'aktif';
      return { ...c, totalPaid, sisaBayar, sisaBulan, status };
    });

    if (fStatus) data = data.filter(c => c.status === fStatus);

    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Summary cards
    const aktif = data.filter(c => c.status === 'aktif');
    const now = new Date();
    const bulanIni = aktif.filter(c => {
      const d = new Date(c.date);
      return d.getMonth() <= now.getMonth() && d.getFullYear() <= now.getFullYear();
    });
    document.getElementById('cicilanStatTotal').textContent = fmt(aktif.reduce((s, c) => s + c.bulanan, 0));
    document.getElementById('cicilanStatCount').textContent = `${aktif.length} cicilan aktif`;
    document.getElementById('cicilanStatBulanIni').textContent = fmt(bulanIni.reduce((s, c) => s + c.bulanan, 0));
    document.getElementById('cicilanStatBulanIniCount').textContent = `${bulanIni.length} cicilan berjalan`;
    document.getElementById('cicilanStatSisa').textContent = fmt(aktif.reduce((s, c) => s + c.sisaBayar, 0));
    document.getElementById('cicilanStatSisaCount').textContent = 'dari semua cicilan aktif';

    const tbody = document.getElementById('cicilanTable');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Belum ada data cicilan</div><div class="empty-state-sub">Klik "+ Tambah Cicilan" untuk mulai</div></div></td></tr>`;
    } else {
      tbody.innerHTML = data.map(c => `
        <tr style="cursor:pointer;" onclick="openCicilanDetail('${c._id}')">
          <td>${fmtDate(c.date)}</td>
          <td><strong>${c.name}</strong>${c.note ? `<div style="font-size:0.78rem;color:var(--text2);">${c.note}</div>` : ''}</td>
          <td><span style="background:rgba(201,168,76,0.12);color:var(--gold);padding:2px 8px;border-radius:20px;font-size:0.8rem;">${c.category || '—'}</span></td>
          <td class="amount-negative">-${fmt(c.bulanan)}</td>
          <td style="text-align:center;">${c.totalBulan}</td>
          <td style="text-align:center;">${c.status === 'lunas' ? '<span style="color:var(--green);">✓ Lunas</span>' : c.sisaBulan}</td>
          <td class="${c.sisaBayar > 0 ? 'amount-negative' : 'amount-positive'}">${c.sisaBayar > 0 ? fmt(c.sisaBayar) : '✓ Lunas'}</td>
          <td><span class="status-badge ${c.status === 'lunas' ? 'terisi' : 'kosong'}">${c.status}</span></td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-outline btn-sm" onclick="editCicilan('${c._id}')">✏</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCicilan('${c._id}')">🗑</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function openAddCicilan() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('cicilanId').value = '';
  document.getElementById('formCicilan').reset();
  document.getElementById('cicilanDate').value = today;
  document.getElementById('cicilanBulanan').value = '';
  document.getElementById('modalCicilanTitle').textContent = 'Tambah Cicilan';
  populateCicilanCategorySelect();
  document.getElementById('cicilanNewCategoryWrap').style.display = 'none';
  openModal('modalCicilan');
}

async function editCicilan(id) {
  try {
    const c = await API.get(`/cicilan/${id}`);
    document.getElementById('cicilanId').value = c._id;
    document.getElementById('cicilanDate').value = c.date.split('T')[0];
    document.getElementById('cicilanName').value = c.name;
    document.getElementById('cicilanTotalAmount').value = c.totalAmount;
    document.getElementById('cicilanTotalBulan').value = c.totalBulan;
    document.getElementById('cicilanBulanan').value = c.bulanan;
    document.getElementById('cicilanBunga').value = c.bunga || '';
    document.getElementById('cicilanNote').value = c.note || '';
    document.getElementById('modalCicilanTitle').textContent = 'Edit Cicilan';
    populateCicilanCategorySelect();
    const catSel = document.getElementById('cicilanCategory');
    if (c.category) catSel.value = c.category;
    document.getElementById('cicilanNewCategoryWrap').style.display = 'none';
    openModal('modalCicilan');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveCicilan(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('cicilanId').value;
    const catVal = document.getElementById('cicilanCategory').value;
    if (!catVal || catVal === '__new__') {
      showToast('Pilih atau buat kategori terlebih dahulu', 'error'); return;
    }
    const totalAmount = parseFloat(document.getElementById('cicilanTotalAmount').value);
    const totalBulan  = parseInt(document.getElementById('cicilanTotalBulan').value);
    const bulanan     = Math.ceil(totalAmount / totalBulan);
    const data = {
      date:        document.getElementById('cicilanDate').value,
      name:        document.getElementById('cicilanName').value.trim(),
      category:    catVal,
      totalAmount,
      totalBulan,
      bulanan,
      bunga:       parseFloat(document.getElementById('cicilanBunga').value) || 0,
      note:        document.getElementById('cicilanNote').value.trim(),
    };
    if (id) {
      await API.put(`/cicilan/${id}`, data);
      showToast('Cicilan diperbarui ✓');
    } else {
      await API.post('/cicilan', data);
      showToast('Cicilan berhasil ditambahkan ✓');
    }
    closeModal('modalCicilan');
    populateCicilanFilters();
    renderCicilan();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteCicilan(id) {
  if (!confirm('Hapus data cicilan ini beserta semua riwayat pembayarannya?')) return;
  try {
    await API.delete(`/cicilan/${id}`);
    renderCicilan();
    showToast('Cicilan dihapus', 'error');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function openCicilanDetail(id) {
  try {
    const c = await API.get(`/cicilan/${id}`);
    const totalPaid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
    const sisaBayar = Math.max(0, c.totalAmount - totalPaid);
    const sisaBulan = sisaBayar > 0 ? Math.ceil(sisaBayar / c.bulanan) : 0;
    const persen    = Math.min(100, Math.round((totalPaid / c.totalAmount) * 100));
    const status    = sisaBayar <= 0 ? 'lunas' : 'aktif';

    document.getElementById('modalCicilanDetailTitle').textContent = c.name;
    document.getElementById('cicilanPaymentCicilanId').value = c._id;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cicilanPaymentDate').value = today;
    document.getElementById('cicilanPaymentAmount').value = c.bulanan;
    document.getElementById('cicilanPaymentNote').value = '';

    const payments = [...(c.payments || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

    const content = document.getElementById('cicilanDetailContent');
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;padding-top:16px;">
        <div style="background:var(--bg3);border-radius:10px;padding:12px;">
          <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;">Cicilan/Bulan</div>
          <div style="font-weight:700;color:var(--red);font-size:1.05rem;">-${fmt(c.bulanan)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px;">
          <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;">Total Cicilan</div>
          <div style="font-weight:700;font-size:1.05rem;">${fmt(c.totalAmount)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px;">
          <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;">Sudah Dibayar</div>
          <div style="font-weight:700;color:var(--green);font-size:1.05rem;">${fmt(totalPaid)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:10px;padding:12px;">
          <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;">Sisa Bayar</div>
          <div style="font-weight:700;color:${sisaBayar > 0 ? 'var(--red)' : 'var(--green)'};font-size:1.05rem;">${sisaBayar > 0 ? fmt(sisaBayar) : '✓ Lunas'}</div>
        </div>
      </div>

      <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:0.8rem;">
        <span style="color:var(--text2);">Progress Pembayaran</span>
        <span style="color:var(--gold);font-weight:600;">${persen}%</span>
      </div>
      <div style="background:var(--bg3);border-radius:99px;height:8px;overflow:hidden;margin-bottom:16px;">
        <div style="height:100%;width:${persen}%;background:linear-gradient(90deg,var(--gold),var(--green));border-radius:99px;transition:width 0.4s;"></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="background:rgba(201,168,76,0.12);color:var(--gold);padding:3px 10px;border-radius:20px;font-size:0.8rem;">${c.category || '—'}</span>
        <span style="background:var(--bg3);color:var(--text2);padding:3px 10px;border-radius:20px;font-size:0.8rem;">${c.totalBulan} bulan total</span>
        <span style="background:var(--bg3);color:var(--text2);padding:3px 10px;border-radius:20px;font-size:0.8rem;">${sisaBulan} bulan sisa</span>
        ${c.bunga ? `<span style="background:rgba(245,101,101,0.1);color:var(--red);padding:3px 10px;border-radius:20px;font-size:0.8rem;">Bunga ${c.bunga}%/thn</span>` : ''}
        <span class="status-badge ${status === 'lunas' ? 'terisi' : 'kosong'}">${status}</span>
      </div>

      ${c.note ? `<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;font-size:0.85rem;color:var(--text2);margin-bottom:16px;">📝 ${c.note}</div>` : ''}

      <div style="font-weight:600;margin-bottom:10px;color:var(--text);">Riwayat Pembayaran</div>
      ${payments.length === 0
        ? `<div style="text-align:center;color:var(--text3);padding:20px 0;font-size:0.88rem;">Belum ada pembayaran tercatat</div>`
        : `<div style="max-height:200px;overflow-y:auto;">
          ${payments.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
              <div>
                <div style="font-size:0.88rem;font-weight:500;">${fmtDate(p.date)}</div>
                <div style="font-size:0.78rem;color:var(--text2);">${p.note || '—'}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:var(--green);font-weight:600;">+${fmt(p.amount)}</span>
                <button class="btn btn-danger btn-sm" onclick="deleteCicilanPayment('${c._id}','${p._id}')">🗑</button>
              </div>
            </div>
          `).join('')}
          </div>`
      }
    `;

    openModal('modalCicilanDetail');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function saveCicilanPayment(e) {
  e.preventDefault();
  try {
    const cicilanId = document.getElementById('cicilanPaymentCicilanId').value;
    const data = {
      date:   document.getElementById('cicilanPaymentDate').value,
      amount: parseFloat(document.getElementById('cicilanPaymentAmount').value),
      note:   document.getElementById('cicilanPaymentNote').value.trim(),
    };
    await API.post(`/cicilan/${cicilanId}/payments`, data);
    showToast('Pembayaran berhasil dicatat ✓');
    document.getElementById('formCicilanPayment').reset();
    await openCicilanDetail(cicilanId);
    renderCicilan();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function deleteCicilanPayment(cicilanId, paymentId) {
  if (!confirm('Hapus catatan pembayaran ini?')) return;
  try {
    await API.delete(`/cicilan/${cicilanId}/payments/${paymentId}`);
    showToast('Pembayaran dihapus', 'error');
    await openCicilanDetail(cicilanId);
    renderCicilan();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ========== BAYAR SERENTAK ==========
let _bayarSerentakList = []; // cicilan yang lolos filter tanggal

function openBayarSerentak() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bayarSerentakFilterDate').value = today;
  document.getElementById('bayarSerentakDate').value = today;
  document.getElementById('bayarSerentakNote').value = '';
  document.getElementById('bayarSerentakTotal').style.display = 'none';
  document.getElementById('btnBayarSerentakSubmit').disabled = true;
  document.getElementById('bayarSerentakPreview').innerHTML =
    `<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:12px 0;">Memuat cicilan…</div>`;
  _bayarSerentakList = [];
  openModal('modalBayarSerentak');

  previewBayarSerentak();

  document.getElementById('bayarSerentakFilterDate').onchange = previewBayarSerentak;
  document.getElementById('bayarSerentakDate').onchange = () => {
    // tanggal bayar berubah tidak perlu re-fetch, cukup enable/disable tombol
    const filterDate = document.getElementById('bayarSerentakFilterDate').value;
    const payDate    = document.getElementById('bayarSerentakDate').value;
    document.getElementById('btnBayarSerentakSubmit').disabled = !filterDate || !payDate || _bayarSerentakList.length === 0;
  };
}

async function previewBayarSerentak() {
  try {
    const filterDate = document.getElementById('bayarSerentakFilterDate').value;
    const payDate    = document.getElementById('bayarSerentakDate').value;
    const preview    = document.getElementById('bayarSerentakPreview');
    const totalBox   = document.getElementById('bayarSerentakTotal');
    const btnSubmit  = document.getElementById('btnBayarSerentakSubmit');

    if (!filterDate) {
      preview.innerHTML = `<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:12px 0;">Pilih tanggal cicilan untuk melihat preview</div>`;
      totalBox.style.display = 'none';
      btnSubmit.disabled = true;
      _bayarSerentakList = [];
      return;
    }

    // Parse tanggal filter: hanya cocokkan hari, bulan, tahun persis
    const fd = new Date(filterDate);
    const fd_day   = fd.getUTCDate();
    const fd_month = fd.getUTCMonth();
    const fd_year  = fd.getUTCFullYear();

    const all = await API.get('/cicilan');

    // Filter: tanggal cicilan persis sama DAN belum lunas
    const cocok = all.filter(c => {
      const cd = new Date(c.date);
      const sameTgl = cd.getUTCDate()  === fd_day &&
                      cd.getUTCMonth() === fd_month &&
                      cd.getUTCFullYear() === fd_year;
      const totalPaid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
      const belumLunas = totalPaid < c.totalAmount;
      return sameTgl && belumLunas;
    });

    _bayarSerentakList = cocok;

    if (cocok.length === 0) {
      preview.innerHTML = `<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:16px 0;">Tidak ada cicilan aktif pada tanggal ini</div>`;
      totalBox.style.display = 'none';
      btnSubmit.disabled = true;
      return;
    }

    const totalAmt = cocok.reduce((s, c) => s + c.bulanan, 0);

    preview.innerHTML = cocok.map(c => {
      const totalPaid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
      const sisaBayar = Math.max(0, c.totalAmount - totalPaid);
      const sisaBulan = Math.ceil(sisaBayar / c.bulanan);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:0.88rem;font-weight:500;">${c.name}</div>
            <div style="font-size:0.75rem;color:var(--text2);">${c.category || '—'} · sisa ${sisaBulan} bulan</div>
          </div>
          <span style="color:var(--red);font-weight:600;font-size:0.9rem;">-${fmt(c.bulanan)}</span>
        </div>
      `;
    }).join('');

    document.getElementById('bayarSerentakCount').textContent = `${cocok.length} cicilan akan dibayar`;
    document.getElementById('bayarSerentakTotalAmt').textContent = fmt(totalAmt);
    totalBox.style.display = 'block';
    btnSubmit.disabled = !payDate;

  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function submitBayarSerentak() {
  const payDate = document.getElementById('bayarSerentakDate').value;
  const note    = document.getElementById('bayarSerentakNote').value.trim();
  if (!payDate) { showToast('Pilih tanggal bayar', 'error'); return; }
  if (_bayarSerentakList.length === 0) { showToast('Tidak ada cicilan yang cocok', 'error'); return; }

  const btn = document.getElementById('btnBayarSerentakSubmit');
  btn.disabled = true;
  btn.textContent = 'Memproses…';

  try {
    await Promise.all(_bayarSerentakList.map(c =>
      API.post(`/cicilan/${c._id}/payments`, {
        date:   payDate,
        amount: c.bulanan,
        note:   note || 'Bayar serentak',
      })
    ));

    showToast(`✓ ${_bayarSerentakList.length} cicilan berhasil dibayar`);
    closeModal('modalBayarSerentak');
    renderCicilan();
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Bayar Semua';
  }
}


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

    // Modal buttons
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

    const repYear = document.getElementById('reportYear');
    if (repYear) repYear.addEventListener('change', renderReports);
    const repMonth = document.getElementById('reportMonth');
    if (repMonth) repMonth.addEventListener('change', renderReports);
  }

  populatePropertySelects();
  ['incomeDate', 'expenseDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  navigateTo('dashboard');
  // Pre-load reminder badge count
  setTimeout(renderReminders, 1200);
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

// ========== REMINDERS ==========
// localStorage key for dismissed reminders
const REMINDER_DISMISSED_KEY = 'qrents-dismissed-reminders';

function getDismissedReminders() {
  try { return JSON.parse(localStorage.getItem(REMINDER_DISMISSED_KEY) || '[]'); } catch { return []; }
}

function dismissReminder(id) {
  const dismissed = getDismissedReminders();
  if (!dismissed.includes(id)) dismissed.push(id);
  localStorage.setItem(REMINDER_DISMISSED_KEY, JSON.stringify(dismissed));
  renderReminders();
}

function undismissReminder(id) {
  let dismissed = getDismissedReminders();
  dismissed = dismissed.filter(d => d !== id);
  localStorage.setItem(REMINDER_DISMISSED_KEY, JSON.stringify(dismissed));
  renderReminders();
}

function clearAllDismissed() {
  localStorage.removeItem(REMINDER_DISMISSED_KEY);
  renderReminders();
}

let _reminderTab = 'all';
function switchReminderTab(tab, btn) {
  _reminderTab = tab;
  document.querySelectorAll('.reminder-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderReminderList(window._lastReminders || [], tab);
}

async function renderReminders() {
  const list = document.getElementById('reminderList');
  const summary = document.getElementById('reminderSummary');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-title">Memuat pengingat...</div></div>';

  try {
    const safeGet = async (path) => { try { return await API.get(path); } catch(e) { return []; } };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const in7  = new Date(now); in7.setDate(in7.getDate() + 7);
    const in14 = new Date(now); in14.setDate(in14.getDate() + 14);
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);

    const [tenants, cicilans] = await Promise.all([
      safeGet('/tenants'),
      safeGet('/cicilan'),
    ]);

    const reminders = [];

    // ── Tenant reminders ──
    tenants.forEach(t => {
      const end = t.end ? new Date(t.end) : null;
      if (!end) return;
      end.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      let urgency = null;
      if (daysLeft < 0)       urgency = 'overdue';
      else if (daysLeft <= 7) urgency = 'critical';
      else if (daysLeft <= 14) urgency = 'warning';
      else if (daysLeft <= 30) urgency = 'info';
      if (urgency === null) return;

      const label = daysLeft < 0
        ? `Kontrak berakhir ${Math.abs(daysLeft)} hari lalu`
        : daysLeft === 0
          ? 'Kontrak berakhir hari ini!'
          : `Kontrak berakhir ${daysLeft} hari lagi`;

      reminders.push({
        id: `tenant-${t._id}`,
        type: 'tenants',
        urgency,
        title: t.name,
        subtitle: t.propertyId?.name || '—',
        label,
        daysLeft,
        date: t.end,
        meta: `Sewa: ${fmt(t.rent)}/bln`,
        action: () => navigateTo('tenants'),
        actionLabel: '→ Lihat Penyewa',
      });
    });

    // ── Cicilan reminders ──
    (cicilans || []).forEach(c => {
      if (c.status === 'lunas') return;
      const payments = c.payments || [];
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      const remaining = (c.totalAmount || 0) - paid;
      if (remaining <= 0) return;

      // Find next due: cicilan start date each month
      const start = new Date(c.date);
      let nextDue = new Date(now.getFullYear(), now.getMonth(), start.getDate());
      if (nextDue < now) nextDue.setMonth(nextDue.getMonth() + 1);
      const daysLeft = Math.ceil((nextDue - now) / (1000 * 60 * 60 * 24));

      let urgency = null;
      if (daysLeft < 0)        urgency = 'overdue';
      else if (daysLeft <= 3)  urgency = 'critical';
      else if (daysLeft <= 7)  urgency = 'warning';
      else if (daysLeft <= 14) urgency = 'info';
      if (urgency === null) return;

      const label = daysLeft < 0
        ? `Jatuh tempo ${Math.abs(daysLeft)} hari lalu`
        : daysLeft === 0
          ? 'Jatuh tempo hari ini!'
          : `Jatuh tempo ${daysLeft} hari lagi`;

      reminders.push({
        id: `cicilan-${c._id}`,
        type: 'cicilan',
        urgency,
        title: c.name,
        subtitle: c.category || '—',
        label,
        daysLeft,
        date: nextDue.toISOString().split('T')[0],
        meta: `Cicilan: ${fmt(c.monthlyAmount || 0)}/bln · Sisa: ${fmt(remaining)}`,
        action: () => navigateTo('cicilan'),
        actionLabel: '→ Lihat Cicilan',
      });
    });

    // Sort by urgency then daysLeft
    const urgencyOrder = { overdue: 0, critical: 1, warning: 2, info: 3 };
    reminders.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency])
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return a.daysLeft - b.daysLeft;
    });

    window._lastReminders = reminders;

    // Update badge
    const dismissed = getDismissedReminders();
    const activeCount = reminders.filter(r => !dismissed.includes(r.id)).length;
    const badge = document.getElementById('bnav-reminder-badge');
    if (badge) {
      badge.textContent = activeCount;
      badge.style.display = activeCount > 0 ? 'flex' : 'none';
    }

    // Render summary
    if (summary) {
      const overdue  = reminders.filter(r => r.urgency === 'overdue').length;
      const critical = reminders.filter(r => r.urgency === 'critical').length;
      const warning  = reminders.filter(r => r.urgency === 'warning').length;
      const info     = reminders.filter(r => r.urgency === 'info').length;

      summary.innerHTML = `
        ${overdue  > 0 ? `<div class="reminder-badge reminder-badge-overdue">⚠ ${overdue} Terlambat</div>` : ''}
        ${critical > 0 ? `<div class="reminder-badge reminder-badge-critical">🔴 ${critical} Kritis (&le;3hr)</div>` : ''}
        ${warning  > 0 ? `<div class="reminder-badge reminder-badge-warning">🟡 ${warning} Segera (&le;7hr)</div>` : ''}
        ${info     > 0 ? `<div class="reminder-badge reminder-badge-info">🔵 ${info} Perhatikan (&le;14hr)</div>` : ''}
        ${reminders.length === 0 ? '<div class="reminder-badge reminder-badge-ok">✅ Semua aman</div>' : ''}
      `;
    }

    renderReminderList(reminders, _reminderTab);

  } catch (err) {
    if (list) list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">Gagal memuat pengingat</div><div class="empty-state-sub">${err.message}</div></div>`;
  }
}

function renderReminderList(reminders, tab) {
  const list = document.getElementById('reminderList');
  if (!list) return;

  const dismissed = getDismissedReminders();
  let filtered;
  if (tab === 'done') {
    filtered = reminders.filter(r => dismissed.includes(r.id));
  } else if (tab === 'all') {
    filtered = reminders.filter(r => !dismissed.includes(r.id));
  } else {
    filtered = reminders.filter(r => r.type === tab && !dismissed.includes(r.id));
  }

  if (filtered.length === 0) {
    const msgs = {
      all: 'Tidak ada pengingat aktif 🎉',
      tenants: 'Tidak ada penyewa yang akan jatuh tempo',
      cicilan: 'Tidak ada cicilan yang akan jatuh tempo',
      done: 'Belum ada pengingat yang diselesaikan',
    };
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${tab === 'done' ? '📋' : '✅'}</div><div class="empty-state-title">${msgs[tab]}</div></div>`;
    return;
  }

  const urgencyColors = { overdue: 'var(--red)', critical: 'var(--red)', warning: 'var(--gold)', info: 'var(--blue)' };
  const urgencyLabels = { overdue: 'TERLAMBAT', critical: 'KRITIS', warning: 'SEGERA', info: 'PERHATIAN' };
  const typeIcons = { tenants: '👤', cicilan: '💳' };

  list.innerHTML = filtered.map(r => {
    const isDone = dismissed.includes(r.id);
    const color = urgencyColors[r.urgency];
    return `
      <div class="reminder-card reminder-${r.urgency} ${isDone ? 'reminder-done' : ''}">
        <div class="reminder-card-accent" style="background:${color}"></div>
        <div class="reminder-card-body">
          <div class="reminder-card-top">
            <div class="reminder-card-left">
              <span class="reminder-type-icon">${typeIcons[r.type]}</span>
              <div>
                <div class="reminder-card-title">${r.title}</div>
                <div class="reminder-card-subtitle">${r.subtitle}</div>
              </div>
            </div>
            <span class="reminder-urgency-badge" style="background:${color}22;color:${color};border-color:${color}44">${urgencyLabels[r.urgency]}</span>
          </div>
          <div class="reminder-card-info">
            <span class="reminder-label" style="color:${color}">⏰ ${r.label}</span>
            <span class="reminder-meta">${r.meta}</span>
          </div>
          <div class="reminder-card-date">Tanggal: ${fmtDate(r.date)}</div>
          <div class="reminder-card-actions">
            ${!isDone
              ? `<button class="reminder-btn-dismiss" onclick="dismissReminder('${r.id}')">✓ Tandai Selesai</button>`
              : `<button class="reminder-btn-undo" onclick="undismissReminder('${r.id}')">↩ Batalkan</button>`
            }
            <button class="reminder-btn-goto" onclick="(${r.action.toString()})()">${r.actionLabel}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // If on 'done' tab, show clear all button
  if (tab === 'done' && filtered.length > 0) {
    list.innerHTML += `
      <div style="text-align:center;margin-top:16px;">
        <button class="btn btn-outline btn-sm" onclick="clearAllDismissed()" style="color:var(--red);border-color:var(--red);">🗑 Hapus Semua Riwayat Selesai</button>
      </div>
    `;
  }
}