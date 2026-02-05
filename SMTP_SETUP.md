# SMTP Setup Guide

This guide will help you configure SMTP (email sending) for your Kyarafit application.

## Quick Start

1. Choose an email provider (Gmail, SendGrid, Mailgun, etc.)
2. Get SMTP credentials from your provider
3. Update your `.env` file with the SMTP configuration
4. Test the configuration

## Configuration

Add these variables to your `backend/.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=Kyarafit <noreply@kyarafit.com>
APP_URL=http://localhost:3000
```

## Supported Email Providers

### 1. Resend (Recommended for Modern Apps)

**Best for**: Modern applications, developers, production use

**Pros**:
- 100 emails/day free (3,000/month)
- Modern API and SMTP support
- Excellent deliverability
- Simple setup with API keys
- Great documentation and developer experience
- Built-in email logs and analytics
- React Email support

**Cons**:
- Relatively new service
- Requires domain verification for production

**Setup**:

1. Sign up at https://resend.com/
2. Get your API key:
   - Go to API Keys in dashboard
   - Click "Create API Key"
   - Give it a name and select permissions
   - Copy the API key (starts with `re_`)

3. (Optional) Add and verify your domain:
   - Go to Domains → Add Domain
   - Add DNS records (SPF, DKIM)
   - Verify domain

4. Configure in `.env`:
   ```env
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USERNAME=resend
   SMTP_PASSWORD=re_YourApiKey123abc  # Your API key
   SMTP_FROM=Kyarafit <onboarding@resend.dev>  # Use your verified domain
   ```

**Important Notes**:
- Username is always `resend` (literally)
- Password is your API key (starts with `re_`)
- For testing, use `onboarding@resend.dev` as sender
- For production, verify your own domain and use `noreply@yourdomain.com`

**Pricing**: 
- Free: 100 emails/day (3,000/month)
- Pro: $20/mo (50,000 emails/month)
- Business: Custom pricing

### 2. Gmail (Free, Good for Development)

**Best for**: Development, small projects, personal use

**Pros**:
- Free (500 emails/day)
- Easy to set up
- Reliable delivery

**Cons**:
- Daily sending limit (500 emails)
- Requires 2FA and App Password
- Not ideal for production

**Setup**:

1. Enable 2-Factor Authentication on your Google account:
   - Go to https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password

3. Configure in `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=youremail@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop  # 16-char app password
   SMTP_FROM=Kyarafit <youremail@gmail.com>
   ```

**Important**: Use the 16-character App Password, NOT your regular Gmail password!

### 3. SendGrid (Established for Production)

**Best for**: Production applications with high volume

**Pros**:
- 100 emails/day free (then paid)
- Great deliverability
- Advanced analytics
- API and SMTP support

**Cons**:
- Requires account verification
- Paid for higher volumes

**Setup**:

1. Sign up at https://sendgrid.com/
2. Verify your sender identity (email or domain)
3. Create an API key:
   - Go to Settings → API Keys
   - Create a new API key with "Mail Send" permissions
   - Copy the API key

4. Configure in `.env`:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USERNAME=apikey  # literally the word "apikey"
   SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxx  # Your API key
   SMTP_FROM=Kyarafit <noreply@yourdomain.com>
   ```

**Pricing**: 
- Free: 100 emails/day
- Essentials: $19.95/mo (50,000 emails/mo)
- Pro: $89.95/mo (100,000 emails/mo)

### 4. Mailgun (Good Alternative)

**Best for**: Developers who need flexibility

**Pros**:
- 5,000 emails/month free for 3 months
- Pay-as-you-go pricing
- Good documentation
- EU and US regions

**Cons**:
- Credit card required even for trial

**Setup**:

1. Sign up at https://mailgun.com/
2. Add and verify your domain (or use sandbox domain for testing)
3. Get SMTP credentials:
   - Go to Sending → Domain settings → SMTP credentials
   - Create SMTP credentials or use default

4. Configure in `.env`:
   ```env
   SMTP_HOST=smtp.mailgun.org  # or smtp.eu.mailgun.org for EU
   SMTP_PORT=587
   SMTP_USERNAME=postmaster@yourdomain.mailgun.org
   SMTP_PASSWORD=your-smtp-password
   SMTP_FROM=Kyarafit <noreply@yourdomain.com>
   ```

**Pricing**:
- Trial: 5,000 emails/month (3 months)
- Foundation: $35/mo (50,000 emails/mo)
- Growth: $80/mo (100,000 emails/mo)

### 5. Amazon SES (Best for AWS Users)

**Best for**: High-volume, AWS infrastructure

**Pros**:
- Extremely cheap ($0.10 per 1,000 emails)
- Highly scalable
- Integrates with AWS services

**Cons**:
- More complex setup
- Requires AWS account
- Sandbox mode requires verification

**Setup**:

1. Sign up for AWS and enable SES
2. Verify your email/domain
3. Request production access (starts in sandbox mode)
4. Create SMTP credentials:
   - Go to SES → SMTP Settings
   - Create SMTP Credentials
   - Download credentials

5. Configure in `.env`:
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Your region
   SMTP_PORT=587
   SMTP_USERNAME=AKIAIOSFODNN7EXAMPLE  # Your SMTP username
   SMTP_PASSWORD=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   SMTP_FROM=Kyarafit <noreply@yourdomain.com>
   ```

**Pricing**: $0.10 per 1,000 emails (one of the cheapest)

### 6. Postmark (Premium Option)

**Best for**: Transactional emails, high deliverability

**Pros**:
- Excellent deliverability (99%+)
- Fast delivery
- Great support
- Simple pricing

