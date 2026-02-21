import dotenv from "dotenv";
dotenv.config(); // Load .env

import express from "express";
import session from "express-session";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { GoogleAuthRouter } from "./custom_node_modules/googleAuth.mjs";
import { ReportRouter } from "./custom_node_modules/report.mjs";
import { CommentRouter } from "./custom_node_modules/comment.mjs";

import { db, checkPythonDependencies } from "./custom_node_modules/db.mjs"; // no startServer imported here
import { securityHeaders, rateLimit } from "./custom_node_modules/security.mjs";

import pg from "pg";
import connectPgSimple from "connect-pg-simple";

const isProd = process.env.NODE_ENV === "production";

// Validate critical environment variables in production
if (isProd) {
  const requiredEnvVars = [
    "SESSION_SECRET",
    "DB_HOST",
    "DB_NAME",
    "DB_USER",
    "DB_PW",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ];
  
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

// Determine __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
global.__basedir = __dirname;

console.log("🚀 Starting StudentSensor backend...");

const app = express();

// Render / proxy-friendly settings
app.set("trust proxy", 1);

// Postgres session store
const PgSession = connectPgSimple(session);

const pgPool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  ssl:
    process.env.DB_SSL && String(process.env.DB_SSL).toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : false,
});

// Validate session secret
if (isProd && !process.env.SESSION_SECRET) {
  console.error("❌ SESSION_SECRET must be set in production!");
  process.exit(1);
}

// Session config
app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || (isProd ? null : "development_secret"),
    resave: false,
    saveUninitialized: false,
    proxy: isProd, // ✅ helps behind Render proxy
    name: "sessionId", // Don't use default session name
    cookie: {
      secure: isProd, // ✅ false on localhost, true on Render
      sameSite: "lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Security headers middleware (apply to all routes)
app.use(securityHeaders);

// Rate limiting (stricter for API endpoints)
app.use("/report/upload", rateLimit(10, 15 * 60 * 1000)); // 10 uploads per 15 minutes
app.use("/report", rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
app.use("/comment", rateLimit(200, 15 * 60 * 1000)); // 200 requests per 15 minutes

// Middleware
app.use(express.static(resolve(__dirname, "public")));
app.use(express.json({ limit: "10mb" })); // Reduced from 100mb for security
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routers
console.log("🔗 Registering routers...");
app.use("/auth/google", GoogleAuthRouter);
app.use("/report", ReportRouter);
app.use("/comment", CommentRouter);

// Expose safe env vars to frontend (only non-secret)
app.get("/env", (req, res) => {
  res.json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  });
});

// Homepage
app.get("/", (req, res) => {
  console.log("🌐 Request from:", req.hostname);
  if (req.hostname === "studentsensor.org") {
    return res.redirect("https://studentsensor.byu.edu");
  }
  res.redirect(req.session.user ? "/report/list" : "/login");
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(resolve(__dirname, "public/pages/login.html"));
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(resolve(__dirname, "public/pages/404.html"));
});

// Start server AFTER checking dependencies
const PORT = process.env.PORT || process.env.APP_PORT || 3000;

async function init() {
  try {
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error("❌ Database connection failed. Server will not start.");
      process.exit(1);
    }
    await checkPythonDependencies();
    console.log("✅ All dependencies confirmed. Starting server...");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed dependency check:", error);
    process.exit(1);
  }
}

init();
