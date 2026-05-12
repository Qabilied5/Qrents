# 🚀 Quick Start Guide - MongoDB + API

## Langkah-Langkah Setup (5 menit)

### ✅ Step 1: Copy Connection String MongoDB
```
Login ke cloud.mongodb.com 
→ Connect 
→ Copy connection string
```

### ✅ Step 2: Update .env di Backend
File: `backend/.env`
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rumahs?retryWrites=true&w=majority
```

### ✅ Step 3: Install & Run Backend
```bash
cd backend
npm install
npm start
```
Tunggu sampai muncul: `✓ Server running on http://localhost:5000`

### ✅ Step 4: Update Frontend Script
File: `index.html` (ganti script terakhir)
```html
<!-- DARI: -->
<script src="loginHandler.js"></script>
<script src="app.js"></script>

<!-- KE: -->
<script src="loginHandler-api.js"></script>
<script src="app-api.js"></script>
```

### ✅ Step 5: Jalankan Frontend
Buka `index.html` di browser (atau gunakan Live Server)

---

## 🧪 Test

1. **Register akun baru**
   - Klik "Buat akun"
   - Isi form → Daftar

2. **Login**
   - Username & Password → Masuk

3. **Cek Data di MongoDB**
   - Cloud.mongodb.com
   - Database `rumahs` → lihat collections

---

## ⚡ Struktur Folder

```
Qrents/
├── index.html              ← Frontend
├── style.css
├── loginHandler.js         ← Lama (gunakan jika ingin)
├── app.js                  ← Lama (gunakan jika ingin)
├── loginHandler-api.js     ← ✨ Baru (gunakan ini)
├── app-api.js              ← ✨ Baru (gunakan ini)
├── SETUP_MONGODB.md        ← Dokumentasi lengkap
├── backend/                ← Backend API
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── README.md
```

---

## 📝 File Mana yang Digunakan?

| File | Status | Keterangan |
|------|--------|-----------|
| `loginHandler.js` | ❌ Lama | Gunakan `loginHandler-api.js` |
| `app.js` | ❌ Lama | Gunakan `app-api.js` |
| `loginHandler-api.js` | ✅ Baru | Untuk API (MongoDB) |
| `app-api.js` | ✅ Baru | Untuk API (MongoDB) |

---

## 🔄 Ketika Semuanya Sudah Berjalan

Sekarang setiap user punya data **terpisah di MongoDB**:
- User "admin" → data admin
- User "budi" → data budi (berbeda)
- Logout → login user lain → data berbeda

---

## ❓ Jika Ada Error

**Error: "Cannot POST /api/auth/login"**
→ Backend belum running (`npm start` di folder backend)

**Error: "MongoDB connection failed"**
→ Connection string salah atau internet putus

**Error: "fetch is not a function"**
→ Browser terlalu lama, refresh F5

---

## 📖 Dokumentasi Lengkap
Baca: `SETUP_MONGODB.md` untuk setup detail
Baca: `backend/README.md` untuk API docs
