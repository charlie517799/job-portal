CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    company VARCHAR(255),
    location VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT,
    full_name VARCHAR(255),
    mobile VARCHAR(20),
    age INT,
    dob DATE,
    gender VARCHAR(50),
    marital_status VARCHAR(50),
    permanent_address TEXT,
    current_address TEXT,
    photo VARCHAR(255),
    aadhaar VARCHAR(255),
    pan_card VARCHAR(255),
    resume VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);