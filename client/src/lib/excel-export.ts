import { utils, writeFile } from "xlsx";

// Common Excel export utility function
export function exportToExcel<T>(data: T[], filename: string, sheetName: string = "Data") {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }

  try {
    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, worksheet, sheetName);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const fullFilename = `${filename}_${timestamp}.xlsx`;
    
    writeFile(workbook, fullFilename);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Failed to export data to Excel");
  }
}

// Format data for export by removing unnecessary fields and flattening objects
export function formatDataForExport<T extends Record<string, any>>(
  data: T[], 
  fieldsToExclude: string[] = []
): Record<string, any>[] {
  return data.map(item => {
    const formatted: Record<string, any> = {};
    
    Object.entries(item).forEach(([key, value]) => {
      if (!fieldsToExclude.includes(key)) {
        // Handle nested objects by flattening them
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            formatted[`${key}_${nestedKey}`] = nestedValue;
          });
        } else {
          formatted[key] = value;
        }
      }
    });
    
    return formatted;
  });
}

// Specific export functions for different data types
export function exportBoliEntries(entries: any[]) {
  const formattedData = formatDataForExport(entries, ['payments']);
  exportToExcel(formattedData, "Boli_Entries", "Boli Entries");
}

export function exportUsers(users: any[]) {
  const formattedData = formatDataForExport(users, ['password']);
  exportToExcel(formattedData, "Users", "Users");
}

export function exportAdvancePayments(payments: any[]) {
  const formattedData = formatDataForExport(payments);
  exportToExcel(formattedData, "Advance_Payments", "Advance Payments");
}

export function exportDravyaEntries(entries: any[]) {
  const formattedData = formatDataForExport(entries);
  exportToExcel(formattedData, "Dravya_Entries", "Dravya Entries");
}

export function exportExpenseEntries(expenses: any[]) {
  const formattedData = formatDataForExport(expenses);
  exportToExcel(formattedData, "Expense_Entries", "Expense Entries");
}

export function exportPreviousOutstanding(records: any[]) {
  const formattedData = formatDataForExport(records, ['payments']);
  exportToExcel(formattedData, "Previous_Outstanding", "Previous Outstanding");
}

export function exportBoliPayments(payments: any[]) {
  const formattedData = formatDataForExport(payments);
  exportToExcel(formattedData, "Boli_Payments", "Boli Payments");
}