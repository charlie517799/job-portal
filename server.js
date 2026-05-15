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
    secret: 'jobportal_secret_key',
    resave: false,
    saveUninitialized: false,
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
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect((err) => {

  if (err) {
    console.log('Database connection failed:', err);
  } else {

    console.log('MySQL Connected Successfully');

    // ================= JOBS TABLE =================

    const jobsTable = `
      CREATE TABLE IF NOT EXISTS jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255),
        company VARCHAR(255),
        location VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.query(jobsTable);

    // ================= APPLICATIONS TABLE =================

    const applicationsTable = `
      CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id INT,
        full_name VARCHAR(255),
        mobile VARCHAR(50),
        age VARCHAR(50),
        dob VARCHAR(100),
        gender VARCHAR(50),
        marital_status VARCHAR(50),
        permanent_address TEXT,
        current_address TEXT,
        photo TEXT,
        aadhaar TEXT,
        pan_card TEXT,
        resume TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.query(applicationsTable);

  }

});

// ================= CLOUDINARY STORAGE =================

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,

  params: async (req, file) => ({
    folder: 'job-portal',
    resource_type: 'auto',
  }),

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

// ================= HOME =================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ================= ADMIN LOGIN =================

app.post('/admin/login', (req, res) => {

  const { username, password } = req.body;

  if (
    username === (process.env.ADMIN_USERNAME || 'admin') &&
    password === (process.env.ADMIN_PASSWORD || '251122')
  ) {

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

  db.query(
    sql,
    [title, company, location, description],
    (err) => {

      if (err) {
        return res.send(err.message);
      }

      res.send(`
        <script>
          alert('Job Posted Successfully!');
          window.location.href='/admin-dashboard.html';
        </script>
      `);

    }
  );

});

// ================= GET JOBS =================

app.get('/api/jobs', (req, res) => {

  db.query(
    'SELECT * FROM jobs ORDER BY id DESC',
    (err, results) => {

      if (err) {
        return res.json([]);
      }

      res.json(results);

    }
  );

});

// ================= DELETE JOB =================

app.get('/admin/delete-job/:id', isAdmin, (req, res) => {

  const id = req.params.id;

  db.query(
    'DELETE FROM jobs WHERE id = ?',
    [id],
    (err) => {

      if (err) {

        return res.send(`
          <script>
            alert('Delete Failed');
            window.location.href='/admin-dashboard.html';
          </script>
        `);

      }

      res.send(`
        <script>
          alert('Job Deleted Successfully');
          window.location.href='/admin-dashboard.html';
        </script>
      `);

    }
  );

});

// ================= APPLY JOB =================

app.post(
  '/apply',

  (req, res, next) => {

    upload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'aadhaar', maxCount: 1 },
      { name: 'pan_card', maxCount: 1 },
      { name: 'resume', maxCount: 1 },
    ])(req, res, function (err) {

      if (err) {

        console.log('UPLOAD ERROR:', err);

        return res.send(`
          <h2>Upload Error</h2>
          <p>${err.message}</p>
        `);

      }

      next();

    });

  },

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
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

            console.log('MYSQL ERROR:', err);

            return res.send(`
              <h2>Database Error</h2>
              <p>${err.message}</p>
            `);

          }

          res.send(`
            <script>
              alert('Application Submitted Successfully!');
              window.location.href='/';
            </script>
          `);

        }
      );

    } catch (error) {

      console.log('SERVER ERROR:', error);

      res.send(`
        <h2>Server Error</h2>
        <p>${error.message}</p>
      `);

    }

  }
);

// ================= VIEW APPLICATIONS =================

app.get('/admin/applications', isAdmin, (req, res) => {

  const sql = `
    SELECT applications.*, jobs.title AS job_title
    FROM applications
    LEFT JOIN jobs ON applications.job_id = jobs.id
    ORDER BY applications.id DESC
  `;

  db.query(sql, (err, results) => {

    if (err) {
      return res.send('Error fetching applications');
    }

    res.json(results);

  });

});

// ================= DELETE APPLICATION =================

app.get('/admin/delete-application/:id', isAdmin, (req, res) => {

  const id = req.params.id;

  db.query(
    'DELETE FROM applications WHERE id = ?',
    [id],
    (err) => {

      if (err) {
        return res.send('Delete Failed');
      }

      res.send(`
        <script>
          alert('Application Deleted Successfully');
          window.location.href='/admin/applications';
        </script>
      `);

    }
  );

});

// ================= START SERVER =================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});