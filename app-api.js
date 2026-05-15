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

async function renderReports() {
  try {
    const now = new Date();
    const selY = document.getElementById('reportYear');
    if (selY.options.length <= 1) {
      selY.innerHTML = '';
      for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
        selY.innerHTML += `<option value="${y}">${y}</option>`;
      }
    }

    const year = parseInt(document.getElementById('reportYear').value) || now.getFullYear();
    const [allIncome, allExpenses, allIntIncomes, allIntExpenses, props] = await Promise.all([
      API.get('/income'),
      API.get('/expenses'),
      API.get('/internal-incomes'),
      API.get('/internal-expenses'),
      API.get('/properties'),
    ]);
    const incomes  = allIncome.filter(i => new Date(i.date).getFullYear() === year);
    const expenses = allExpenses.filter(i => new Date(i.date).getFullYear() === year);
    const intIncomes  = allIntIncomes.filter(i => new Date(i.date).getFullYear() === year);
    const intExpenses = allIntExpenses.filter(i => new Date(i.date).getFullYear() === year);

    const totalIn  = incomes.reduce((s, i) => s + i.amount, 0)
                   + intIncomes.reduce((s, i) => s + i.amount, 0);
    const totalOut = expenses.reduce((s, i) => s + i.amount, 0)
                   + intExpenses.reduce((s, i) => s + i.amount, 0);
    const occupied = props.filter(p => p.status === 'terisi').length;

    document.getElementById('rep-income').textContent = fmt(totalIn);
    document.getElementById('rep-expense').textContent = fmt(totalOut);
    document.getElementById('rep-profit').textContent = fmt(totalIn - totalOut);
    document.getElementById('rep-profit').style.color = totalIn >= totalOut ? 'var(--green)' : 'var(--red)';
    document.getElementById('rep-occupancy').textContent = props.length ? Math.round(occupied / props.length * 100) + '%' : '0%';

    const labels = fullMonth.map(m => m.substring(0, 3));
    const dataIn = Array(12).fill(0);
    const dataOut = Array(12).fill(0);
    incomes.forEach(i => { dataIn[new Date(i.date).getMonth()] += i.amount; });
    expenses.forEach(i => { dataOut[new Date(i.date).getMonth()] += i.amount; });
    intIncomes.forEach(i => { dataIn[new Date(i.date).getMonth()] += i.amount; });
    intExpenses.forEach(i => { dataOut[new Date(i.date).getMonth()] += i.amount; });

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

    const table = document.getElementById('reportPropertyTable');
    if (props.length === 0) {
      table.innerHTML = '<div class="empty-state"><div class="empty-state-title">Belum ada properti</div></div>';
      return;
    }
    table.innerHTML = '<div class="report-prop-table">' + props.map(p => {
      const pIn = incomes.filter(i => i.propertyId._id === p._id).reduce((s, i) => s + i.amount, 0);
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

    document.getElementById('reportYear').addEventListener('change', renderReports);
  }

  populatePropertySelects();
  ['incomeDate', 'expenseDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

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