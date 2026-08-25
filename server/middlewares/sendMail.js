import nodemailer from 'nodemailer'

// ----------------------------------------------------------------------
// SMTP configuration comes from environment variables so no credentials
// are ever hardcoded:
//   SMTP_HOST   e.g. smtp.office365.com        (required to send)
//   SMTP_PORT   e.g. 587                       (default 587)
//   SMTP_SECURE "true" for implicit TLS/465    (default: true when port 465)
//   SMTP_USER   SMTP account username
//   SMTP_PASS   SMTP account password
//   SMTP_FROM   From header, e.g. "SureCRM <crm@company.com>"
//               (falls back to SMTP_USER)
// ----------------------------------------------------------------------

const host = process.env.SMTP_HOST || ''
const port = Number(process.env.SMTP_PORT || 587) || 587
const secure =
  String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465
const user = process.env.SMTP_USER || ''
const pass = process.env.SMTP_PASS || ''
const from = process.env.SMTP_FROM || user

const transporter = host
  ? nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    })
  : null

/**
 * Sends an email using the configured SMTP transport.
 *
 * @returns {Promise<{ok: boolean, error?: string, response?: string}>}
 *          Never throws — callers decide how to surface failures.
 */
const sendMail = async (to, subject, message, html) => {
  if (!transporter) {
    const err =
      'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in the server environment.'
    console.error('Error sending email:', err)
    return { ok: false, error: err }
  }
  try {
    const mailOptions = {
      from,
      to,
      subject,
      text: message || '',
      html: html || undefined,
    }

    const info = await transporter.sendMail(mailOptions)

    console.log('Email sent:', info.response)
    return { ok: true, response: info.response }
  } catch (error) {
    console.error('Error sending email:', error.message)
    return { ok: false, error: error.message }
  }
}

export default sendMail


