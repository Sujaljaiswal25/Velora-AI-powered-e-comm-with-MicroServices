const { subscribeToQueue } = require("./borker");
const { sendEmail } = require("../email");

module.exports = function () {
  subscribeToQueue("AUTH_NOTIFICATION.USER_CREATED", async (data) => {
    // Safely build a proper, branded HTML email template
    const escapeHtml = (str = "") =>
      String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const displayName =
      [data?.fullName?.firstName, data?.fullName?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || "there";

    const subject = "Welcome to Velora";
    const textBody = `Hi ${displayName}, welcome to Velora! Thanks for registering. If you didn’t create this account, you can ignore this email.`;

    const appUrl = process.env.APP_URL || "#";
    const year = new Date().getFullYear();

    const emailHTMLTemplate = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="x-ua-compatible" content="ie=edge" />
        <title>${subject}</title>
        <!-- Keep styles minimal in head; most are inline for email client support -->
    </head>
    <body style="margin:0; padding:0; background-color:#f6f8fb; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f8fb; padding:24px 0;">
            <tr>
                <td align="center">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                        <tr>
                            <td style="padding:32px 32px 16px; text-align:center; background:linear-gradient(135deg,#4f46e5,#06b6d4); color:#ffffff;">
                                <h1 style="margin:0; font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:24px; line-height:1.3; font-weight:700;">Welcome to Velora</h1>
                                <p style="margin:8px 0 0; font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; opacity:.9;">Your AI‑powered shopping companion</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:24px 32px; color:#111827; font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
                                <p style="margin:0 0 16px;">Hi ${escapeHtml(
                                  displayName
                                )},</p>
                                <p style="margin:0 0 16px;">Thanks for signing up. We're excited to have you on board.</p>
                                <p style="margin:0 0 24px;">Here are a few things you can do next:</p>
                                <ul style="margin:0 0 24px; padding-left:20px;">
                                    <li>Complete your profile</li>
                                    <li>Explore products tailored for you</li>
                                    <li>Enable notifications for order updates</li>
                                </ul>
                                <div style="text-align:center; margin:8px 0 0;">
                                    <a href="${appUrl}"
                                         style="display:inline-block; background:#4f46e5; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;"
                                         target="_blank" rel="noopener noreferrer">Go to Dashboard</a>
                                </div>
                                <p style="margin:24px 0 0; color:#6b7280; font-size:12px;">If you didn't create this account, you can safely ignore this email.</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:16px 32px; background:#f9fafb; color:#6b7280; font-size:12px; text-align:center; font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
                                © ${year} Velora. All rights reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>`;

    await sendEmail(data?.email, subject, textBody, emailHTMLTemplate);
  });
};
