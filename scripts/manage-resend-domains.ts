import { config } from 'dotenv';
import { ResendProvider } from '../src/lib/email/providers/resend';

config();

async function manageResendDomains() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.error('Missing required environment variables: RESEND_API_KEY and RESEND_FROM_EMAIL');
    process.exit(1);
  }

  console.log('🚀 Resend Domain Management Tool\n');

  const resend = new ResendProvider({ apiKey, fromEmail });

  try {
    // 1. List existing domains
    console.log('📋 Listing current domains...');
    const listResult = await resend.listDomains();

    if (listResult.success && listResult.domains) {
      console.log(`Found ${listResult.domains.length} domains:\n`);
      listResult.domains.forEach((domain) => {
        const status = domain.status === 'verified' ? '✅' : '⏳';
        console.log(`${status} ${domain.name} (${domain.status})`);
        console.log(`   Created: ${new Date(domain.created_at).toLocaleDateString()}`);
        if (domain.dns_records) {
          console.log('   DNS Records:');
          if (domain.dns_records.spf) {
            console.log(
              `   - SPF: ${domain.dns_records.spf.name} = ${domain.dns_records.spf.value}`,
            );
          }
          if (domain.dns_records.dkim) {
            console.log(
              `   - DKIM: ${domain.dns_records.dkim.name} = ${domain.dns_records.dkim.value}`,
            );
          }
        }
        console.log(`   ID: ${domain.id}\n`);
      });
    } else {
      console.error('Failed to list domains:', listResult.error);
    }

    // 2. Create a new domain (with subdomain for better deliverability)
    console.log('➕ Creating new domain with custom return path...\n');

    // Use subdomain for better deliverability and reputation
    // This follows Resend best practices from their documentation
    const newDomainRequest = {
      name: 'updates.example.com', // Using subdomain for email
      customReturnPath: 'outbound', // Custom return path for bounce handling
    };

    const createResult = await resend.createDomain(newDomainRequest);

    if (createResult.success && createResult.domain) {
      console.log('✅ Domain created successfully!');
      console.log(`   Name: ${createResult.domain.name}`);
      console.log(`   Status: ${createResult.domain.status}`);
      console.log(`   ID: ${createResult.domain.id}`);

      if (createResult.domain.dns_records) {
        console.log('\n🔧 DNS Configuration Required:');
        console.log('Add these DNS records to your domain to verify ownership and enable email:');

        if (createResult.domain.dns_records.spf) {
          console.log(`\n📋 SPF Record:`);
          console.log(`   Type: TXT`);
          console.log(`   Name: ${createResult.domain.dns_records.spf.name}`);
          console.log(`   Value: ${createResult.domain.dns_records.spf.value}`);
        }

        if (createResult.domain.dns_records.dkim) {
          console.log(`\n🔐 DKIM Record:`);
          console.log(`   Type: TXT`);
          console.log(`   Name: ${createResult.domain.dns_records.dkim.name}`);
          console.log(`   Value: ${createResult.domain.dns_records.dkim.value}`);
        }

        console.log('\n⚠️  After adding DNS records:');
        console.log('   - Allow 5-10 minutes for DNS propagation');
        console.log('   - Use resend.domains.verify() to check status');
      }
    } else {
      console.error('Failed to create domain:', createResult.error);
      console.log('💡 Tips for domain creation:');
      console.log('   1. Use subdomains (e.g., updates.example.com) for better deliverability');
      console.log('   2. Ensure customReturnPath is ≤ 63 characters');
      console.log('   3. Name must start/end with alphanumeric characters');
      console.log('   4. Only use letters, numbers, and hyphens in names');
    }

    // 3. Get specific domain details (if we have domains)
    if (listResult.success && listResult.domains && listResult.domains.length > 0) {
      const firstDomain = listResult.domains[0];
      console.log(`\n🔍 Getting details for ${firstDomain.name}...`);

      const getResult = await resend.getDomain(firstDomain.id);

      if (getResult.success && getResult.domain) {
        console.log('✅ Domain retrieved successfully!');
        console.log(`   Status: ${getResult.domain.status}`);
        console.log(`   Created: ${new Date(getResult.domain.created_at).toLocaleString()}`);
      } else {
        console.error('Failed to get domain:', getResult.error);
      }
    }

    // 4. Domain Best Practices Summary
    console.log('\n\n📚 Resend Domain Best Practices:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Use subdomains (e.g., updates.example.com)');
    console.log('✓ Verify both SPF and DKIM records');
    console.log('✓ Allow 5-10 minutes for DNS propagation');
    console.log('✓ Monitor verification status via dashboard or API');
    console.log('✓ Use custom return paths for better bounce handling');
    console.log('✓ Domain names ≤63 characters, start/end with alphanumeric');
    console.log('✓ Track email delivery metrics in Resend dashboard');
    console.log('✓ Use verified domains for consistent sender reputation');

    console.log('\n\n🎯 Next Steps:');
    console.log('1. Add the DNS records shown above to your domain provider');
    console.log('2. Wait for DNS propagation (5-10 minutes)');
    console.log('3. Verify domain status using this script again');
    console.log('4. Update ENV variables with verified domain/email');
    console.log('5. Send test emails from your verified domain');
  } catch (error) {
    console.error('Error managing domains:', error);
    process.exit(1);
  }
}

export { manageResendDomains };

// Run directly: npx tsx scripts/manage-resend-domains.ts
// The auto-execution with import.meta.url is not used here to maintain
// compatibility with CommonJS transforms in test environments.
// Callers should invoke manageResendDomains() directly.
