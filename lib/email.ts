import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | undefined;

function getTransport() {
  if (transport) return transport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new Error("Email delivery is not configured.");
  }

  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
  return transport;
}

function sender() {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("Email delivery is not configured.");
  return from;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const emailUrl = resetUrl.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
  await getTransport().sendMail({
    from: sender(),
    to,
    subject: "Reset password Asih Plastik",
    text: `Gunakan tautan berikut untuk mereset password Anda dalam 15 menit: ${resetUrl}\n\nAbaikan email ini jika Anda tidak meminta reset password.`,
    html: `<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reset password Asih Plastik</title></head>
<body style="margin:0;padding:0;background-color:#fffefb;color:#201515;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fffefb;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;">
        <tr><td style="padding:0 0 24px;font-size:24px;font-weight:600;color:#201515;">Asih Plastik</td></tr>
        <tr><td style="padding:32px 24px;border:1px solid #c5c0b1;border-radius:5px;background-color:#fffefb;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;line-height:1.25;">Reset password Anda</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#36342e;">Kami menerima permintaan untuk mereset password akun Anda. Gunakan tombol berikut untuk membuat password baru.</p>
          <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#ff4f00" style="border:1px solid #ff4f00;border-radius:4px;">
            <a href="${emailUrl}" style="display:inline-block;padding:16px 24px;border-radius:4px;background-color:#ff4f00;color:#fffefb;font-size:16px;font-weight:600;text-decoration:none;">Reset password</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#36342e;">Tautan ini berlaku selama <strong>15 menit</strong> dan hanya dapat digunakan satu kali.</p>
          <p style="margin:24px 0 8px;font-size:14px;line-height:1.5;color:#36342e;">Jika tombol tidak berfungsi, salin tautan berikut ke browser Anda:</p>
          <p style="margin:0;font-size:14px;line-height:1.5;word-break:break-all;overflow-wrap:anywhere;"><a href="${emailUrl}" style="color:#201515;text-decoration:underline;">${emailUrl}</a></p>
          <p style="margin:24px 0 0;padding-top:24px;border-top:1px solid #c5c0b1;font-size:14px;line-height:1.5;color:#36342e;">Abaikan email ini jika Anda tidak meminta reset password. Password Anda tetap sama sampai Anda membuat password baru.</p>
        </td></tr>
        <tr><td style="padding:24px 0 0;font-size:14px;line-height:1.5;color:#36342e;">Manajemen Stok Asih Plastik</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendPasswordChangedEmail(to: string) {
  await getTransport().sendMail({
    from: sender(),
    to,
    subject: "Password Asih Plastik berhasil diubah",
    text: "Password akun Anda baru saja diubah. Jika Anda tidak melakukan perubahan ini, segera hubungi administrator sistem.",
  });
}
