# SMTP Quick Start

Quick guide to get email working in 5 minutes.

## Step 1: Choose a Provider

**For Development & Production (Recommended)**:
- **Resend** - 100 emails/day free (3,000/month), modern API, great DX

**Alternative Options**:
- Gmail - 500 emails/day, easy setup (dev only)
- SendGrid - 100 emails/day free, then paid
- Amazon SES - $0.10 per 1,000 emails
- Mailgun - 5,000 emails/month free trial

## Step 2A: Get Resend API Key (Recommended)

1. Sign up at https://resend.com
2. Go to API Keys in dashboard
3. Click "Create API Key"
4. Copy the API key (starts with `re_`)

## Step 2B: Get Gmail App Password (Alternative for Testing)

1. Enable 2FA: https://myaccount.google.com/security
2. Create App Password: https://myaccount.google.com/apppasswords
3. Select "Mail" → Generate
4. Copy the 16-character password

## Step 3: Configure Backend

Edit `backend/.env`:

**Option A: Using Resend (Recommended)**
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=re_YourApiKey123abc  # Your Resend API key
SMTP_FROM=Kyarafit <onboarding@resend.dev>  # or your verified domain
APP_URL=http://localhost:3000
```

**Option B: Using Gmail**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=youremail@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop  # Your 16-char App Password
SMTP_FROM=Kyarafit <youremail@gmail.com>
APP_URL=http://localhost:3000
```

## Step 4: Test It

### Start Backend
```bash
cd backend
go run .
```

### Run Test Script

**Windows (PowerShell)**:
```powershell
cd backend
.\test_smtp.ps1
```

**Linux/Mac**:
```bash
cd backend
chmod +x test_smtp.sh
./test_smtp.sh
```

### Or Test with curl

**Check Configuration**:
```bash
curl http://localhost:8080/api/test/email/verify
```

**Send Test Email**:
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

## Step 5: Use in Code

```go
import "kyarafit-backend/internal/email"

// Initialize client
emailClient, err := email.NewClient()
if err != nil {
    log.Fatal(err)
}

// Send welcome email
err = emailClient.SendWelcomeEmail("user@example.com", "User Name")

// Send password reset
err = emailClient.SendPasswordResetEmail("user@example.com", "User Name", "reset-token")

// Send verification email
err = emailClient.SendVerificationEmail("user@example.com", "User Name", "verify-token")

// Send custom email
err = emailClient.Send(email.Email{
    To:      []string{"user@example.com"},
    Subject: "Your Subject",
    Body:    "<h1>HTML Content</h1>",
    IsHTML:  true,
})
```

## Common Issues

### "Authentication failed"
→ Use App Password, not your Gmail password
→ Make sure 2FA is enabled

### "Connection refused"
→ Check SMTP_HOST and SMTP_PORT
→ Try port 2525 if 587 doesn't work

### Emails go to spam
→ Use a verified domain for production
→ Add SPF/DKIM/DMARC records

## Next Steps

For production:
1. Switch to SendGrid/Mailgun/SES
2. Verify your domain
3. Set up SPF/DKIM/DMARC
4. Monitor deliverability

See `SMTP_SETUP.md` for detailed configuration guide.

## Provider Quick Config

### Resend (Recommended)
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=re_YourApiKey123abc
SMTP_FROM=Kyarafit <onboarding@resend.dev>
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=Kyarafit <noreply@yourdomain.com>
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@yourdomain.mailgun.org
SMTP_PASSWORD=your-mailgun-password
SMTP_FROM=Kyarafit <noreply@yourdomain.com>
```

### Amazon SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=your-aws-smtp-username
SMTP_PASSWORD=your-aws-smtp-password
SMTP_FROM=Kyarafit <noreply@yourdomain.com>
```

---

That's it! Your email service is ready to use. 📧
