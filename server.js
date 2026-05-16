# server.js (Full Working Code)

```javascript
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

// ================= ADS.TXT =================
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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ================= MYSQL CONNECTION =================
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
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

// ================= ADMIN AUTH =================
function isAdmin(req, res, next) {
  if (req.session.admin) {
    return next();
  }
  return res.redirect('/admin-login.html');
}

// ================= HOME =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= ADMIN LOGIN =================
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === adminUsername && password === adminPassword) {
    req.session.admin = true;
    return res.redirect('/admin-dashboard.html');
  }

  res.send(`
    <script>
      alert('Invalid Username or Password');
      window.location.href='/admin-login.html';
    </script>
  `);
});

// ================= ADMIN LOGOUT =================
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login.html');
  });
});

// ================= ADD JOB =================
app.post('/admin/add-job', isAdmin, (req, res) => {
  const { title, company, location, description } = req.body;

  const sql = `
    INSERT INTO jobs (title, company, location, description)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [title, company, location, description], (err) => {
    if (err) {
      console.error('Error adding job:', err);
      return res.status(500).send('Error adding job');
    }

    res.send(`
      <script>
        alert('Job Posted Successfully');
        window.location.href='/admin-dashboard.html';
      </script>
    `);
  });
});

// ================= GET JOBS =================
app.get('/api/jobs', (req, res) => {
  db.query('SELECT * FROM jobs ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('Error fetching jobs:', err);
      return res.status(500).json([]);
    }

    res.json(results);
  });
});

// ================= APPLY JOB =================
app.post(
  '/apply',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 },
    { name: 'pan_card', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const {
        job_id,
        full_name,
        mobile,
        age,
        dob,
        gender,
        marital_status,
        permanent_address,
        current_address,
      } = req.body;

      const photo = req.files?.photo?.[0]?.path || '';
      const aadhaar = req.files?.aadhaar?.[0]?.path || '';
      const pan_card = req.files?.pan_card?.[0]?.path || '';
      const resume = req.files?.resume?.[0]?.path || '';

      const sql = `
        INSERT INTO applications (
          job_id,
          full_name,
          mobile,
          age,
          dob,
          gender,
          marital_status,
          permanent_address,
          current_address,
          photo,
          aadhaar,
          pan_card,
          resume
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          job_id,
          full_name,
          mobile,
          age,
          dob,
          gender,
          marital_status,
          permanent_address,
          current_address,
          photo,
          aadhaar,
          pan_card,
          resume,
        ],
        (err) => {
          if (err) {
            console.error('Error saving application:', err);
            return res.status(500).send('Error submitting application');
          }

          res.send(`
            <script>
              alert('Application Submitted Successfully');
              window.location.href='/';
            </script>
          `);
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).send('Upload error');
    }
  }
);

// ================= GET APPLICATIONS =================
app.get('/api/applications', isAdmin, (req, res) => {
  const sql = `
    SELECT applications.*, jobs.title AS job_title
    FROM applications
    LEFT JOIN jobs ON applications.job_id = jobs.id
    ORDER BY applications.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching applications:', err);
      return res.status(500).json([]);
    }

    res.json(results);
  });
});

// ================= HEALTH CHECK =================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

## Run Commands

```bash
node server.js
git add .
git commit -m "Fix server.js"
git push origin main
```
