import sgMail from '@sendgrid/mail';
import logger from '../utils/logger';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@streamlick.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3002';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verificationLink = `${FRONTEND_URL}/auth/verify-email?token=${token}`;

  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject: 'Verify your Streamlick account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎥 Streamlick</h1>
            </div>
            <div class="content">
              <h2>Welcome to Streamlick!</h2>
              <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
              <p>Click the button below to verify your email. This link will expire in 24 hours.</p>
              <a href="${verificationLink}" class="button">Verify Email</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="background: white; padding: 10px; border-radius: 5px; word-break: break-all;">${verificationLink}</p>
              <p style="margin-top: 30px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Streamlick. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    if (SENDGRID_API_KEY) {
      await sgMail.send(msg);
    } else {
      // Development mode: log the verification link
    }
  } catch (error) {
    logger.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
}
