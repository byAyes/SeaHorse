import { getAuthUrl, exchangeCodeForTokens } from '../src/lib/email/gmail';
import * as readline from 'readline';

async function generateToken() {
  console.log('=== Gmail OAuth2 Token Generator ===\n');

  // 1. Show authorization URL
  const authUrl = getAuthUrl();
  console.log('1. Open this URL in your browser:');
  console.log(authUrl);
  console.log('\n');

  // 2. Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 3. Get authorization code from user
  const code = await new Promise<string>((resolve) => {
    rl.question('2. Paste the authorization code: ', (code) => {
      resolve(code);
    });
  });

  // 4. Exchange code for tokens
  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code.trim());

    console.log('\n=== SUCCESS! ===\n');
    console.log('Add these to your .env file:\n');
    console.log(`GMAIL_ACCESS_TOKEN=${accessToken}`);
    console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
    console.log('\nYour tokens have been generated!');
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
  } finally {
    rl.close();
  }
}

generateToken().catch(console.error);
