const API_URL = 'http://localhost:5000/api';
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

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Registrasi gagal', 'error');
      return;
    }

    showToast('Akun berhasil dibuat. Silakan login.');
    document.getElementById('registerForm').reset();
    showLoginForm();
    document.getElementById('loginUsername').value = username;
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
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
