async function showJobs(category) {

  const jobsContainer = document.getElementById('jobs-container');

  jobsContainer.innerHTML = `
    <h2 style="color:white;text-align:center;">Loading Jobs...</h2>
  `;

  try {

    const response = await fetch('/api/jobs');
    const jobs = await response.json();

    const filteredJobs = jobs.filter(job => {

      if (!job.company) return false;

      if (category === 'Government') {
        return job.company.toLowerCase().includes('gov');
      }

      if (category === 'Corporate') {
        return !job.company.toLowerCase().includes('gov');
      }

      return true;

    });

    if (filteredJobs.length === 0) {

      jobsContainer.innerHTML = `
        <div style="
          background:white;
          padding:30px;
          border-radius:20px;
          text-align:center;
          max-width:700px;
          margin:auto;
          font-size:20px;
          font-weight:bold;
        ">
          No ${category} Jobs Found
        </div>
      `;

      return;
    }

    jobsContainer.innerHTML = filteredJobs.map(job => `

      <div style="
        background:white;
        padding:25px;
        border-radius:24px;
        margin-bottom:20px;
        box-shadow:0 10px 30px rgba(0,0,0,0.15);
      ">

        <h2>${job.title}</h2>

        <p><strong>Company:</strong> ${job.company}</p>

        <p><strong>Location:</strong> ${job.location}</p>

        <p>${job.description}</p>

        <a
          href="/apply.html?job_id=${job.id}"
          style="
            display:inline-block;
            padding:12px 20px;
            background:#2563eb;
            color:white;
            text-decoration:none;
            border-radius:12px;
            font-weight:bold;
          "
        >
          Apply Now
        </a>

      </div>

    `).join('');

  } catch (error) {

    jobsContainer.innerHTML = `
      <div style="
        background:white;
        padding:30px;
        border-radius:20px;
        text-align:center;
        max-width:700px;
        margin:auto;
        font-size:20px;
        font-weight:bold;
      ">
        Failed to Load Jobs
      </div>
    `;

    console.log(error);

  }

}