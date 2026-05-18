
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
      maxAge: 24 * 60 * 60 * 1000,
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

// ================= AUTO FIX DATABASE =================

function ensureJobsTableColumns() {
  const queries = [
    `ALTER TABLE jobs ADD COLUMN category VARCHAR(100) DEFAULT 'Government'`,
    `ALTER TABLE jobs ADD COLUMN salary VARCHAR(100)`,
    `ALTER TABLE jobs ADD COLUMN apply_link TEXT`,
  ];

  queries.forEach((sql) => {
    db.query(sql, (err) => {
      if (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('Column already exists:', err.sqlMessage);
        } else {
          console.error('Migration error:', err.sqlMessage);
        }
      } else {
        console.log('Column added successfully');
      }
    });
  });
}

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('MySQL Connected Successfully');
    ensureJobsTableColumns();
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
  const {
    category,
    title,
    company,
    location,
    salary,
    description,
    apply_link,
  } = req.body;

  if (!title || !company || !location) {
    return res.send(`
      <script>
        alert('Title, Company and Location are required');
        window.history.back();
      </script>
    `);
  }

  const sql = `
    INSERT INTO jobs
    (
      category,
      title,
      company,
      location,
      salary,
      description,
      apply_link
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    category || 'Government',
    title,
    company,
    location,
    salary || '',
    description || '',
    apply_link || '',
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error('Error adding job:', err);
      return res.send(`
        <script>
          alert('Error adding job: ${err.sqlMessage || 'Unknown error'}');
          window.history.back();
        </script>
      `);
    }

    res.send(`
      <script>
        alert('Job Posted Successfully');
        window.location.href='/admin-dashboard.html';
      </script>
    `);
  });
});

// ================= API JOBS =================

app.get('/api/jobs', (req, res) => {
  db.query('SELECT * FROM jobs ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

app.get('/api/jobs/government', (req, res) => {
  db.query(
    "SELECT * FROM jobs WHERE category='Government' ORDER BY id DESC",
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
});

app.get('/api/jobs/corporate', (req, res) => {
  db.query(
    "SELECT * FROM jobs WHERE category='Corporate' ORDER BY id DESC",
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
});

app.get('/api/admin/jobs', isAdmin, (req, res) => {
  db.query('SELECT * FROM jobs ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

// ================= DELETE JOB =================

app.get('/admin/delete-job/:id', isAdmin, (req, res) => {
  const jobId = req.params.id;

  db.query('DELETE FROM applications WHERE job_id = ?', [jobId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error deleting applications');
    }

    db.query('DELETE FROM jobs WHERE id = ?', [jobId], (err2) => {
      if (err2) {
        console.error(err2);
        return res.status(500).send('Error deleting job');
      }

      res.send(`
        <script>
          alert('Job Deleted Successfully');
          window.location.href='/admin-dashboard.html';
        </script>
      `);
    });
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
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        console.error(err);
        return res.send(`
          <script>
            alert('Error submitting application');
            window.history.back();
          </script>
        `);
      }

      res.send(`
        <script>
          alert('Application Submitted Successfully');
          window.location.href='/';
        </script>
      `);
    });
  }
);

// ================= APPLICATIONS =================

app.get('/api/applications', isAdmin, (req, res) => {
  const sql = `
    SELECT applications.*, jobs.title AS job_title
    FROM applications
    LEFT JOIN jobs ON applications.job_id = jobs.id
    ORDER BY applications.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

app.delete('/api/applications/:id', isAdmin, (req, res) => {
  db.query(
    'DELETE FROM applications WHERE id = ?',
    [req.params.id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: 'Delete failed' });
      }
      res.json({ message: 'Application deleted successfully' });
    }
  );
});

// ================= DASHBOARD STATS =================

app.get('/api/dashboard-stats', isAdmin, (req, res) => {
  db.query('SELECT COUNT(*) AS totalJobs FROM jobs', (err, jobsResult) => {
    if (err) {
      return res.status(500).json({ error: 'Jobs count failed' });
    }

    db.query(
      'SELECT COUNT(*) AS totalApplications FROM applications',
      (err2, applicationsResult) => {
        if (err2) {
          return res
            .status(500)
            .json({ error: 'Applications count failed' });
        }

        res.json({
          totalJobs: jobsResult[0].totalJobs,
          totalApplications: applicationsResult[0].totalApplications,
          systemStatus: '100%',
        });
      }
    );
  });
});

// ================= HEALTH CHECK =================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running successfully',
  });
});

// ================= START SERVER =================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

# ✅ Deploy Commands

Run these commands in PowerShell:

```powershell
git add .
git commit -m "Complete working server.js"
git push
```

---

# ✅ Render Deploy

1. Open Render dashboard.
2. Open `job-portal` service.
3. Click **Manual Deploy**.
4. Click **Deploy Latest Commit**.

---

# ✅ Test Links

* Website: [https://job-portal-mdfk.onrender.com/](https://job-portal-mdfk.onrender.com/)
* Admin Login: [https://job-portal-mdfk.onrender.com/admin-login.html](https://job-portal-mdfk.onrender.com/admin-login.html)
* Admin Dashboard: [https://job-portal-mdfk.onrender.com/admin-dashboard.html](https://job-portal-mdfk.onrender.com/admin-dashboard.html)

---

# ✅ Expected Result

After deployment:

* Admin login works.
* Job posting works.
* Government and Corporate categories work.
* Applications submit successfully.
* Dashboard stats work.
* Missing database columns are created automatically.
