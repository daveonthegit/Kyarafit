# Supabase Development Configuration

## Disable Email Confirmation (Development Only)

When developing locally, you'll hit rate limits quickly. Here's how to disable email confirmation:

### Steps:

1. Go to [Supabase Dashboard](https://app.supabase.com/project/yjmkaxvnnocoejdjneyw/auth/settings)
2. Navigate to **Authentication** → **Settings**
3. Scroll to **"Email"** section
4. Find **"Enable email confirmations"**
5. **Uncheck** the box
6. Click **Save**

### What This Does:

- ✅ Users are immediately active after signup (no email confirmation needed)
- ✅ No rate limiting on confirmation emails
- ✅ Faster testing workflow
- ❌ Less secure (re-enable in production!)

### Re-enable for Production:

Before deploying to production, **turn email confirmations back ON**:
1. Check the **"Enable email confirmations"** box
2. Set up custom SMTP (see below)

---

## Rate Limits

### Free Tier Limits:
- **Auth requests**: ~100 per hour per IP
- **Email sends**: ~10 per hour
- **Database connections**: 60 concurrent

### If You Hit Rate Limits:
1. **Wait 1 hour** for reset
2. **Disable email confirmation** (see above)
3. **Use different email addresses** (`test+1@example.com`, `test+2@example.com`)
4. **Upgrade plan** if needed

---

## Custom SMTP for Testing (Optional)

Use a testing email service to avoid Supabase's email rate limits:

### Mailtrap (Recommended)
1. Sign up at [mailtrap.io](https://mailtrap.io) (free)
2. Get SMTP credentials
3. In Supabase Dashboard → **Authentication** → **Settings** → **SMTP Settings**:
   ```
   Host: smtp.mailtrap.io
   Port: 2525
   Username: [your-username]
   Password: [your-password]
   Sender email: noreply@kyarafit.app
   ```

### SendGrid (Production Ready)
1. Sign up at [sendgrid.com](https://sendgrid.com) (100 emails/day free)
2. Create API key
3. Configure in Supabase SMTP settings

---

## Testing Tips

### Use Test Emails
```
test+1@example.com
test+2@example.com
test+3@example.com
```
Gmail/Outlook treat these as the same inbox, but Supabase sees them as different users.

### Clear Test Users
Periodically clean up test users in Supabase Dashboard:
```
Authentication → Users → Select test users → Delete
```

### Monitor Usage
Check your usage in Supabase Dashboard:
```
Settings → Usage → API Requests
```

---

## Current Status

Your Supabase project: `yjmkaxvnnocoejdjneyw`
- Project URL: `https://yjmkaxvnnocoejdjneyw.supabase.co`
- Dashboard: `https://app.supabase.com/project/yjmkaxvnnocoejdjneyw`

### Recommended Settings for Development:
- ✅ Disable email confirmation
- ✅ Use test emails with `+` suffix
- ✅ Set up Mailtrap or custom SMTP
- ✅ Upgrade to Pro if doing heavy development ($25/month)
