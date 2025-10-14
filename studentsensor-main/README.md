<h2>🚀 Try It Out</h2>
<p>
You can use the live version of this tool right now at:<br>
<a href="https://studentratingsdashboard-backend.onrender.com" target="_blank">
https://studentratingsdashboard-backend.onrender.com
</a>
</p>
<p>Just upload a BYU student ratings CSV and the tool will categorize and summarize the comments for you.</p>

<hr>

<h2>🛠 Want to Set Up Your Own Version?</h2>
<p>If you'd like to clone and run your own version of the app (e.g., for development, customization, or hosting), you'll need to set up the following services from scratch:</p>
<ul>
  <li>⚙️ A web app host like <strong>Render</strong></li>
  <li>📂 A PostgreSQL database using <strong>NeonDB</strong></li>
  <li>🔐 A Google OAuth 2.0 project for authentication</li>
</ul>

<h3>📦 Local Setup Instructions</h3>
<ol>
  <li>Clone the repo:
    <pre><code>git clone https://github.com/yourusername/studentratingsdashboard.git</code></pre>
  </li>
  <li>Navigate into the directory:
    <pre><code>cd studentratingsdashboard</code></pre>
  </li>
  <li>Install Node.js dependencies:
    <pre><code>npm install</code></pre>
  </li>
  <li>Create and activate a Python virtual environment:</li>
  <li><strong>Windows:</strong>
    <pre><code>python -m venv venv
venv\Scripts\activate</code></pre>
  </li>
  <li><strong>macOS/Linux:</strong>
    <pre><code>python3 -m venv venv
source venv/bin/activate</code></pre>
  </li>
  <li>Install Python dependencies:
    <pre><code>pip install -r requirements.txt</code></pre>
  </li>
  <li>Create a <code>.env</code> file in the <code>studentsensor-main</code> directory (see example below).</li>
  <li>Start the backend locally:
    <pre><code>node studentsensor.mjs</code></pre>
  </li>
</ol>

<h3>🔑 Set Up Google OAuth</h3>
<ol>
  <li>Go to <a href="https://console.cloud.google.com/auth/overview/create" target="_blank">Google Cloud Console</a> and create a new project.</li>
  <li>Enable the “OAuth 2.0 Client ID” under <strong>APIs & Services</strong>.</li>
  <li>Go to <strong>Credentials</strong> > <strong>Create Credentials</strong> > <strong>OAuth client ID</strong>.</li>
  <li>Select <strong>Web Application</strong> and configure:</li>
  <li><strong>Authorized JavaScript origins:</strong>
    <pre><code>http://localhost:3000
https://studentratingsdashboard-backend.onrender.com</code></pre>
  </li>
  <li><strong>Authorized redirect URIs:</strong>
    <pre><code>http://localhost:3000/auth/google/callback
https://studentratingsdashboard-backend.onrender.com/auth/google</code></pre>
  </li>
</ol>

<h3>🌐 Set Up a NeonDB PostgreSQL Database</h3>
<ol>
  <li>Go to <a href="https://neon.tech" target="_blank">https://neon.tech</a> and create an account.</li>
  <li>Create a new project and database.</li>
  <li>Copy the connection string:
    <pre><code>postgresql://username:password@hostname/dbname</code></pre>
  </li>
  <li>Use this as your <code>DATABASE_URL</code> environment variable.</li>
</ol>

<h3>🚀 Deploy on Render</h3>
<ol>
  <li>Go to <a href="https://render.com" target="_blank">Render.com</a> and create a new Web Service.</li>
  <li>Connect your GitHub repository.</li>
  <li>Set environment variables:
    <pre><code>APP_PORT
SESSION_SECRET
APP_CONFIG_KEYFILE
APP_CONFIG_CERTFILE
APP_URL
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_TEMPERATURE
OPENAI_MAX_TOKENS
GOOGLE_CALLBACK_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PW
DB_SSL</code></pre>

  </li>
  <li>Use this start command:
    <pre><code>node studentsensor.mjs</code></pre>
  </li>
</ol>

