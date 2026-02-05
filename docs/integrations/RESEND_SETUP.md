# Resend Setup Guide for Kyarafit

Quick guide to set up Resend email service for Kyarafit.

## Why Resend?

Resend is a modern email API built for developers:

✅ **100 emails/day free** (3,000/month)  
✅ **Simple API key authentication**  
✅ **Excellent deliverability**  
✅ **Built-in email logs and analytics**  
✅ **React Email support**  
✅ **Modern developer experience**  
✅ **Works great for both dev and production**

## Quick Setup (5 minutes)

### Step 1: Create Resend Account

1. Go to https://resend.com
2. Sign up with GitHub or email
3. Verify your email address

### Step 2: Get Your API Key

1. In the Resend dashboard, click on **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "Kyarafit Backend")
4. Select permissions:
   - ✅ **Sending access** (required)
   - ⚠️ Keep other permissions off unless needed
5. Click **Add**
6. **Copy the API key** (starts with `re_`)
   - ⚠️ You can only see it once!
   - Store it safely

### Step 3: Configure Backend

Edit `backend/.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=re_YourApiKey123abc  # Paste your API key here
SMTP_FROM=Kyarafit <onboarding@resend.dev>
APP_URL=http://localhost:3000
```

**Important**:

- `SMTP_USERNAME` is always `resend` (literally, don't change it)
- `SMTP_PASSWORD` is your API key (starts with `re_`)
- For testing, use `onboarding@resend.dev` as the sender
- For production, verify your domain and use your own email

### Step 4: Test It

Start your backend:

```bash
cd backend
go run .
```

Send a test email:

```bash
# Windows PowerShell
.\test_smtp.ps1

# Linux/Mac
chmod +x test_smtp.sh
./test_smtp.sh
```

Or use curl:

```bash
curl -X POST http://localhost:8080/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

Check your inbox! 📧

## Using Your Own Domain (Production)

For production, you'll want to send from your own domain instead of `onboarding@resend.dev`.

### Step 1: Add Your Domain

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `kyarafit.com`)
4. Click **Add**

### Step 2: Add DNS Records

Resend will show you 3 DNS records to add:

**SPF Record** (TXT):

```
@ TXT "v=spf1 include:resend.com ~all"
```

**DKIM Record** (TXT):

```
resend._domainkey TXT "p=MIGfMA0GCSq...your-key..."
```

**DMARC Record** (TXT):

```
_dmarc TXT "v=DMARC1; p=none"
```

Add these to your DNS provider (Cloudflare, Namecheap, etc.).

### Step 3: Verify Domain

1. Wait 5-10 minutes for DNS propagation
2. In Resend, click **Verify** on your domain
3. Once verified, you'll see a green checkmark ✓

### Step 4: Update Configuration

Update `backend/.env`:

```env
SMTP_FROM=Kyarafit <noreply@kyarafit.com>  # Use your verified domain
```

Restart your backend and test again!

## Common DNS Providers

### Cloudflare

1. Go to DNS → Records
2. Add TXT records as shown by Resend
3. Set Proxy status to "DNS only" (gray cloud)

### Namecheap

1. Go to Domain List → Manage
2. Advanced DNS → Add New Record
3. Select TXT Record
4. Add the records from Resend

### GoDaddy

1. Go to DNS Management
2. Add → TXT Record
3. Enter Name and Value from Resend

### Vercel

1. Go to Project Settings → Domains
2. View DNS Records
3. Add TXT records from Resend

## Features & Limits

### Free Tier

- **100 emails per day**
- **3,000 emails per month**
- Unlimited domains
- Email logs for 7 days
- SMTP and API access
- Email templates

### Pro Tier ($20/month)

- **50,000 emails per month**
- Email logs for 30 days
- Priority support
- Webhooks
- Dedicated IP (add-on)

### Business Tier (Custom)

- Custom volume
- Email logs for 90 days
- Premium support
- SLA guarantee

## Monitoring & Logs

Resend provides excellent visibility into your emails:

### View Email Logs

1. Go to **Emails** in dashboard
2. See all sent emails with:
   - Status (Sent, Delivered, Bounced, etc.)
   - Recipient
   - Subject
   - Timestamp
   - Opens and clicks (if enabled)

### Email Details

Click any email to see:

- Full email content
- Delivery status
- SMTP response
- Events timeline
- Raw email source

### Set Up Webhooks (Pro)

For production, set up webhooks to handle:

- `email.delivered`
- `email.bounced`
- `email.complained`
- `email.opened`
- `email.clicked`

## Testing Tips

### 1. Use Test Mode

For development, `onboarding@resend.dev` works without domain verification:

```env
SMTP_FROM=Kyarafit <onboarding@resend.dev>
```

### 2. Check Spam Folder

If emails aren't arriving:

- Check spam/junk folder
- Wait a few minutes (SMTP can be delayed)
- Check Resend logs for delivery status

### 3. Verify Email Addresses

For free tier, you can only send to:

- Verified email addresses
- Your own domain (once verified)

To add verified emails:

1. Go to **Settings** → **Verified Emails**
2. Add email addresses for testing
3. They'll receive a verification link

### 4. Test Different Email Clients

Test your emails in:

- Gmail
- Outlook
- Apple Mail
- Mobile devices

Resend dashboard shows how emails render in different clients.

## Common Issues

### "Authentication failed"

**Problem**: API key is incorrect or expired

**Solution**:

- Generate a new API key in Resend dashboard
- Make sure you copied the full key (starts with `re_`)
- Verify `SMTP_USERNAME` is literally `resend`

### "Sender not verified"

**Problem**: Trying to send from unverified domain

**Solution**:

- Use `onboarding@resend.dev` for testing
- Or verify your domain in Resend dashboard

### Emails not received

**Check**:

1. Resend logs - was email sent?
2. Spam folder
3. Recipient email is correct
4. For free tier, recipient is verified

### Rate limit exceeded

**Problem**: Exceeded 100 emails/day limit

**Solution**:

- Wait until next day (resets at midnight UTC)
- Upgrade to Pro tier for higher limits
- Implement email queuing to spread sends

## Best Practices

### 1. Use Different API Keys per Environment

Create separate API keys:

- `Development` - for local testing
- `Staging` - for staging environment
- `Production` - for production

This allows you to:

- Track emails by environment
- Revoke keys without affecting other environments
- Monitor usage separately

### 2. Implement Email Queue

For high-volume apps, use a queue:

- Redis + Bull
- RabbitMQ
- AWS SQS

This prevents:

- Rate limit issues
- Timeout problems
- Lost emails

### 3. Handle Bounces

Monitor bounce rates and remove invalid emails:

```go
// Example: Track bounces
if err := emailClient.Send(email); err != nil {
    log.Printf("Failed to send to %s: %v", recipient, err)
    // Mark email as bounced in database
}
```

### 4. Set Up Webhooks (Pro)

Handle email events:

```go
// Webhook endpoint to receive Resend events
app.Post("/webhooks/resend", func(c *fiber.Ctx) error {
    var event struct {
        Type string `json:"type"`
        Data map[string]interface{} `json:"data"`
    }

    if err := c.BodyParser(&event); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
    }

    switch event.Type {
    case "email.bounced":
        // Handle bounce
    case "email.delivered":
        // Confirm delivery
    }

    return c.SendStatus(200)
})
```

### 5. Monitor Usage

Keep track of your email usage:

- Check Resend dashboard regularly
- Set up alerts for high usage
- Plan upgrades before hitting limits

## Integration Examples

### Send Welcome Email

```go
import "kyarafit-backend/internal/email"

