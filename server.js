require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware
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

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'job_portal',
});

db.connect((err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('MySQL Connected Successfully');
});

// File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  },
});

const upload = multer({ storage });

// Admin Middleware
function isAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin-login.html');
}

// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin Login
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

// Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login.html');
  });
});

// Add Job
app.post('/admin/add-job', isAdmin, (req, res) => {
  const { title, company, location, description } = req.body;

  db.query(
    'INSERT INTO jobs (title, company, location, description) VALUES (?, ?, ?, ?)',
    [title, company, location, description],
    (err) => {
      if (err) return res.send(err.message);

      res.send(`
        <script>
          alert('Job Posted Successfully!');
          window.location.href='/admin-dashboard.html';
        </script>
      `);
    }
  );
});

// Get Jobs API
app.get('/api/jobs', (req, res) => {
  db.query('SELECT * FROM jobs ORDER BY id DESC', (err, results) => {
    if (err) return res.json([]);
    res.json(results);
  });
});

// Apply Job
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

    const photo = req.files?.photo?.[0]?.filename || null;
    const aadhaar = req.files?.aadhaar?.[0]?.filename || null;
    const pan_card = req.files?.pan_card?.[0]?.filename || null;
    const resume = req.files?.resume?.[0]?.filename || null;

    db.query(
      `INSERT INTO applications 
      (job_id, full_name, mobile, age, dob, gender, marital_status,
      permanent_address, current_address, photo, aadhaar, pan_card, resume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        if (err) return res.send(err.message);

        res.send(`
          <script>
            alert('Application Submitted Successfully!');
            window.location.href='/';
          </script>
        `);
      }
    );
  }
);

// View Applications
app.get('/admin/applications', isAdmin, (req, res) => {
  const sql = `
    SELECT applications.*, jobs.title AS job_title
    FROM applications
    LEFT JOIN jobs ON applications.job_id = jobs.id
    ORDER BY applications.id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.send('Error fetching applications');

    let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Applications</title>

<style>
body{
margin:0;
padding:20px;
font-family:Segoe UI;
background:linear-gradient(135deg,#2563eb,#0f172a);
}

.page{
max-width:1200px;
margin:auto;
}

.top-card{
background:rgba(255,255,255,0.12);
padding:30px;
border-radius:24px;
color:white;
margin-bottom:30px;
}

.application-card{
background:white;
padding:25px;
border-radius:20px;
margin-bottom:20px;
box-shadow:0 10px 30px rgba(0,0,0,0.15);
}

.file-image{
width:100%;
max-width:250px;
border-radius:12px;
}

.btn{
display:inline-block;
padding:10px 18px;
background:#2563eb;
color:white;
text-decoration:none;
border-radius:10px;
}

.empty{
background:white;
padding:30px;
border-radius:20px;
text-align:center;
}
</style>
</head>
<body>
<div class="page">

<div class="top-card">
<h1>📋 All Applications</h1>
<a href="/admin-dashboard.html" style="color:white;">← Back</a>
</div>
`;

    if (results.length === 0) {
      html += `<div class="empty">No Applications Found</div>`;
    }

    results.forEach((row) => {
      html += `
<div class="application-card">
<h2>${row.full_name}</h2>
<p><strong>Job:</strong> ${row.job_title || ''}</p>
<p><strong>Mobile:</strong> ${row.mobile}</p>
<p><strong>Age:</strong> ${row.age}</p>
<p><strong>Gender:</strong> ${row.gender}</p>
<p><strong>Permanent Address:</strong> ${row.permanent_address}</p>

<p><strong>Photo:</strong></p>
${row.photo ? `<img class="file-image" src="/uploads/${row.photo}">` : 'Not uploaded'}

<p><strong>Aadhaar:</strong></p>
${row.aadhaar ? `<img class="file-image" src="/uploads/${row.aadhaar}">` : 'Not uploaded'}

<p><strong>PAN:</strong></p>
${row.pan_card ? `<img class="file-image" src="/uploads/${row.pan_card}">` : 'Not uploaded'}

<p><strong>Resume:</strong></p>
${row.resume ? `<a class="btn" href="/uploads/${row.resume}" target="_blank">View Resume</a>` : 'Not uploaded'}
</div>
`;
    });

    html += `
</div>
</body>
</html>
`;

    res.send(html);
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});