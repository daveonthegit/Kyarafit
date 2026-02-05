package email

import (
	"fmt"
)

// WelcomeEmailData contains data for welcome email
type WelcomeEmailData struct {
	Name string
	AppURL string
}

// SendWelcomeEmail sends a welcome email to a new user
func (c *Client) SendWelcomeEmail(to, name string) error {
	appURL := getAppURL()
	
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Welcome to Kyarafit</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
		<h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Kyarafit!</h1>
	</div>
	
	<div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
		<p style="font-size: 16px; margin-bottom: 20px;">Hi %s,</p>
		
		<p style="font-size: 16px; margin-bottom: 20px;">
			Thank you for joining Kyarafit! We're excited to help you organize your cosplay wardrobe and plan your convention outfits.
		</p>
		
		<p style="font-size: 16px; margin-bottom: 20px;">
			Here's what you can do with Kyarafit:
		</p>
		
		<ul style="font-size: 16px; margin-bottom: 30px; padding-left: 20px;">
			<li style="margin-bottom: 10px;">📸 Build your digital closet with photos of your items</li>
			<li style="margin-bottom: 10px;">🎭 Create and manage your cosplay builds</li>
			<li style="margin-bottom: 10px;">📅 Plan your convention outfits</li>
			<li style="margin-bottom: 10px;">✅ Generate packing lists automatically</li>
		</ul>
		
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Get Started</a>
		</div>
		
		<p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
			Questions? Just reply to this email - we're here to help!
		</p>
	</div>
	
	<div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
		<p>© 2026 Kyarafit. All rights reserved.</p>
	</div>
</body>
</html>
	`, name, appURL)

	return c.Send(Email{
		To:      []string{to},
		Subject: "Welcome to Kyarafit! 🎭",
		Body:    body,
		IsHTML:  true,
	})
}

// PasswordResetData contains data for password reset email
type PasswordResetData struct {
	Name      string
	ResetLink string
	ExpiresIn string
}

// SendPasswordResetEmail sends a password reset email
func (c *Client) SendPasswordResetEmail(to, name, resetToken string) error {
	appURL := getAppURL()
	resetLink := fmt.Sprintf("%s/auth/reset-password?token=%s", appURL, resetToken)
	
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background: #f44336; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
		<h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
	</div>
	
	<div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
		<p style="font-size: 16px; margin-bottom: 20px;">Hi %s,</p>
		
		<p style="font-size: 16px; margin-bottom: 20px;">
			We received a request to reset your password for your Kyarafit account.
		</p>
		
		<p style="font-size: 16px; margin-bottom: 30px;">
			Click the button below to reset your password. This link will expire in 1 hour.
		</p>
		
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" style="display: inline-block; background: #f44336; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
		</div>
		
		<p style="font-size: 14px; color: #666; margin-top: 30px;">
			If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
		</p>
		
		<p style="font-size: 14px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
			If the button doesn't work, copy and paste this link into your browser:<br>
			<a href="%s" style="color: #667eea; word-break: break-all;">%s</a>
		</p>
	</div>
	
	<div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
		<p>© 2026 Kyarafit. All rights reserved.</p>
	</div>
</body>
</html>
	`, name, resetLink, resetLink, resetLink)

	return c.Send(Email{
		To:      []string{to},
		Subject: "Reset Your Kyarafit Password",
		Body:    body,
		IsHTML:  true,
	})
}

// SendVerificationEmail sends an email verification link
func (c *Client) SendVerificationEmail(to, name, verificationToken string) error {
	appURL := getAppURL()
	verificationLink := fmt.Sprintf("%s/auth/verify?token=%s", appURL, verificationToken)
	
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Verify Your Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
		<h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
	</div>
	
	<div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
		<p style="font-size: 16px; margin-bottom: 20px;">Hi %s,</p>
		
		<p style="font-size: 16px; margin-bottom: 20px;">
			Thanks for signing up for Kyarafit! Please verify your email address to get started.
		</p>
		
		<div style="text-align: center; margin: 30px 0;">
			<a href="%s" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email</a>
		</div>
		
		<p style="font-size: 14px; color: #666; margin-top: 30px;">
			If you didn't create a Kyarafit account, you can safely ignore this email.
		</p>
		
		<p style="font-size: 14px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
			If the button doesn't work, copy and paste this link into your browser:<br>
			<a href="%s" style="color: #667eea; word-break: break-all;">%s</a>
		</p>
	</div>
	
	<div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
		<p>© 2026 Kyarafit. All rights reserved.</p>
	</div>
</body>
</html>
	`, name, verificationLink, verificationLink, verificationLink)

	return c.Send(Email{
		To:      []string{to},
		Subject: "Verify Your Kyarafit Email",
		Body:    body,
		IsHTML:  true,
	})
}

// SendNotificationEmail sends a generic notification email
func (c *Client) SendNotificationEmail(to, subject, message string) error {
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>%s</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
	<div style="background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
		<h1 style="color: white; margin: 0; font-size: 28px;">Kyarafit Notification</h1>
	</div>
	
	<div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
		<p style="font-size: 16px; margin-bottom: 20px;">%s</p>
	</div>
	
	<div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
		<p>© 2026 Kyarafit. All rights reserved.</p>
	</div>
</body>
</html>
	`, subject, message)

	return c.Send(Email{
		To:      []string{to},
		Subject: subject,
		Body:    body,
		IsHTML:  true,
	})
}

// getAppURL returns the application URL from environment or defaults to localhost
func getAppURL() string {
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	return appURL
}
