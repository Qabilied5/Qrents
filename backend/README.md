# RumahSewa Pro - Backend API

Backend API untuk aplikasi manajemen properti RumahSewa Pro.

## Instalasi & Setup

### 1. Instalasi Dependencies
```bash
cd backend
npm install
```

### 2. Setup .env
Edit file `.env` dan masukkan:
```
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rumahs?retryWrites=true&w=majority
JWT_SECRET=your_secret_key_change_this
```

**Cara mendapat MONGODB_URI:**
1. Login ke [MongoDB Atlas](https://cloud.mongodb.com)
2. Pilih cluster Anda → Connect
3. Pilih "Drivers" → "Node.js"
4. Copy connection string
5. Ganti `<password>` dengan password database user Anda
6. Ganti `myFirstDatabase` dengan `rumahs`

### 3. Jalankan Server
```bash
npm start
```
atau untuk development mode (auto-reload):
```bash
npm run dev
```

Server akan berjalan di `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Daftar akun baru
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get user info (memerlukan token)

### Properties
- `GET /api/properties` - Ambil semua properti
- `GET /api/properties/:id` - Ambil satu properti
- `POST /api/properties` - Buat properti baru
- `PUT /api/properties/:id` - Update properti
- `DELETE /api/properties/:id` - Hapus properti

### Tenants
- `GET /api/tenants` - Ambil semua penyewa
- `GET /api/tenants/property/:propertyId` - Ambil penyewa by properti
- `POST /api/tenants` - Buat penyewa baru
- `PUT /api/tenants/:id` - Update penyewa
- `DELETE /api/tenants/:id` - Hapus penyewa

### Income
- `GET /api/income` - Ambil semua pendapatan
- `POST /api/income` - Catat pendapatan baru
- `PUT /api/income/:id` - Update pendapatan
- `DELETE /api/income/:id` - Hapus pendapatan

### Expenses
- `GET /api/expenses` - Ambil semua pengeluaran
- `POST /api/expenses` - Catat pengeluaran baru
- `PUT /api/expenses/:id` - Update pengeluaran
- `DELETE /api/expenses/:id` - Hapus pengeluaran

## Struktur
```
backend/
├── config/
│   └── db.js              # MongoDB connection
├── models/
│   ├── User.js
│   ├── Property.js
│   ├── Tenant.js
│   ├── Income.js
│   └── Expense.js
├── routes/
│   ├── auth.js
│   ├── properties.js
│   ├── tenants.js
│   ├── income.js
│   └── expenses.js
├── middleware/
│   └── auth.js            # JWT middleware
├── .env                   # Environment variables
├── package.json
└── server.js              # Main server file
```
