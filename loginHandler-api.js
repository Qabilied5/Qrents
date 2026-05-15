// const API_URL = 'http://localhost:5000/api';
const API_URL = '/api';

// ===== CAPTCHA & RATE LIMIT CONFIG =====
const REG_COOLDOWN_MS = 180 * 60 * 1000; // 60 menit
const REG_MAX_ATTEMPTS = 3;
let _captchaAnswer = null;

function generateCaptcha() {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 10;
    b = Math.floor(Math.random() * 10) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    answer = a * b;
  }
  _captchaAnswer = answer;
  const captchaText = document.getElementById('captchaText');
  const captchaInput = document.getElementById('captchaAnswer');
  const captchaError = document.getElementById('captchaError');
  if (captchaText) captchaText.textContent = `${a} ${op} ${b} = ?`;
  if (captchaInput) captchaInput.value = '';
  if (captchaError) captchaError.style.display = 'none';
}

function checkRegCooldown() {
  const lastReg = parseInt(localStorage.getItem('lastRegTime') || '0');
  const remaining = REG_COOLDOWN_MS - (Date.now() - lastReg);
  if (remaining > 0) return remaining; // masih cooldown, return ms tersisa

  const dayMs = 24 * 60 * 60 * 1000;
  const regData = JSON.parse(localStorage.getItem('regAttempts') || '{"count":0,"since":0}');
  if (Date.now() - regData.since > dayMs) {
    localStorage.setItem('regAttempts', JSON.stringify({ count: 0, since: Date.now() }));
    return 0;
  }
  if (regData.count >= REG_MAX_ATTEMPTS) return -1; // blokir hari ini
  return 0;
}

function recordRegAttempt() {
  localStorage.setItem('lastRegTime', Date.now().toString());
  const dayMs = 24 * 60 * 60 * 1000;
  const regData = JSON.parse(localStorage.getItem('regAttempts') || '{"count":0,"since":0}');
  if (Date.now() - regData.since > dayMs) {
    localStorage.setItem('regAttempts', JSON.stringify({ count: 1, since: Date.now() }));
  } else {
    regData.count++;
    localStorage.setItem('regAttempts', JSON.stringify(regData));
  }
}

function updateCooldownUI() {
  const notice = document.getElementById('regCooldownNotice');
  const submitBtn = document.getElementById('regSubmitBtn');
  if (!notice || !submitBtn) return;

  const status = checkRegCooldown();
  if (status === -1) {
    notice.style.display = 'block';
    notice.textContent = `⛔ Batas pembuatan akun hari ini tercapai (${REG_MAX_ATTEMPTS}x). Coba lagi besok.`;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    return;
  }
  if (status > 0) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    const showCountdown = () => {
      const sisa = checkRegCooldown();
      if (sisa <= 0) {
        notice.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
        generateCaptcha();
        return;
      }
      const m = Math.floor(sisa / 60000);
      const s = Math.floor((sisa % 60000) / 1000);
      notice.style.display = 'block';
      notice.textContent = `⏳ Tunggu ${m}m ${s}s sebelum membuat akun lagi`;
      setTimeout(showCountdown, 1000);
    };
    showCountdown();
    return;
  }
  notice.style.display = 'none';
  submitBtn.disabled = false;
  submitBtn.style.opacity = '';
}
// ===== END CAPTCHA & RATE LIMIT =====

let authToken = localStorage.getItem('authToken');

function getAuthHeader() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function isLoggedIn() {
  return !!authToken;
}

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

function openLoginScreen() {
  document.body.classList.add('login-screen');
  showLoginForm();
  navigateTo('login');
}

function showRegisterForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
  generateCaptcha();
  updateCooldownUI();
}

function showLoginForm() {
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

async function loginUser(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Login gagal', 'error');
      return;
    }

    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(data.user));

    document.body.classList.remove('login-screen');
    document.getElementById('loginForm').reset();
    showToast('Login berhasil');

    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName) sidebarName.textContent = data.user.name;

    if (typeof initApp === 'function') {
      initApp();
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function createAccount(event) {
  event.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regPasswordConfirm').value;

  if (!name || !username || !password || !confirmPassword) {
    showToast('Lengkapi semua kolom pendaftaran.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Password dan konfirmasi tidak cocok.', 'error');
    return;
  }

  // --- Cek rate limit ---
  const cooldownStatus = checkRegCooldown();
  if (cooldownStatus === -1) {
    showToast(`Batas pembuatan akun hari ini tercapai. Coba lagi besok.`, 'error');
    return;
  }
  if (cooldownStatus > 0) {
    const m = Math.floor(cooldownStatus / 60000);
    const s = Math.floor((cooldownStatus % 60000) / 1000);
    showToast(`Tunggu ${m}m ${s}s sebelum membuat akun lagi.`, 'error');
    return;
  }

  // --- Validasi CAPTCHA ---
  const userAnswer = parseInt(document.getElementById('captchaAnswer').value);
  const captchaError = document.getElementById('captchaError');
  if (isNaN(userAnswer) || userAnswer !== _captchaAnswer) {
    if (captchaError) captchaError.style.display = 'block';
    generateCaptcha(); // generate soal baru setelah gagal
    showToast('Jawaban verifikasi salah.', 'error');
    return;
  }
  if (captchaError) captchaError.style.display = 'none';

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Registrasi gagal', 'error');
      generateCaptcha(); // refresh CAPTCHA jika server tolak
      return;
    }

    // Catat attempt hanya jika server sukses
    recordRegAttempt();

    showToast('Akun berhasil dibuat. Silakan login.');
    document.getElementById('registerForm').reset();
    showLoginForm();
    document.getElementById('loginUsername').value = username;
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
    generateCaptcha();
  }
}

function logoutUser() {
  authToken = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  document.body.classList.add('login-screen');
  navigateTo('login');
  showToast('Anda berhasil logout', 'success');
}

function fillDemoAccount() {
  document.getElementById('loginUsername').value = 'admin';
  document.getElementById('loginPassword').value = 'admin123';
}

function initLogin() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', loginUser);
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', createAccount);
  }
}