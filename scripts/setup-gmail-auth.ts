import { getAuthUrl, exchangeCodeForTokens } from '../src/lib/email/gmail';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function updateEnvFile(accessToken: string, refreshToken: string | null) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Remove existing token lines
  const lines = envContent
    .split('\n')
    .filter(
      (line) => !line.startsWith('GMAIL_ACCESS_TOKEN=') && !line.startsWith('GMAIL_REFRESH_TOKEN='),
    );

  // Add new tokens
  lines.push(`GMAIL_ACCESS_TOKEN=${accessToken}`);
  if (refreshToken) {
    lines.push(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
  }

  fs.writeFileSync(envPath, lines.join('\n'));
  console.log('\n✅ Updated .env file with new tokens');
}

async function setupGmailAuth() {
  console.log('\n=== Gmail OAuth2 Setup ===\n');

  console.log('📋 Before you begin:');
  console.log('1. Go to: https://console.cloud.google.com/');
  console.log('2. Create a new project or select existing');
  console.log('3. Enable Gmail API');
  console.log('4. Create OAuth2 credentials (Web application)');
  console.log('5. Add authorized redirect URI: http://localhost:3000/oauth2callback');
  console.log('');

  const clientId = await prompt('Enter your GOOGLE_CLIENT_ID: ');
  const clientSecret = await prompt('Enter your GOOGLE_CLIENT_SECRET: ');

  // Update .env with credentials
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

  const lines = envContent
    .split('\n')
    .filter(
      (line) => !line.startsWith('GOOGLE_CLIENT_ID=') && !line.startsWith('GOOGLE_CLIENT_SECRET='),
    );

  lines.push(`GOOGLE_CLIENT_ID=${clientId}`);
  lines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);

  fs.writeFileSync(envPath, lines.join('\n'));

  console.log('\n✅ Updated .env with credentials');
  console.log('\n🌐 Now opening authorization URL...\n');

  // Set env vars for this session
  process.env.GOOGLE_CLIENT_ID = clientId;
  process.env.GOOGLE_CLIENT_SECRET = clientSecret;

  const authUrl = getAuthUrl();
  console.log('Open this URL in your browser:');
  console.log(authUrl);
  console.log('\n');

  const code = await prompt('After authorizing, paste the code here: ');

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code.trim());

    console.log('\n=== Success! ===');
    console.log('Tokens generated successfully!');

    await updateEnvFile(accessToken, refreshToken);

    console.log('\n🎉 Setup complete! You can now run:');
    console.log('   npm run automate\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    rl.close();
  }
}

setupGmailAuth().catch(console.error);
