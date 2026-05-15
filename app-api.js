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

    const incomes = await API.get('/income');
    const expenses = await API.get('/expenses');
    const props = await API.get('/properties');

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
    const incomes = (await API.get('/income')).filter(i => new Date(i.date).getFullYear() === year);
    const expenses = (await API.get('/expenses')).filter(i => new Date(i.date).getFullYear() === year);
    const props = await API.get('/properties');

    const totalIn = incomes.reduce((s, i) => s + i.amount, 0);
    const totalOut = expenses.reduce((s, i) => s + i.amount, 0);
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