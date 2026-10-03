const { Resend } = require("resend");

class DefinitiveEmailProviderError extends Error {
  constructor() {
    super("Email provider did not accept the send request");
    this.name = "DefinitiveEmailProviderError";
    this.definitiveProviderFailure = true;
  }
}

let resend;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required to send email");
  }

  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const sendEmail = async (to, subject, html, attachments = undefined) => {
  const result = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    ...(attachments?.length ? { attachments } : {}),
  });
  if (result?.error) throw new DefinitiveEmailProviderError();
  return result;
};

module.exports = sendEmail;
module.exports.DefinitiveEmailProviderError = DefinitiveEmailProviderError;
