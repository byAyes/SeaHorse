# Resend + GitHub Actions Setup Guide

Resend is a modern email API designed for developers with 100 emails/day free, permanent API keys, and no OAuth2 complexity.

**Use this when:** Running automation on GitHub Actions with encrypted secrets.

---

## Step 1: Create Resend Account

1. Go to: https://resend.com/sign-up
2. Sign up with GitHub or email
3. Verify your email
4. Login: https://resend.com

---

## Step 2: Generate API Key

1. In Resend dashboard, click **"API Keys"** (top)
2. Click **"Create API Key"**
3. **Name**: "Job Automation"
4. **Environment**: "Production"
5. Click **"Add API Key"**
6. **🚨 COPY THE KEY** (starts with `re_`)

---

## Step 3: Verify Domain/Email (Required)

1. Go to **"Domains"** (top)
2. For testing: Use **"resend.dev"** domain (pre-verified)
3. For production: Add your own domain (requires DNS verification)
4. We'll use `onboarding@resend.dev` for testing (pre-verified by Resend)

---

## Step 4: Configure GitHub Secrets

### Option: GitHub Actions with Secrets (Recommended)

Go to your GitHub repository: `https://github.com/byAyes/automatitation/settings/secrets/actions`

| Secret Name         | Value                    | Example                  |
| ------------------- | ------------------------ | ------------------------ |
| `RESEND_API_KEY`    | Your API key from Step 2 | `re_xxx123...`           |
| `RESEND_FROM_EMAIL` | Verified email/domain    | `onboarding@resend.dev`  |
| `GMAIL_RECIPIENT`   | Where to send jobs       | `your.email@example.com` |
| `JSEARCH_API_KEY`   | Your RapidAPI key        | `xxx...`                 |
| `OPENAI_API_KEY`    | Your OpenAI key          | `sk-xxx...`              |

**Add these 5 secrets** in your repository settings.

---

## Step 5: Create GitHub Workflow

File: `.github/workflows/job-email-automation.yml`

```yaml
name: Weekly Job Email Automation

on:
  schedule:
    # Run every Monday at 9 AM UTC
    - cron: '0 9 * * 1'
  # Also allow manual triggering
  workflow_dispatch:

jobs:
  send-job-digest:
    runs-on: ubuntu-latest

    env:
      # Resend Configuration (from GitHub Secrets)
      EMAIL_PROVIDER: resend
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
      RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
      GMAIL_RECIPIENT: ${{ secrets.GMAIL_RECIPIENT }}
      JSEARCH_API_KEY: ${{ secrets.JSEARCH_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run automation
        run: npm run automate
```

**Save this file** in your repository at `.github/workflows/job-email-automation.yml`

---

## Step 6: Test Locally (Before GitHub)

```bash
# Update your local .env
cd "C:\Users\juans\Documents\GitHub\automatitation"

echo 'EMAIL_PROVIDER=resend' >> .env
echo 'RESEND_API_KEY=YOUR_API_KEY_HERE' >> .env
echo 'RESEND_FROM_EMAIL=onboarding@resend.dev' >> .env
echo 'GMAIL_RECIPIENT=your.email@example.com' >> .env

# Test npx tsx scripts/test-email.ts
```

---

## Step 7: Test with GitHub Actions

Go to GitHub and trigger the workflow manually:

1. Go to: https://github.com/byAyes/automatitation/actions
2. Click on your workflow: **"Weekly Job Email Automation"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch the logs as it runs

**Expected successful output:**

```
✓ Checkout code
✓ Setup Node.js
✓ Install dependencies
✓ Run automation
Notice: [2026-04-23T...] ✓ Starting Job Email Automation Pipeline
Notice: [2026-04-23T...] ✓ Scraped 10 jobs from all boards
Notice: [2026-04-23T...] ✓ Email sent successfully via Resend
✓ Pipeline completed successfully
```

---

## Step 8: Enable Scheduled Runs

The workflow will now run automatically every **Monday at 9 AM UTC**.

