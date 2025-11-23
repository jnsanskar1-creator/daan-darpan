import XLSX from 'xlsx';
import { db } from './db';
import { users } from '@shared/schema';
import * as path from 'path';
import bcrypt from 'bcrypt';

interface ExcelUser {
  name: string;
  username: string;
  email: string;
  mobile: string;
  address: string;
  role: string;
  status: string;
}

async function bulkImportUsers() {
  try {
    console.log('Reading differential Excel file...');
    const filePath = path.join(process.cwd(), '..', 'Address_Mobile_Differential_Users.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const excelData: any[] = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${excelData.length} users to import`);

    // Get current user count before import
    const currentUsers = await db.select().from(users);
    const currentCount = currentUsers.length;
    console.log(`Current users in database: ${currentCount}`);

    // Get the highest serial number to continue from
    const maxSerialNumber = Math.max(...currentUsers.map(u => u.serialNumber), 0);
    console.log(`Highest serial number: ${maxSerialNumber}`);

    // Create sets of existing usernames and emails for quick lookup
    const existingUsernames = new Set(currentUsers.map(u => u.username.toLowerCase()));
    const existingEmails = new Set(currentUsers.map(u => u.email.toLowerCase()));
    console.log(`Existing usernames: ${existingUsernames.size}, emails: ${existingEmails.size}`);

    let importedCount = 0;
    let skippedCount = 0;
    let nextSerialNumber = maxSerialNumber + 1;

    for (const [index, excelRow] of excelData.entries()) {
      try {
        // Normalize Excel row data
        const excelUser: ExcelUser = {
          name: String(excelRow.name || '').trim(),
          username: String(excelRow.username || '').trim(),
          email: String(excelRow.email || '').trim().toLowerCase(),
          mobile: String(excelRow.mobile || '').trim(),
          address: String(excelRow.address || '').trim(),
          role: String(excelRow.role || 'viewer').trim().toLowerCase(),
          status: String(excelRow.status || 'active').trim().toLowerCase()
        };

        // Skip empty rows
        if (!excelUser.name || !excelUser.username || !excelUser.email) {
          console.log(`Skipping row ${index + 1}: Missing required fields`);
          skippedCount++;
          continue;
        }

        // Handle duplicate usernames by adding suffix
        let finalUsername = excelUser.username;
        let usernameCounter = 1;
        while (existingUsernames.has(finalUsername.toLowerCase())) {
          finalUsername = `${excelUser.username}${usernameCounter}`;
          usernameCounter++;
        }
        
        if (finalUsername !== excelUser.username) {
          console.log(`Modified username from '${excelUser.username}' to '${finalUsername}'`);
        }

        // Handle duplicate emails by adding suffix
        let finalEmail = excelUser.email;
        let emailCounter = 1;
        while (existingEmails.has(finalEmail.toLowerCase())) {
          const emailParts = excelUser.email.split('@');
          if (emailParts.length === 2) {
            finalEmail = `${emailParts[0]}${emailCounter}@${emailParts[1]}`;
          } else {
            finalEmail = `${excelUser.email}${emailCounter}`;
          }
          emailCounter++;
        }
        
        if (finalEmail !== excelUser.email) {
          console.log(`Modified email from '${excelUser.email}' to '${finalEmail}'`);
        }

        // Validate role
        if (!['admin', 'operator', 'viewer'].includes(excelUser.role)) {
          excelUser.role = 'viewer';
        }

        // Validate status
        if (!['active', 'inactive'].includes(excelUser.status)) {
          excelUser.status = 'active';
        }

        // Create user with auto-generated password (can be changed later)
        const defaultPassword = 'password123'; // Users should change this

        // Insert user with serial number using final (unique) values
        await db.insert(users).values({
          serialNumber: nextSerialNumber,
          username: finalUsername,
          password: defaultPassword,
          name: excelUser.name,
          email: finalEmail,
          mobile: excelUser.mobile,
          address: excelUser.address,
          role: excelUser.role as 'admin' | 'operator' | 'viewer',
          status: excelUser.status
        });

        // Add to existing sets to prevent duplicates in the same batch
        existingUsernames.add(finalUsername.toLowerCase());
        existingEmails.add(finalEmail.toLowerCase());

        console.log(`Imported user ${nextSerialNumber}: ${excelUser.name} (${finalUsername})`);
        importedCount++;
        nextSerialNumber++;

      } catch (error) {
        console.error(`Error importing user at row ${index + 1}:`, error);
        skippedCount++;
      }
    }

    // Get final user count
    const finalUsers = await db.select().from(users);
    const finalCount = finalUsers.length;

    console.log('\n=== BULK IMPORT COMPLETE ===');
    console.log(`Users before import: ${currentCount}`);
    console.log(`Users imported: ${importedCount}`);
    console.log(`Users skipped: ${skippedCount}`);
    console.log(`Users after import: ${finalCount}`);
    console.log(`Total increase: ${finalCount - currentCount}`);

    return {
      beforeCount: currentCount,
      importedCount,
      skippedCount,
      afterCount: finalCount,
      increase: finalCount - currentCount
    };

  } catch (error) {
    console.error('Error during bulk import:', error);
    throw error;
  }
}

// Run the import
bulkImportUsers()
  .then(result => {
    console.log('\n=== FINAL SUMMARY ===');
    console.log(`Successfully imported ${result.importedCount} users`);
    console.log(`Database now contains ${result.afterCount} total users`);
    console.log(`Net increase: ${result.increase} users`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Bulk import failed:', error);
    process.exit(1);
  });