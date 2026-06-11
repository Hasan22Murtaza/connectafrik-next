import { escapeHtml } from './utils'

export function getSignupConfirmationEmailHtml(confirmationUrl: string): string {
  const safeUrl = escapeHtml(confirmationUrl)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
      padding: 20px;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
      color: white;
      padding: 50px 30px;
      text-align: center;
      position: relative;
    }
    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/></svg>') repeat;
      opacity: 0.3;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      position: relative;
      z-index: 1;
    }
    .header p {
      font-size: 16px;
      opacity: 0.95;
      position: relative;
      z-index: 1;
    }
    .content {
      padding: 40px 30px;
      background: #ffffff;
    }
    .welcome-message {
      text-align: center;
    }
    .welcome-message h2 {
      font-size: 24px;
      color: #1a1a1a;
      font-weight: 600;
    }
    .confirmation-box {
      padding: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .confirmation-box p {
      font-size: 16px;
      color: #333333;
      margin-bottom: 25px;
      font-weight: 500;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .confirm-button {
      display: inline-block;
      background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
      color: white !important;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
      transition: all 0.3s ease;
      letter-spacing: 0.5px;
    }
    .confirm-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
    }
    .footer {
      background: #f9f9f9;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
    }
    .footer p {
      font-size: 13px;
      color: #999999;
      margin: 5px 0;
    }
    .footer .brand {
      color: #FF6B35;
      font-weight: 600;
      font-size: 14px;
    }
    .alternative-link {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
    }
    .alternative-link p {
      font-size: 12px;
      color: #999999;
      margin-bottom: 10px;
    }
    .alternative-link a {
      color: #FF6B35;
      text-decoration: none;
      word-break: break-all;
      font-size: 11px;
    }
    @media only screen and (max-width: 600px) {
      .header {
        padding: 40px 20px;
      }
      .header h1 {
        font-size: 26px;
      }
      .content {
        padding: 30px 20px;
      }
      .confirm-button {
        padding: 14px 30px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header">
      <h1>Welcome to ConnectAfrik!</h1>
      <p>Your journey to connect with the African diaspora starts here</p>
    </div>

    <div class="content">
      <div class="welcome-message">
        <h2>Confirm Your Account</h2>
      </div>

      <div class="confirmation-box">
        <p>Click the button below to verify your email address and activate your account:</p>
        <div class="button-container">
          <a href="${safeUrl}" class="confirm-button">Confirm Your Email</a>
        </div>
      </div>
      <div class="alternative-link">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <a href="${safeUrl}">${safeUrl}</a>
      </div>
    </div>

    <div class="footer">
      <p class="brand">ConnectAfrik</p>
      <p>Uniting Africans and the diaspora worldwide</p>
      <p>&copy; 2024 ConnectAfrik. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 11px;">This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>`
}

export function getSignupConfirmationEmailText(confirmationUrl: string): string {
  return `Welcome to ConnectAfrik!

Confirm Your Account

Click the link below to verify your email address and activate your account:

${confirmationUrl}

ConnectAfrik — Uniting Africans and the diaspora worldwide

This is an automated email. Please do not reply to this message.`
}
