# SendGrid Setup Guide (Quick)

SendGrid gives you 100 free emails/day with permanent API keys - no OAuth2 headaches!

## Step 1: Sign Up

1. Go to: **https://signup.sendgrid.com/**
2. Click **"Start For Free"**
3. Fill out form and verify your email

## Step 2: Get API Key

1. Login: https://app.sendgrid.com/
2. Go to **Settings** → **API Keys** (left sidebar)
3. Click **"Create API Key"**
4. **API Key Name**: "Job Automation"
5. **Permissions**: Choose **"Full Access"**
6. Click **"Create & View"**
7. **COPY the key** immediately (you won't see it again!)

## Step 3: Verify Your Email

1. Go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Enter your email address
4. Check your inbox and click the verification link

## Step 4: Update `.env` File

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=YOUR_API_KEY_HERE
SENDGRID_FROM_EMAIL=your-verified-email@example.com
GMAIL_RECIPIENT=email-to-receive-jobs@example.com
```

Replace `YOUR_API_KEY_HERE` with the key from Step 2, and `your-verified-email@example.com` with the email you verified in Step 3.

## Step 5: Test It

```bash
npm run automate
```

## Done! 🎉

**Benefits over Gmail OAuth2:**

- No token expiration
- No OAuth2 complexity
- 100 emails/day free
- More reliable delivery

**Need Help?**

- See `.env.example` for all configuration options
- Email help: https://app.sendgrid.com/help
- API docs: https://docs.sendgrid.com/