emailClient, _ := email.NewClient()
err := emailClient.SendWelcomeEmail("user@example.com", "Jane Doe")
if err != nil {
    log.Printf("Failed to send welcome email: %v", err)
}
```

### Send Password Reset

```go
resetToken := generateSecureToken() // Your token generation
err := emailClient.SendPasswordResetEmail(
    "user@example.com",
    "Jane Doe",
    resetToken,
)
```

### Send Custom Email

```go
err := emailClient.Send(email.Email{
    To:      []string{"user@example.com"},
    Subject: "Convention Reminder",
    Body:    "<h1>Your convention is in 3 days!</h1>",
    IsHTML:  true,
})
```

### Batch Emails

```go
recipients := []string{
    "user1@example.com",
    "user2@example.com",
    "user3@example.com",
}

for _, recipient := range recipients {
    err := emailClient.Send(email.Email{
        To:      []string{recipient},
        Subject: "Newsletter",
        Body:    newsletterHTML,
        IsHTML:  true,
    })

    if err != nil {
        log.Printf("Failed to send to %s: %v", recipient, err)
    }

    // Add delay to avoid rate limits
    time.Sleep(100 * time.Millisecond)
}
```

## Resend vs Alternatives

| Feature              | Resend      | SendGrid   | Mailgun     | SES            |
| -------------------- | ----------- | ---------- | ----------- | -------------- |
| Free Tier            | 100/day     | 100/day    | Trial only  | Pay-per-use    |
| Setup Difficulty     | ⭐ Easy     | ⭐ Easy    | ⭐⭐ Medium | ⭐⭐⭐ Hard    |
| Developer Experience | ⭐⭐⭐⭐⭐  | ⭐⭐⭐     | ⭐⭐⭐      | ⭐⭐           |
| Deliverability       | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐    | ⭐⭐⭐⭐       |
| Pricing (10k/mo)     | $20         | $20        | $35         | $1             |
| Email Logs           | 7 days free | 7 days     | 3 days      | Via CloudWatch |
| Modern API           | Yes         | Yes        | Yes         | No             |

## Resources

- **Resend Dashboard**: https://resend.com/home
- **Resend Docs**: https://resend.com/docs
- **SMTP Guide**: https://resend.com/docs/send-with-smtp
- **API Reference**: https://resend.com/docs/api-reference
- **Status Page**: https://status.resend.com
- **Community**: https://twitter.com/resendlabs

## Support

Need help?

1. Check Resend documentation: https://resend.com/docs
2. Review email logs in dashboard
3. Join Resend community
4. Contact support: support@resend.com

## Next Steps

1. ✅ Configure Resend SMTP in `.env`
2. ✅ Test with test scripts
3. ⚠️ Verify your domain (for production)
4. ⚠️ Add DNS records (SPF, DKIM, DMARC)
5. ⚠️ Update `SMTP_FROM` to use your domain
6. ⚠️ Monitor usage and logs
7. ⚠️ Set up webhooks (Pro tier)
8. ⚠️ Implement email queue for high volume

---

You're all set with Resend! 🚀

For general SMTP documentation, see `SMTP_SETUP.md`.
