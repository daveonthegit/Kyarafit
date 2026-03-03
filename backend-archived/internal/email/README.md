# Email Service

This package provides email functionality for the Kyarafit application using SMTP.

## Configuration

Configure SMTP settings in your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=Kyarafit <noreply@kyarafit.com>
APP_URL=http://localhost:3000
```

### Supported Email Providers

#### Gmail

- **Host**: `smtp.gmail.com`
- **Port**: `587` (TLS)
- **Important**: Use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password
- Steps to get App Password:
  1. Enable 2-Factor Authentication on your Google account
  2. Go to Google Account → Security → 2-Step Verification → App passwords
  3. Generate a new app password for "Mail"
  4. Use this 16-character password in `SMTP_PASSWORD`

#### SendGrid

- **Host**: `smtp.sendgrid.net`
- **Port**: `587`
- **Username**: `apikey` (literal string)
- **Password**: Your SendGrid API key

#### Mailgun

- **Host**: `smtp.mailgun.org` (or region-specific)
- **Port**: `587`
- **Username**: Your Mailgun SMTP username
- **Password**: Your Mailgun SMTP password

#### Amazon SES

- **Host**: `email-smtp.us-east-1.amazonaws.com` (or your region)
- **Port**: `587`
- **Username**: Your AWS SMTP username
- **Password**: Your AWS SMTP password

#### Postmark

- **Host**: `smtp.postmarkapp.com`
- **Port**: `587`
- **Username**: Your Postmark server token
- **Password**: Your Postmark server token

## Usage

### Initialize the Client

```go
import "kyarafit-backend/internal/email"

// Create email client from environment variables
emailClient, err := email.NewClient()
if err != nil {
    log.Fatal(err)
}

// Verify connection (optional)
if err := emailClient.Verify(); err != nil {
    log.Println("Warning: SMTP verification failed:", err)
}
```

### Send Simple Email

```go
err := emailClient.Send(email.Email{
    To:      []string{"user@example.com"},
    Subject: "Hello from Kyarafit",
    Body:    "This is a test email.",
    IsHTML:  false,
})
```

### Send HTML Email

```go
err := emailClient.Send(email.Email{
    To:      []string{"user@example.com"},
    Subject: "Welcome!",
    Body:    "<h1>Welcome to Kyarafit!</h1><p>Thanks for joining.</p>",
    IsHTML:  true,
})
```

### Send Welcome Email

```go
err := emailClient.SendWelcomeEmail("user@example.com", "John Doe")
```

### Send Password Reset Email

```go
resetToken := "abc123xyz789" // Generate a secure token
err := emailClient.SendPasswordResetEmail("user@example.com", "John Doe", resetToken)
```

### Send Email Verification

```go
verificationToken := "xyz789abc123" // Generate a secure token
err := emailClient.SendVerificationEmail("user@example.com", "John Doe", verificationToken)
```

### Send Custom Notification

```go
err := emailClient.SendNotificationEmail(
    "user@example.com",
    "Convention Reminder",
    "Your convention is starting in 3 days! Don't forget to pack.",
)
```

## Available Templates

The package includes pre-built email templates:

1. **Welcome Email** - Sent when a user signs up
2. **Password Reset** - Sent when a user requests password reset
3. **Email Verification** - Sent to verify email addresses
4. **Notification** - Generic notification template

All templates are responsive and look great on desktop and mobile devices.

## Testing

To test your SMTP configuration:

```bash
# Send a test email using the test endpoint
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

## Security Best Practices

1. **Never commit credentials**: Keep `.env` file out of version control
2. **Use app-specific passwords**: For Gmail, use App Passwords instead of your main password
3. **Enable TLS**: Always use port 587 (STARTTLS) or 465 (TLS) for encrypted connections
4. **Rate limiting**: Implement rate limiting for email sending to prevent abuse
5. **Validate email addresses**: Always validate recipient email addresses before sending
6. **SPF/DKIM/DMARC**: Configure these DNS records for your domain to improve deliverability

## Troubleshooting

### "Authentication failed"

- Check username and password are correct
- For Gmail, ensure you're using an App Password
- Verify 2FA is enabled on your account

### "Connection refused" or "Timeout"

- Check SMTP_HOST and SMTP_PORT are correct
- Verify firewall isn't blocking outbound SMTP connections
- Test with `telnet smtp.gmail.com 587`

### "535 5.7.8 Username and Password not accepted"

- For Gmail, enable "Less secure app access" or use App Password
- Verify credentials are correct

### Emails going to spam

- Configure SPF, DKIM, and DMARC records
- Use a verified sender domain
- Avoid spam trigger words
- Include unsubscribe link
- Maintain good sender reputation

## Rate Limits

Be aware of provider rate limits:

- **Gmail**: 500 emails/day (free), 2000/day (Google Workspace)
- **SendGrid**: 100 emails/day (free), higher tiers available
- **Mailgun**: 5000 emails/month (free trial)
- **Amazon SES**: Pay-as-you-go, high limits

## Production Recommendations

For production use:

1. **Use a dedicated email service**: SendGrid, Mailgun, or Amazon SES
2. **Monitor deliverability**: Track bounce rates and spam complaints
3. **Implement retry logic**: Handle temporary failures gracefully
4. **Queue emails**: Use a message queue for high-volume sending
5. **Log all sends**: Keep audit trail of sent emails
6. **Handle bounces**: Process bounce notifications and clean your list
