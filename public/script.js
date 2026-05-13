// public/script.js
// Is file ka pura purana code delete karke ye code paste karo.

async function showJobs(category) {
  const jobsContainer = document.getElementById('jobs-container');

  jobsContainer.innerHTML = `
    <div style="
      max-width: 1100px;
      margin: 20px auto;
      color: white;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
    ">
      Loading jobs...
    </div>
  `;

  try {
    const response = await fetch('/api/jobs');
    const jobs = await response.json();

    // Filter by company field (Government / Corporate)
    const filteredJobs = jobs.filter(
      (job) =>
        job.company &&
        job.company.toLowerCase() === category.toLowerCase()
    );

    if (filteredJobs.length === 0) {
      jobsContainer.innerHTML = `
        <div style="
          max-width: 900px;
          margin: 20px auto;
          background: white;
          padding: 30px;
          border-radius: 20px;
          text-align: center;
          font-size: 22px;
          font-weight: bold;
        ">
          No ${category} Jobs Available
        </div>
      `;
      return;
    }

    let html = `
      <div style="
        max-width: 1100px;
        margin: auto;
      ">
        <h2 style="
          color: white;
          text-align: center;
          margin-bottom: 30px;
          font-size: 38px;
        ">
          ${category} Jobs
        </h2>
    `;

    filteredJobs.forEach((job) => {
      html += `
        <div style="
          background: rgba(255,255,255,0.95);
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 25px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        ">
          <h3 style="
            margin-top: 0;
            font-size: 28px;
            color: #1d4ed8;
          ">
            ${job.title}
          </h3>

          <p><strong>Company:</strong> ${job.company}</p>
          <p><strong>Location:</strong> ${job.location || ''}</p>
          <p><strong>Description:</strong><br>${job.description || ''}</p>

          <a href="apply.html?job_id=${job.id}" style="
            display: inline-block;
            margin-top: 15px;
            padding: 12px 24px;
            background: #1d4ed8;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
          ">
            Apply Now
          </a>
        </div>
      `;
    });

    html += `</div>`;
    jobsContainer.innerHTML = html;

    // Scroll to jobs section
    jobsContainer.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error(error);
    jobsContainer.innerHTML = `
      <div style="
        max-width: 900px;
        margin: 20px auto;
        background: white;
        padding: 30px;
        border-radius: 20px;
        text-align: center;
        font-size: 22px;
        font-weight: bold;
        color: red;
      ">
        Error loading jobs.
      </div>
    `;
  }
}