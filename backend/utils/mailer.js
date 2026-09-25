const nodemailer = require("nodemailer");

// Primary Transporter: Defaults to Port 465 (SSL) with explicit credentials fallback for cloud hosting (Render)
const primaryTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
  secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : true,
  auth: {
    user: process.env.SMTP_USER || 'parshants444@gmail.com',
    pass: process.env.SMTP_PASS || 'jdivqubhjqquofzu',
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Secondary Fallback Transporter: Port 587 (STARTTLS) in case Port 465 is filtered
const fallbackTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'parshants444@gmail.com',
    pass: process.env.SMTP_PASS || 'jdivqubhjqquofzu',
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

async function sendMail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || '"DineSmart" <parshants444@gmail.com>';
  try {
    return await primaryTransporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });
  } catch (primaryErr) {
    console.warn("[Mailer] Primary SMTP transport failed, attempting fallback transport...", primaryErr.message);
    return await fallbackTransporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });
  }
}

module.exports = { sendMail, transporter: primaryTransporter };
