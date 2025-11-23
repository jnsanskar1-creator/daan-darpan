// Helper function to update receipt_numbers field from payments array
export function calculateReceiptNumbers(payments: any[]): string {
    if (!Array.isArray(payments)) return '';

    return payments
        .map(p => p.receiptNo)
        .filter(r => r && r.trim() !== '')
        .join(', ');
}
