import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import winston from "winston";

// .env must be loaded BEFORE the log directory is resolved; module imports
// are hoisted in ESM, so relying on app.js's dotenv.config() is too late.
// dotenv.config() is idempotent - existing variables are never overridden.
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Centralized logging for SureCRM.
 *
 * Streams (all inside the resolved log directory):
 *   crm.log    - CRM subsystem: HTTP access, DB, mail, controllers
 *   pbx.log    - PBX subsystem: FreePBX / AMI integration
 *   error.log  - every entry of level >= "error" from any subsystem
 *
 * The directory defaults to /var/log/surecrm (override with LOG_DIR). When
 * it cannot be created or written (e.g. developer machines without root)
 * the logger transparently falls back to <server>/logs so a permission
 * problem can never crash the application.
 *
 * Environment variables:
 *   LOG_DIR      log directory            (default /var/log/surecrm)
 *   LOG_LEVEL    file/console verbosity   (default "info")
 *   LOG_CONSOLE  "false" disables console mirror (default enabled)
 *
 * Rotation: logrotate handles daily rotation on servers (see
 * scripts/setup-logdir.sh); winston's maxsize acts as an in-app safety net
 * between rotations.
 */

const DEFAULT_LOG_DIR = "/var/log/surecrm";
const FALLBACK_LOG_DIR = path.resolve(__dirname, "../logs");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // per-file safeguard
const MAX_FILES = 10;

function isWritable(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve the active log directory, preferring /var/log/surecrm. */
function resolveLogDir() {
  const preferred = process.env.LOG_DIR || DEFAULT_LOG_DIR;
  try {
    fs.mkdirSync(preferred, { recursive: true });
  } catch {
    /* e.g. EACCES under /var/log without root -> probe & fall back below */
  }
  if (isWritable(preferred)) return preferred;

  try {
    fs.mkdirSync(FALLBACK_LOG_DIR, { recursive: true });
  } catch {
    /* last resort: transports will surface their own errors */
  }
  return FALLBACK_LOG_DIR;
}

export const preferredLogDir = process.env.LOG_DIR || DEFAULT_LOG_DIR;
export const logDir = resolveLogDir();

if (logDir !== preferredLogDir) {
  console.warn(
    `[logger] "${preferredLogDir}" is not writable - falling back to "${logDir}". ` +
      `Run 'sudo server/scripts/setup-logdir.sh' once to fix permissions.`
  );
}

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const CONSOLE_ENABLED =
  String(process.env.LOG_CONSOLE ?? "").toLowerCase() !== "false";

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS ZZ" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, subsystem, stack }) =>
    `${timestamp} ${level} [${subsystem}] ${stack || message}`
  )
);

/**
 * Build one subsystem logger writing to its own stream plus the shared
 * error stream.
 *
 * @param {"crm"|"pbx"} name subsystem tag stored on every record
 * @param {string} fileName stream file inside the log directory
 */
function buildSubsystem(name, fileName) {
  const logger = winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: { subsystem: name, pid: process.pid },
    transports: [
      new winston.transports.File({
        filename: path.join(logDir, fileName),
        format: fileFormat,
        maxsize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
      }),
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        level: "error",
        format: fileFormat,
        maxsize: MAX_FILE_SIZE,
        maxFiles: MAX_FILES,
      }),
      ...(CONSOLE_ENABLED
        ? [new winston.transports.Console({ format: consoleFormat })]
        : []),
    ],
  });

  // A failing file stream (disk full, permissions revoked at runtime) must
  // never take the whole application down.
  logger.on("error", (err) => console.error("[logger]", err.message));
  return logger;
}

/** CRM/application logger -> crm.log (+ error.log). */
export const crm = buildSubsystem("crm", "crm.log");

/** PBX/FreePBX integration logger -> pbx.log (+ error.log). */
export const pbx = buildSubsystem("pbx", "pbx.log");

// Process-level safety nets: previously unhandled rejections/exceptions were
// lost entirely. uncaughtException logs once (error.log is shared) then exits.
process.on("unhandledRejection", (reason) => {
  crm.error(
    "Unhandled promise rejection:",
    reason instanceof Error ? reason : new Error(String(reason))
  );
});

process.on("uncaughtException", (err) => {
  crm.error("Uncaught exception - shutting down:", err);
  setTimeout(() => process.exit(1), 200).unref();
});

export default { crm, pbx, logDir };
