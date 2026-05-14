async function showJobs(category) {

const jobsContainer = document.getElementById('jobs-container');

jobsContainer.innerHTML = `
<div style="
max-width:1100px;
margin:auto;
text-align:center;
color:white;
font-size:30px;
font-weight:bold;
">
Loading Jobs...
</div>
`;

try {

const response = await fetch('/api/jobs');

const jobs = await response.json();

const filteredJobs = jobs.filter(job => {

if(category === 'Government'){
return job.job_type === 'government';
}

return job.job_type === 'corporate';

});

if(filteredJobs.length === 0){

jobsContainer.innerHTML = `
<div style="
background:white;
padding:30px;
border-radius:20px;
max-width:900px;
margin:auto;
text-align:center;
font-size:24px;
font-weight:bold;
">
No ${category} Jobs Available
</div>
`;

return;

}

let html = `
<div style="
max-width:1100px;
margin:auto;
">
`;

filteredJobs.forEach(job => {

if(job.job_type === 'government'){

html += `

<div style="
background:white;
padding:30px;
border-radius:20px;
margin-bottom:30px;
box-shadow:0 10px 30px rgba(0,0,0,0.15);
">

<h2 style="
margin-top:0;
color:#1d4ed8;
font-size:32px;
">
🏛 ${job.title}
</h2>

<p><strong>Department:</strong> ${job.company || ''}</p>

<p><strong>Location:</strong> ${job.location || ''}</p>

<p><strong>Apply Start:</strong> ${job.apply_start_date || ''}</p>

<p><strong>Last Date:</strong> ${job.apply_end_date || ''}</p>

<p><strong>Age Limit:</strong>
${job.min_age || ''} - ${job.max_age || ''}
</p>

<p><strong>Total Posts:</strong> ${job.total_posts || ''}</p>

<p><strong>Application Fee:</strong> ${job.application_fee || ''}</p>

<p><strong>Qualification:</strong><br>
${job.qualification || ''}
</p>

${job.general_posts || job.obc_posts || job.sc_posts || job.st_posts || job.ews_posts ? `
<h3>Category Wise Vacancy</h3>

<ul>
<li>General: ${job.general_posts || 0}</li>
<li>OBC: ${job.obc_posts || 0}</li>
<li>SC: ${job.sc_posts || 0}</li>
<li>ST: ${job.st_posts || 0}</li>
<li>EWS: ${job.ews_posts || 0}</li>
</ul>
` : ''}

${job.male_posts || job.female_posts || job.other_posts ? `
<h3>Gender Wise Vacancy</h3>

<ul>
<li>Male: ${job.male_posts || 0}</li>
<li>Female: ${job.female_posts || 0}</li>
<li>Other: ${job.other_posts || 0}</li>
</ul>
` : ''}

${job.physical_details ? `
<h3>Physical Eligibility</h3>
<p>${job.physical_details}</p>
` : ''}

${job.selection_process ? `
<h3>Selection Process</h3>
<p>${job.selection_process}</p>
` : ''}

<p>
<strong>Description:</strong><br>
${job.description || ''}
</p>

<a href="apply.html?job_id=${job.id}" style="
display:inline-block;
padding:14px 24px;
background:#2563eb;
color:white;
text-decoration:none;
border-radius:10px;
font-weight:bold;
margin-top:15px;
">
Apply Now
</a>

</div>
`;

}else{

html += `

<div style="
background:rgba(255,255,255,0.95);
border-radius:20px;
padding:30px;
margin-bottom:25px;
box-shadow:0 10px 30px rgba(0,0,0,0.15);
">

<h3 style="
margin-top:0;
font-size:28px;
color:#1d4ed8;
">
${job.title}
</h3>

<p><strong>Company:</strong> ${job.company || ''}</p>

<p><strong>Location:</strong> ${job.location || ''}</p>

<p><strong>Description:</strong><br>
${job.description || ''}
</p>

<a href="apply.html?job_id=${job.id}" style="
display:inline-block;
margin-top:15px;
padding:12px 24px;
background:#1d4ed8;
color:white;
text-decoration:none;
border-radius:10px;
font-weight:bold;
">
Apply Now
</a>

</div>
`;

}

});

html += `</div>`;

jobsContainer.innerHTML = html;

jobsContainer.scrollIntoView({
behavior:'smooth'
});

}catch(error){

console.log(error);

jobsContainer.innerHTML = `
<div style="
background:white;
padding:30px;
border-radius:20px;
max-width:900px;
margin:auto;
text-align:center;
font-size:24px;
font-weight:bold;
color:red;
">
Error loading jobs
</div>
`;

}

}