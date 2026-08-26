import { crm } from "../utils/logger.js";

/**
 * HTTP access logging middleware.
 *
 * Writes one line per finished request to the CRM stream:
 *   METHOD /path STATUS duration_ms user=.. ip=..
 * Requests answered with 4xx log at "warn", 5xx at "error".
 */
export default function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    try {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const user =
        req.user?.id || req.user?._id || req.user?.user?._id || "-";
      const level =
        res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

      crm[level](
        "%s %s %d %sms user=%s ip=%s",
        req.method,
        req.originalUrl,
        res.statusCode,
        ms.toFixed(0),
        user,
        req.ip
      );
    } catch {
      /* logging must never break a request */
    }
  });

  next();
}
