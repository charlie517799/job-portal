require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ================= ADS.TXT FIX (TOP PE RAKH) =================
app.get('/ads.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('google.com, pub-4484833601433628, DIRECT, f08c47fec0942fa0');
});

// ================= CLOUDINARY =================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= UPLOADS FOLDER =================

const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// ================= MIDDLEWARE =================

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'jobportal_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ⭐ STATIC FIX (IMPORTANT)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ================= MYSQL CONNECTION =================

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect((err) => {
  if (err) {
    console.log('Database connection failed:', err);
    return;
  }

  console.log('MySQL Connected Successfully');
});

// ================= CLOUDINARY STORAGE =================

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');

    return {
      folder: 'job-portal',
      resource_type: isPdf ? 'raw' : 'image',
      use_filename: true,
      unique_filename: true,
    };
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ================= ADMIN MIDDLEWARE =================

function isAdmin(req, res, next) {
  if (req.session.admin) {
    return next();
  }
  res.redirect('/admin-login.html');
}

// ================= ROUTES =================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// बाकी tera sab code SAME rehne de (jobs, apply, admin, etc.)

// ================= START SERVER =================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});