import XLSX from 'xlsx';
import { db } from './db';
import { users } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

interface ExcelUser {
  name: string;
  username: string;
  email: string;
  mobile: string;
  address: string;
  role: string;
  status: string;
}

interface DatabaseUser {
  id: number;
  serialNumber: number;
  username: string;
  name: string;
  email: string;
  mobile: string;
  address: string;
  role: string;
  status: string;
}

async function analyzeExcelFile() {
  try {
    // Read Excel file
    console.log('Reading Excel file...');
    const filePath = path.join(process.cwd(), '..', 'attached_assets', 'Shivnagar Worksheet_1754753646977.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const excelData: any[] = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${excelData.length} rows in Excel file`);

    // Get all users from database
    console.log('Fetching users from database...');
    const dbUsers: DatabaseUser[] = await db.select().from(users);
    console.log(`Found ${dbUsers.length} users in database`);

    // Normalize and compare data
    const missingUsers: ExcelUser[] = [];
    
    for (const excelRow of excelData) {
      // Normalize Excel row data
      const excelUser: ExcelUser = {
        name: String(excelRow.Name || excelRow.name || '').trim(),
        username: String(excelRow.Username || excelRow.username || '').trim(),
        email: String(excelRow.Email || excelRow.email || '').trim().toLowerCase(),
        mobile: String(excelRow.Mobile || excelRow.mobile || excelRow.phone || '').trim(),
        address: String(excelRow.Address || excelRow.address || '').trim(),
        role: String(excelRow.Role || excelRow.role || 'viewer').trim().toLowerCase(),
        status: String(excelRow.Status || excelRow.status || 'active').trim().toLowerCase()
      };

      // Skip empty rows
      if (!excelUser.name && !excelUser.username && !excelUser.email) {
        continue;
      }

      // Check if this user's address exists in database
      const addressExistsInDb = dbUsers.some(dbUser => {
        // Compare only address field (case-insensitive)
        const addressMatch = dbUser.address.toLowerCase().trim() === excelUser.address.toLowerCase();
        return addressMatch;
      });

      // Check if this user's mobile exists in database
      const mobileExistsInDb = dbUsers.some(dbUser => {
        // Compare only mobile field (exact match)
        const mobileMatch = dbUser.mobile.trim() === excelUser.mobile.trim();
        return mobileMatch;
      });

      // Only include users where BOTH address and mobile are new (not found in database)
      if (!addressExistsInDb && !mobileExistsInDb) {
        missingUsers.push(excelUser);
      }
    }

    console.log(`Found ${missingUsers.length} users with new addresses AND new mobiles`);

    // Create differential Excel file
    if (missingUsers.length > 0) {
      const newWorkbook = XLSX.utils.book_new();
      const newWorksheet = XLSX.utils.json_to_sheet(missingUsers);
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'New Address & Mobile Users');
      
      const outputPath = path.join(process.cwd(), 'Address_Mobile_Differential_Users.xlsx');
      XLSX.writeFile(newWorkbook, outputPath);
      console.log(`Address and mobile differential Excel file created: ${outputPath}`);
    }

    // Return summary
    return {
      totalExcelRows: excelData.length,
      totalDbUsers: dbUsers.length,
      missingUsersCount: missingUsers.length,
      missingUsers: missingUsers,
      outputFile: missingUsers.length > 0 ? 'Address_Mobile_Differential_Users.xlsx' : null
    };

  } catch (error) {
    console.error('Error analyzing Excel file:', error);
    throw error;
  }
}

// Run the analysis
analyzeExcelFile()
  .then(result => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log(`Total rows in Excel: ${result.totalExcelRows}`);
    console.log(`Total users in database: ${result.totalDbUsers}`);
    console.log(`Users with new addresses AND mobiles: ${result.missingUsersCount}`);
    if (result.outputFile) {
      console.log(`Address and mobile differential file created: ${result.outputFile}`);
    } else {
      console.log('No new addresses and mobiles found - all Excel data exists in database');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });