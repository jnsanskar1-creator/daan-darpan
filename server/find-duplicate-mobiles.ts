import XLSX from 'xlsx';
import { db } from './db';
import { users } from '@shared/schema';
import * as path from 'path';

async function findDuplicateMobiles() {
  try {
    console.log('Fetching all users from database...');
    
    // Get all users from database
    const allUsers = await db.select().from(users).orderBy(users.serialNumber);
    console.log(`Total users in database: ${allUsers.length}`);

    // Group users by mobile number
    const mobileGroups: { [mobile: string]: typeof allUsers } = {};
    
    allUsers.forEach(user => {
      const mobile = user.mobile.trim();
      if (mobile) {
        if (!mobileGroups[mobile]) {
          mobileGroups[mobile] = [];
        }
        mobileGroups[mobile].push(user);
      }
    });

    // Find mobile numbers with duplicates
    const duplicateMobiles = Object.entries(mobileGroups)
      .filter(([mobile, userList]) => userList.length > 1)
      .sort(([a], [b]) => a.localeCompare(b));

    console.log(`Found ${duplicateMobiles.length} mobile numbers with duplicates`);

    // Create data for Excel export
    const duplicateUsersData: any[] = [];
    let totalDuplicateUsers = 0;

    duplicateMobiles.forEach(([mobile, userList]) => {
      console.log(`Mobile ${mobile}: ${userList.length} users`);
      
      userList.forEach((user, index) => {
        duplicateUsersData.push({
          'username': user.username,
          'password': 'password123', // Default password for all users
          'name': user.name,
          'email': user.email,
          'mobile': mobile,
          'address': user.address,
          'role': user.role,
          'status': user.status,
          'serial_number': user.serialNumber,
          'duplicate_count': userList.length,
          'duplicate_position': index + 1
        });
        totalDuplicateUsers++;
      });
    });

    console.log(`Total users with duplicate mobile numbers: ${totalDuplicateUsers}`);

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['Total Users in Database', allUsers.length],
      ['Unique Mobile Numbers', Object.keys(mobileGroups).length],
      ['Mobile Numbers with Duplicates', duplicateMobiles.length],
      ['Total Users with Duplicate Mobiles', totalDuplicateUsers],
      [''],
      ['Mobile Number', 'Duplicate Count'],
      ...duplicateMobiles.map(([mobile, userList]) => [mobile, userList.length])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Detailed users sheet
    const detailedSheet = XLSX.utils.json_to_sheet(duplicateUsersData);
    XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Duplicate Mobile Users');

    // Write the file
    const fileName = `Duplicate_Mobile_Users_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(process.cwd(), '..', fileName);
    
    XLSX.writeFile(workbook, filePath);
    console.log(`\nExcel file created: ${fileName}`);
    console.log(`File path: ${filePath}`);

    // Create summary report
    console.log('\n=== DUPLICATE MOBILE NUMBERS SUMMARY ===');
    console.log(`Total users in database: ${allUsers.length}`);
    console.log(`Users with duplicate mobile numbers: ${totalDuplicateUsers}`);
    console.log(`Mobile numbers with duplicates: ${duplicateMobiles.length}`);
    console.log(`Percentage of users with duplicate mobiles: ${((totalDuplicateUsers / allUsers.length) * 100).toFixed(2)}%`);

    console.log('\n=== TOP 10 MOST DUPLICATED MOBILE NUMBERS ===');
    const topDuplicates = duplicateMobiles
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10);
    
    topDuplicates.forEach(([mobile, userList]) => {
      console.log(`${mobile}: ${userList.length} users`);
    });

    return {
      totalUsers: allUsers.length,
      duplicateUsers: totalDuplicateUsers,
      duplicateMobiles: duplicateMobiles.length,
      fileName: fileName
    };

  } catch (error) {
    console.error('Error finding duplicate mobiles:', error);
    throw error;
  }
}

// Run the analysis
findDuplicateMobiles()
  .then(result => {
    console.log('\n=== ANALYSIS COMPLETE ===');
    console.log(`Excel file ready for download: ${result.fileName}`);
    console.log(`Found ${result.duplicateUsers} users with duplicate mobile numbers`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });