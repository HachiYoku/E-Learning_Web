const { Resend } = require("resend");

let resend;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send email");
  }

  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const sendEmail = async (to, subject, html) => {
  return getResendClient().emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;
