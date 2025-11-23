import postgres from 'postgres';
import bcrypt from 'bcrypt';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRODUCTION_DATABASE_URL = 'postgresql://neondb_owner:npg_mBci23HfkDMX@ep-wandering-boat-a6irfxyp.us-west-2.aws.neon.tech/neondb?sslmode=require';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function regenerateAllPasswords() {
  const client = postgres(PRODUCTION_DATABASE_URL);
  
  try {
    console.log('✅ Connected to production database');

    const result = await client`SELECT id, username, role FROM users ORDER BY id`;
    console.log(`📊 Found ${result.length} users`);

    const userCredentials: Array<{
      'Serial No': number;
      'Username': string;
      'Password': string;
      'Role': string;
    }> = [];

    for (let i = 0; i < result.length; i++) {
      const user = result[i];
      const newPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await client`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`;

      userCredentials.push({
        'Serial No': i + 1,
        'Username': user.username,
        'Password': newPassword,
        'Role': user.role
      });

      if ((i + 1) % 100 === 0) {
        console.log(`✅ Processed ${i + 1}/${result.length} users`);
      }
    }

    console.log('✅ All passwords updated in database');

    const worksheet = XLSX.utils.json_to_sheet(userCredentials);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Credentials');

    const exportsDir = join(__dirname, '..', 'exports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const filename = join(exportsDir, `PRODUCTION_user_credentials_${timestamp}.xlsx`);
    
    XLSX.writeFile(workbook, filename);
    console.log(`✅ Excel file saved: ${filename}`);

    console.log('\n📋 Sample credentials (first 5 users):');
    userCredentials.slice(0, 5).forEach(u => {
      console.log(`  ${u.Username}: ${u.Password} (${u.Role})`);
    });

    await client.end();
    console.log('\n✅ Process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await client.end();
    process.exit(1);
  }
}

regenerateAllPasswords();
