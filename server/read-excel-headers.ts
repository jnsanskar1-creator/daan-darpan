import XLSX from 'xlsx';
import * as path from 'path';

async function readExcelHeaders() {
  try {
    console.log('Reading original Excel file headers...');
    const filePath = path.join(process.cwd(), '..', 'attached_assets', 'Shivnagar Worksheet_1754753646977.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get first row (headers)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const headers: string[] = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        headers.push(String(cell.v));
      }
    }
    
    console.log('Excel Headers:', headers);
    
    // Also get first few rows to see data structure
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 5 }); // First 5 rows
    console.log('Sample data structure:');
    console.log(jsonData[0]);
    
    return headers;
    
  } catch (error) {
    console.error('Error reading Excel file:', error);
    throw error;
  }
}

readExcelHeaders();