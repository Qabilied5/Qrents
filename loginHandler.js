const USERS_KEY = 'rs_users';
const AUTH_SESSION = 'rs_auth';
const AUTH_USER = 'rs_user';

const defaultUsers = [
  { username: 'admin', password: 'admin123', name: 'Pemilik' }
];

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function setUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function seedUsers() {
  const users = getUsers();
  if (!users || users.length === 0) {
    setUsers(defaultUsers);
  }
}

function isLoggedIn() {
  return sessionStorage.getItem(AUTH_SESSION) === 'true';
}

function getCurrentUser() {
  if (!isLoggedIn()) return null;
  return JSON.parse(sessionStorage.getItem(AUTH_USER) || 'null');
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

function loginUser(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const user = getUsers().find(u => u.username === username);

  if (!user || user.password !== password) {
    showToast('Username atau password salah', 'error');
    return;
  }

  sessionStorage.setItem(AUTH_SESSION, 'true');
  sessionStorage.setItem(AUTH_USER, JSON.stringify({ username: user.username, name: user.name }));
  const sidebarName = document.getElementById('sidebarUserName');
  if (sidebarName) sidebarName.textContent = user.name;
  document.body.classList.remove('login-screen');
  document.getElementById('loginForm').reset();
  showToast('Login berhasil');

  if (typeof initApp === 'function') {
    initApp();
  }
}

function createAccount(event) {
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

  const users = getUsers();
  if (users.find(u => u.username === username)) {
    showToast('Username sudah terdaftar.', 'error');
    return;
  }

  users.push({ username, password, name });
  setUsers(users);
  showToast('Akun berhasil dibuat. Silakan login.');
  document.getElementById('registerForm').reset();
  showLoginForm();
  document.getElementById('loginUsername').value = username;
}

function logoutUser() {
  sessionStorage.removeItem(AUTH_SESSION);
  sessionStorage.removeItem(AUTH_USER);
  document.body.classList.add('login-screen');
  navigateTo('login');
  showToast('Anda berhasil logout', 'success');
}

function fillDemoAccount() {
  document.getElementById('loginUsername').value = 'admin';
  document.getElementById('loginPassword').value = 'admin123';
}

function initLogin() {
  seedUsers();
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', loginUser);
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', createAccount);
  }
}