**Cons**:
- More expensive
- No free tier (100 free emails to test)

**Setup**:

1. Sign up at https://postmarkapp.com/
2. Create a server
3. Add and verify your sender signature
4. Get server token from Settings → API Tokens

5. Configure in `.env`:
   ```env
   SMTP_HOST=smtp.postmarkapp.com
   SMTP_PORT=587
   SMTP_USERNAME=your-server-token
   SMTP_PASSWORD=your-server-token  # Same as username
   SMTP_FROM=Kyarafit <noreply@yourdomain.com>
   ```

**Pricing**: $15/mo for 10,000 emails

## Testing Your Configuration

### 1. Check Configuration
```bash
curl http://localhost:8080/api/test/email/verify
```

### 2. Send Test Email
```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

### 3. Check Logs
The backend will log email initialization status on startup:
```
Email service initialized successfully
```

Or if there's an issue:
```
Warning: Email client not initialized: SMTP configuration incomplete
```

## Common Issues & Solutions

### Problem: "Authentication failed"

**Gmail**: 
- Make sure you're using an App Password, not your regular password
- Verify 2FA is enabled
- Check that "Less secure app access" is OFF (use App Password instead)

**SendGrid**:
- Make sure username is literally `apikey`
- Verify API key has "Mail Send" permission

**Solution**: Double-check your credentials and provider-specific requirements

### Problem: "Connection refused" or "Connection timeout"

**Possible causes**:
- Wrong host or port
- Firewall blocking outbound SMTP
- ISP blocking SMTP ports

**Solutions**:
1. Verify host and port are correct
2. Try port 2525 instead of 587
3. Check firewall settings
4. Test with telnet: `telnet smtp.gmail.com 587`

### Problem: Emails go to spam

**Solutions**:
1. **Verify your domain**: Add SPF, DKIM, and DMARC records
2. **Use a real domain**: Don't send from gmail.com if using SendGrid
3. **Warm up your IP**: Start with low volume, gradually increase
4. **Include unsubscribe link**: Required for bulk emails
5. **Authenticate your domain**: Most providers offer domain authentication

### Problem: "535 5.7.8 Username and Password not accepted" (Gmail)

**Solution**:
- Enable 2-Factor Authentication
- Generate a new App Password
- Use the App Password in SMTP_PASSWORD

## Production Best Practices

### 1. Use a Professional Email Service
- **Don't use Gmail** for production
- Use SendGrid, Mailgun, or Amazon SES
- These services have better deliverability and higher limits

### 2. Verify Your Domain
Set up DNS records for better deliverability:

**SPF Record**:
```
v=spf1 include:_spf.google.com ~all  # For Gmail
v=spf1 include:sendgrid.net ~all     # For SendGrid
```

**DKIM**: Follow your provider's instructions to add DKIM keys

**DMARC**:
```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

### 3. Monitor Deliverability
- Track bounce rates
- Monitor spam complaints
- Check sender reputation
- Use provider analytics

### 4. Implement Rate Limiting
```go
// Example: Limit to 10 emails per minute per user
// Implement in your application code
```

### 5. Handle Bounces
- Process bounce notifications
- Remove hard bounces from your list
- Retry soft bounces with exponential backoff

### 6. Queue Emails
For high volume, use a message queue:
- Redis + Bull
- RabbitMQ
- AWS SQS

### 7. Log Everything
```go
log.Printf("Email sent to %s: %s", recipient, subject)
```

## Email Features in Kyarafit

The email service includes pre-built templates for:

1. **Welcome Email**: Sent when users sign up
2. **Password Reset**: Secure password reset links
3. **Email Verification**: Confirm user email addresses
4. **Notifications**: Custom notifications

### Example: Send Welcome Email

```go
import "kyarafit-backend/internal/email"

emailClient, _ := email.NewClient()
err := emailClient.SendWelcomeEmail("user@example.com", "John Doe")
```

## Security Checklist

- [ ] Never commit `.env` file to git
- [ ] Use app-specific passwords (Gmail)
- [ ] Enable TLS (port 587 or 465)
- [ ] Implement rate limiting
- [ ] Validate email addresses before sending
- [ ] Use secure tokens for password reset
- [ ] Set appropriate token expiration times
- [ ] Log all email sending attempts
- [ ] Monitor for suspicious activity

## Cost Comparison

For 10,000 emails/month:

| Provider | Cost | Notes |
|----------|------|-------|
| Gmail | Free* | *Limited to 500/day |
| Resend | $20 | 50,000 emails included, modern API |
| SendGrid | $19.95 | 50,000 emails included |
| Mailgun | $35 | 50,000 emails included |
| Amazon SES | $1 | Pay-as-you-go |
| Postmark | $15 | 10,000 emails included |

## Recommendations

- **Development**: Gmail (free, easy setup) or Resend (modern, 100/day free)
- **Modern Apps**: Resend (great DX, generous free tier)
- **Small Production**: Resend or SendGrid
- **High Volume**: Amazon SES (cheapest) or Mailgun
- **Best Deliverability**: Postmark
- **AWS Infrastructure**: Amazon SES

## Need Help?

1. Check the logs: `docker-compose logs backend`
2. Verify configuration: `GET /api/test/email/verify`
3. Send test email: `POST /api/test/email`
4. Review provider documentation
5. Check DNS records: https://mxtoolbox.com/

## Next Steps

After setting up SMTP:

1. Configure domain authentication (SPF/DKIM/DMARC)
2. Set up email templates for your use case
3. Implement email verification for new users
4. Add password reset functionality
5. Set up monitoring and alerts
6. Plan for scaling as your user base grows

---

For more details, see `backend/internal/email/README.md`