**To change schedule:** Edit `.github/workflows/job-email-automation.yml`:

```yaml
# Example: Every Tuesday at 8 AM
cron: '0 8 * * 2'

# Example: Daily at 9 AM UTC
cron: '0 9 * * *'

# Example: Every weekday at 7 AM UTC
cron: '0 7 * * 1-5'
```

**Use cron syntax:** `minute hour day month weekday`

---

## 🐛 Troubleshooting

### Error: "Unable to load credentials"

**Fix**: Secrets not set or misspelled. Check:

- Go to: https://github.com/byAyes/automatitation/settings/secrets/actions
- Verify all 5 secrets exist and are spelled exactly:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `GMAIL_RECIPIENT`
  - `JSEARCH_API_KEY`
  - `OPENAI_API_KEY`

### Error: "Invalid API key" (403 Forbidden)

**Fix**: API key is wrong. In GitHub:

1. Go to Secrets → Click **"Update"** on `RESEND_API_KEY`
2. Regenerate key at: https://resend.com/api-keys
3. Paste new key and click **"Update secret"**

### Error: "Invalid from address"

**Fix**: Use `onboarding@resend.dev` (pre-verified) or verify your own domain:

1. Go to: https://resend.com/domains
2. Click "Add Domain"
3. Add DNS records to your domain
4. Update `RESEND_FROM_EMAIL` secret to your verified domain

### Error: "Unable to find node"

**Fix**: Node.js version issue. Edit workflow:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
```

### Workflow not triggering on schedule

**Fix**: GitHub disables scheduled workflows after 60 days of repo inactivity. Manually run it to re-enable.

---

## 🔒 GitHub Secrets Best Practices

✅ **DO:**

- Use secrets for ALL sensitive data (API keys, emails)
- Rotate keys regularly (generate new ones monthly)
- Use different keys for different environments

❌ **DON'T:**

- Hardcode API keys in code or `.env` files
- Commit `.env` to git (it's in `.gitignore` for a reason)
- Share API keys in messages/chats

---

## 📊 Resend Dashboard

Monitor your email usage:

```
https://resend.com/dashboard
```

**Track:**

- Emails sent, delivered, bounced
- API usage
- Rate limits

---

## ✅ Summary

✅ **Resend account**: Created at resend.com  
✅ **API key generated**: Stored in GitHub Secrets  
✅ **Sender verified**: Using onboarding@resend.dev  
✅ **GitHub Secrets**: RESEND_API_KEY, RESEND_FROM_EMAIL, JSEARCH_API_KEY, OPENAI_API_KEY, GMAIL_RECIPIENT  
✅ **Workflow**: Created at `.github/workflows/job-email-automation.yml`  
✅ **Test**: Manually triggered and email received

**Done!** Your job automation runs automatically every Monday at 9 AM UTC via GitHub Actions using encrypted secrets! 🚀

---

## 🔧 Maintenance

### Updating Resend API Key (Monthly rotation)

1. Go to: https://resend.com/api-keys
2. Create new key
3. Update secret: https://github.com/byAyes/automatitation/settings/secrets/actions
4. Click "Update" on RESEND_API_KEY
5. No code changes needed!

### Changing Schedule

Edit `.github/workflows/job-email-automation.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 * * *' # Change this


  # Help: https://crontab.guru/
```

### Adding New Secrets

For new integrations:

1. Go to: https://github.com/byAyes/automatitation/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `NEW_SECRET_NAME`
4. Value: Your secret value
5. In workflow: `${{ secrets.NEW_SECRET_NAME }}`

---

## 📚 Resources

- **Workflow file**: `.github/workflows/job-email-automation.yml`
- **Resend docs**: https://resend.com/docs
- **GitHub Actions docs**: https://docs.github.com/actions
- **Cron syntax**: https://crontab.guru
- **API dashboard**: https://resend.com/api-keys

Enjoy your automated job alerts via Resend + GitHub Actions! 🎯
