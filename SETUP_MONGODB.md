# Setup MongoDB Atlas + Backend API

## 📋 Prerequisites
- Node.js terinstall ([nodejs.org](https://nodejs.org))
- Akun MongoDB Atlas sudah dibuat
- Cluster database sudah dibuat

---

## 🔧 Step 1: Setup MongoDB Atlas Connection String

1. Login ke [MongoDB Atlas](https://cloud.mongodb.com)
2. Pilih cluster Anda → klik **Connect**
3. Pilih **Drivers** → pilih **Node.js**
4. Copy connection string yang muncul, contoh:
   ```
   mongodb+srv://username:password@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```

---

## 🚀 Step 2: Setup Backend

### Install Dependencies
Buka PowerShell/Terminal di folder `backend`:
```bash
cd backend
npm install
```

### Setup .env File
Edit file `backend/.env`:
```
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster0.abc123.mongodb.net/rumahs?retryWrites=true&w=majority
JWT_SECRET=your_secret_key_here_ganti_dengan_random_string
```

> Ganti `username`, `password`, dan `cluster` dengan milik Anda

### Test Connection & Start Server
```bash
npm start
```

Jika sukses, Anda akan melihat:
```
✓ MongoDB connected
✓ Server running on http://localhost:5000
```

---

## 🌐 Step 3: Update Frontend untuk Menggunakan API

### Option A: Ganti script di index.html (Recommended)
Di file `index.html`, ganti baris terakhir:
```html
<script src="loginHandler.js"></script>
<script src="app.js"></script>
```

Menjadi:
```html
<script src="loginHandler-api.js"></script>
<script src="app-api.js"></script>
```

### Option B: Ganti nama file
```bash
# Backup file lama
mv loginHandler.js loginHandler-old.js
mv app.js app-old.js

# Ganti dengan versi API
mv loginHandler-api.js loginHandler.js
mv app-api.js app.js
```

---

## ✅ Testing

### 1. Jalankan Backend
```bash
cd backend
npm start
```

### 2. Buka Frontend
Buka `index.html` di browser atau dengan live server

### 3. Test Register & Login
- Klik "Buat akun"
- Isi: Nama, Username, Password
- Daftar
- Login dengan akun baru

### 4. Lihat Data di MongoDB
Login ke MongoDB Atlas:
1. Klik cluster → Collections
2. Lihat database `rumahs`
3. Collections: `users`, `properties`, `tenants`, `income`, `expenses`

---

## 🐛 Troubleshooting

### Error: "connect ECONNREFUSED"
Backend tidak berjalan. Cek:
- Backend sudah di-start dengan `npm start`?
- Port 5000 sudah dipakai program lain?

### Error: "ENOTFOUND mongodb+srv"
Connection string salah. Cek:
- Username/password benar?
- Internet connection OK?
- Whitelist IP di MongoDB Atlas?

### Data tidak muncul
- Cek Console (F12) untuk error messages
- Pastikan sudah login
- Refresh halaman

---

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
Semua request (kecuali /auth/register dan /auth/login) memerlukan header:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Endpoints

#### Auth
- `POST /auth/register` - Daftar
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user

#### Properties
- `GET /properties` - Ambil semua
- `POST /properties` - Buat baru
- `PUT /properties/:id` - Update
- `DELETE /properties/:id` - Hapus

#### Tenants
- `GET /tenants` - Ambil semua
- `POST /tenants` - Buat baru
- `PUT /tenants/:id` - Update
- `DELETE /tenants/:id` - Hapus

#### Income
- `GET /income` - Ambil semua
- `POST /income` - Catat baru
- `PUT /income/:id` - Update
- `DELETE /income/:id` - Hapus

#### Expenses
- `GET /expenses` - Ambil semua
- `POST /expenses` - Catat baru
- `PUT /expenses/:id` - Update
- `DELETE /expenses/:id` - Hapus

---

## 🎯 Next Steps

Setelah setup berhasil, Anda bisa:
- ✅ Deploy backend ke Render, Railway, atau Heroku
- ✅ Deploy frontend ke Vercel, Netlify, atau GitHub Pages
- ✅ Tambah fitur backup data
- ✅ Tambah email notifications

---

## 📞 Support
Jika ada error:
1. Cek console browser (F12 → Console)
2. Cek terminal backend
3. Lihat file `backend/README.md` untuk info lebih detail
