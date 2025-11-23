import React from 'react';
import { Button } from '@/components/ui/button';
import { type Entry, type PaymentRecord } from '@shared/schema';
import { formatDate } from '@/lib/utils';

interface PaymentReceiptProps {
  entry: Entry;
  payment: PaymentRecord;
  onClose: () => void;
}

export function PaymentReceipt({ entry, payment, onClose }: PaymentReceiptProps) {
  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Helper functions for Hindi conversion
    const getPaymentModeHindi = (mode: string): string => {
      const modeMap: { [key: string]: string } = {
        'cash': 'नगद',
        'upi': 'यूपीआई', 
        'cheque': 'चेक',
        'netbanking': 'नेट बैंकिंग',
        'advance_payment': 'अग्रिम भुगतान'
      };
      return modeMap[mode.toLowerCase()] || mode;
    };

    const formatHindiDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleDateString('hi-IN', {
        day: '2-digit',
        month: '2-digit', 
        year: '2-digit'
      });
    };

    // Add cache breaker for images
    const cacheBreaker = Date.now();

    const html = `
      <!DOCTYPE html>
      <html lang="hi">
        <head>
          <meta charset="UTF-8">
          <title>बोली रसीद: ${payment.receiptNo || 'रसीद'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
            
            body {
              font-family: 'Noto Sans Devanagari', 'Arial', sans-serif;
              margin: 0;
              padding: 5px;
              background-color: #f5f5f5;
              color: #000;
              font-size: 14px;
              line-height: 1.4;
            }
            
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              border: 2px solid #000;
              border-radius: 8px;
              padding: 0;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .receipt-header {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 12px;
              border-bottom: 3px solid #000;
              background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
              position: relative;
            }
            
            .left-logo {
              position: absolute;
              top: 12px;
              left: 15px;
              width: 60px;
              height: 60px;
              object-fit: contain;
            }
            
            .center-content {
              flex-grow: 1;
              text-align: center;
              margin: 0 20px;
            }
            
            .temple-name {
              font-size: 18px;
              font-weight: 700;
              margin: 5px 0 3px 0;
              color: #d97706;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
            }
            
            .temple-subtitle {
              font-size: 11px;
              color: #374151;
              margin: 3px 0;
              font-weight: 500;
            }
            
            .receipt-title {
              font-size: 14px;
              font-weight: 700;
              color: #1f2937;
              margin: 8px 0 3px 0;
              padding: 6px 12px;
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 4px;
              display: inline-block;
            }
            
            .right-logo {
              position: absolute;
              top: 12px;
              right: 15px;
              width: 60px;
              height: 60px;
              object-fit: contain;
            }
            
            .receipt-body {
              padding: 10px 15px;
              flex: 1;
            }
            
            .info-section {
              margin-bottom: 12px;
            }
            
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
              font-size: 11px;
            }
            
            .left-info, .right-info {
              flex: 1;
              color: #333;
            }
            
            .left-info {
              text-align: left;
            }
            
            .right-info {
              text-align: right;
            }
            
            .amount-section {
              background: #f3f4f6;
              padding: 15px;
              border: 1px solid #d1d5db;
              margin: 20px 0;
              text-align: center;
            }
            
            .amount-hindi {
              font-size: 18px;
              font-weight: 700;
              color: #dc2626;
            }
            
            .signature-area {
              margin-top: 20px;
              display: flex;
              justify-content: space-between;
              align-items: end;
            }
            
            .signature-box {
              width: 180px;
              text-align: center;
            }
            
            .signature-line {
              border-top: 1px solid #000;
              padding-top: 6px;
              margin-top: 30px;
              font-size: 11px;
            }
            
            @media print {
              .no-print { display: none; }
              body { padding: 10px; }
              .receipt-container { max-width: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header with logos -->
            <div class="receipt-header">
              <img src="/uploads/jain-stabh-logo.jpg?v=${cacheBreaker}" alt="जैन स्तंभ" class="left-logo">
              
              <div class="center-content">
                <div class="temple-name">श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति</div>
                <div class="temple-subtitle">शिवनगर, जबलपुर (म.प्र.)</div>
                <div class="receipt-title">बोली भुगतान रसीद</div>
              </div>
              
              <img src="/uploads/new-logo-mandir-color.jpg?v=${cacheBreaker}" alt="मंदिर लोगो" class="right-logo">
            </div>
            
            <!-- Receipt body -->
            <div class="receipt-body">
              <div class="info-section">
                <div class="info-row">
                  <div class="left-info">अनुक्रमांक: ${payment.receiptNo || 'N/A'}</div>
                  <div class="right-info">दिनांक: ${formatHindiDate(payment.date)}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">धर्मानुयायी: श्री/श्रीमती/सुश्री ${entry.userName}</div>
                  <div class="right-info">बोली दिनांक: ${formatHindiDate(entry.auctionDate)}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">पता: ${entry.userAddress || 'पता उपलब्ध नहीं'}</div>
                  <div class="right-info">भुगतान विधि: ${getPaymentModeHindi(payment.mode)}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">बाबत: ${entry.description}</div>
                  <div class="right-info">बेदी क्रमांक: ${entry.bediNumber}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">विशेष अवसर: ${entry.occasion}</div>
                  <div class="right-info"></div>
                </div>
              </div>
              
              <!-- Amount section -->
              <div class="amount-section">
                <div style="margin-bottom: 10px;">
                  <strong>भुगतान राशि: ₹${payment.amount.toLocaleString()}</strong>
                </div>
                <div style="font-size: 12px; color: #666;">
                  कुल राशि: ₹${entry.totalAmount.toLocaleString()} | 
                  शेष राशि: ₹${entry.pendingAmount.toLocaleString()}
                </div>
              </div>
              
              <!-- Signature area -->
              <div class="signature-area">
                <div class="signature-box">
                  <div class="signature-line">धर्मानुयायी के हस्ताक्षर</div>
                </div>
                <div class="signature-box">
                  <div class="signature-line">अधिकृत हस्ताक्षर</div>
                </div>
              </div>
              
            </div>
          </div>
          
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print();" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: 'Noto Sans Devanagari', Arial, sans-serif;">
              रसीद प्रिंट करें
            </button>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Payment Receipt</h2>
      <p className="text-sm text-gray-500 mb-4">Receipt No: {payment.receiptNo || 'N/A'}</p>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold">Name:</p>
          <p>{entry.userName}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Date:</p>
          <p>{formatDate(payment.date)}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Amount:</p>
          <p className="font-bold">₹{payment.amount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Payment Mode:</p>
          <p>{payment.mode.toUpperCase()}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Description:</p>
          <p>{entry.description}</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Occasion:</p>
          <p>{entry.occasion}</p>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={printReceipt}>Print Receipt</Button>
      </div>
    </div>
  );
}

export default PaymentReceipt;