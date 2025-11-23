import XLSX from 'xlsx';
import { db } from './db';
import { users } from '@shared/schema';
import * as path from 'path';

async function investigateDuplicates() {
  try {
    console.log('Reading differential Excel file...');
    const filePath = path.join(process.cwd(), '..', 'Address_Mobile_Differential_Users.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const excelData: any[] = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${excelData.length} users in differential file`);

    // Get all database users
    const dbUsers = await db.select().from(users);
    console.log(`Found ${dbUsers.length} users in database`);

    // Check first 5 users for detailed comparison
    console.log('\n=== DETAILED COMPARISON OF FIRST 5 USERS ===');
    
    for (let i = 0; i < Math.min(5, excelData.length); i++) {
      const excelRow = excelData[i];
      const excelUser = {
        name: String(excelRow.name || '').trim(),
        username: String(excelRow.username || '').trim(),
        email: String(excelRow.email || '').trim().toLowerCase(),
        mobile: String(excelRow.mobile || '').trim(),
        address: String(excelRow.address || '').trim()
      };

      console.log(`\n--- Excel User ${i + 1} ---`);
      console.log(`Name: ${excelUser.name}`);
      console.log(`Username: ${excelUser.username}`);
      console.log(`Email: ${excelUser.email}`);
      console.log(`Mobile: ${excelUser.mobile}`);
      console.log(`Address: ${excelUser.address}`);

      // Find matching database users by different criteria
      const usernameMatch = dbUsers.find(u => u.username.toLowerCase() === excelUser.username.toLowerCase());
      const emailMatch = dbUsers.find(u => u.email.toLowerCase() === excelUser.email.toLowerCase());
      const mobileMatch = dbUsers.find(u => u.mobile.trim() === excelUser.mobile.trim());
      const addressMatch = dbUsers.find(u => u.address.toLowerCase().trim() === excelUser.address.toLowerCase());

      console.log(`Database matches:`);
      if (usernameMatch) {
        console.log(`  Username match: ${usernameMatch.name} (${usernameMatch.username}) - Mobile: ${usernameMatch.mobile}, Address: ${usernameMatch.address}`);
      } else {
        console.log(`  Username match: NONE`);
      }
      
      if (emailMatch) {
        console.log(`  Email match: ${emailMatch.name} (${emailMatch.username})`);
      } else {
        console.log(`  Email match: NONE`);
      }
      
      if (mobileMatch) {
        console.log(`  Mobile match: ${mobileMatch.name} (${mobileMatch.username})`);
      } else {
        console.log(`  Mobile match: NONE`);
      }
      
      if (addressMatch) {
        console.log(`  Address match: ${addressMatch.name} (${addressMatch.username})`);
      } else {
        console.log(`  Address match: NONE`);
      }
    }

    // Count unique vs duplicate usernames in Excel
    const excelUsernames = excelData.map(row => String(row.username || '').trim().toLowerCase());
    const uniqueUsernames = new Set(excelUsernames);
    console.log(`\n=== USERNAME ANALYSIS ===`);
    console.log(`Total users in Excel: ${excelData.length}`);
    console.log(`Unique usernames in Excel: ${uniqueUsernames.size}`);
    console.log(`Duplicate usernames in Excel: ${excelData.length - uniqueUsernames.size}`);

    // Check how many Excel usernames already exist in database
    const dbUsernames = new Set(dbUsers.map(u => u.username.toLowerCase()));
    const existingCount = excelUsernames.filter(username => dbUsernames.has(username)).length;
    console.log(`Excel usernames that exist in database: ${existingCount}`);
    console.log(`Excel usernames that don't exist in database: ${excelUsernames.length - existingCount}`);

  } catch (error) {
    console.error('Error investigating:', error);
  }
}

investigateDuplicates();