require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3001;

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'jobportal_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'job-portal',
    resource_type:
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
        ? 'raw'
        : 'image',
    use_filename: true,
    unique_filename: true,
  }),
});

const upload = multer({ storage });

// ================= MYSQL =================
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
  } else {
    console.log('MySQL Connected Successfully');
  }
});

// ================= ADMIN MIDDLEWARE =================
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
    return req.session.save(() => {
      res.redirect('/admin-dashboard.html');
    });
  }

  res.send(
    "<script>alert('Invalid Username or Password');window.location.href='/admin-login.html';</script>"
  );
});

// ================= ADMIN LOGOUT =================
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login.html');
  });
});

// ================= DELETE JOB =================
app.get('/admin/delete-job/:id', isAdmin, (req, res) => {
  const jobId = req.params.id;

  // First delete all applications for this job
  db.query(
    'DELETE FROM applications WHERE job_id = ?',
    [jobId],
    (err) => {
      if (err) {
        console.error('Error deleting applications:', err);
        return res.status(500).send('Error deleting applications');
      }

      // Then delete the job
      db.query('DELETE FROM jobs WHERE id = ?', [jobId], (err2) => {
        if (err2) {
          console.error('Error deleting job:', err2);
          return res.status(500).send('Error deleting job');
        }

        res.send(
          "<script>alert('Job Deleted Successfully');window.location.href='/admin-dashboard.html';</script>"
        );
      });
    }
  );
});

// ================= ADD JOB =================
app.post('/admin/add-job', isAdmin, (req, res) => {
  const { title, company, location, description } = req.body;

  const sql =
    'INSERT INTO jobs (title, company, location, description) VALUES (?, ?, ?, ?)';

  db.query(sql, [title, company, location, description], (err) => {
    if (err) {
      console.error('Error adding job:', err);
      return res.status(500).send('Error adding job');
    }

    res.send(
      "<script>alert('Job Posted Successfully');window.location.href='/admin-dashboard.html';</script>"
    );
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

    const values = [
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
    ];

    db.query(sql, values, (err) => {
      if (err) {
        console.error('Error submitting application:', err);
        return res.status(500).send('Error submitting application');
      }

      res.send(
        "<script>alert('Application Submitted Successfully');window.location.href='/';</script>"
      );
    });
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

// ================= HEALTH =================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});