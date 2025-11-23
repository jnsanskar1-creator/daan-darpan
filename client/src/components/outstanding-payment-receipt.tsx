import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PreviousOutstandingRecord {
  id: number;
  userId: number;
  userName: string;
  userMobile: string;
  userAddress: string;
  outstandingAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  status: 'pending' | 'partial' | 'full';
  payments: PaymentRecord[];
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRecord {
  date: string;
  amount: number;
  mode: string;
  fileUrl?: string;
  receiptNo?: string;
  updatedBy?: string;
}

interface OutstandingPaymentReceiptProps {
  record: PreviousOutstandingRecord;
  payment: PaymentRecord;
  onClose: () => void;
}

// Editable receipt fields
interface ReceiptFields {
  dharmanuyayi: string;
  address: string;
  description: string;
  occasion: string;
  bediNumber: string;
}

const RECEIPT_FIELDS_KEY = 'outstanding_receipt_fields';

export function OutstandingPaymentReceipt({ record, payment, onClose }: OutstandingPaymentReceiptProps) {
  // Receipt fields state
  const [receiptFields, setReceiptFields] = useState<ReceiptFields>({
    dharmanuyayi: record.userName || '',
    address: record.userAddress || '',
    description: record.description || '',
    occasion: '',
    bediNumber: '1',
  });

  // Load saved values on component mount
  useEffect(() => {
    const saved = localStorage.getItem(RECEIPT_FIELDS_KEY);
    if (saved) {
      try {
        const savedFields = JSON.parse(saved);
        // Only use saved values for empty fields, don't overwrite data from record
        setReceiptFields(prev => ({
          ...prev,
          occasion: savedFields.occasion || '',
          bediNumber: savedFields.bediNumber || '1'
        }));
      } catch (error) {
        console.error('Error loading saved fields:', error);
      }
    }
  }, []);

  // Save fields to localStorage
  const handleSaveFields = () => {
    localStorage.setItem(RECEIPT_FIELDS_KEY, JSON.stringify(receiptFields));
    alert('फील्ड सफलतापूर्वक सहेजे गए!');
  };

  // Helper functions for Hindi conversion - exactly from boli receipt
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

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Add cache breaker for images - exactly from boli receipt
    const cacheBreaker = Date.now();

    const html = `
      <!DOCTYPE html>
      <html lang="hi">
        <head>
          <meta charset="UTF-8">
          <title>बकाया भुगतान रसीद: ${payment.receiptNo || 'रसीद'}</title>
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
            <!-- Header with logos - exactly from boli receipt -->
            <div class="receipt-header">
              <img src="/uploads/jain-stabh-logo.jpg?v=${cacheBreaker}" alt="जैन स्तंभ" class="left-logo">
              
              <div class="center-content">
                <div class="temple-name">श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति</div>
                <div class="temple-subtitle">शिवनगर, जबलपुर (म.प्र.)</div>
                <div class="receipt-title">भुगतान रसीद</div>
              </div>
              
              <img src="/uploads/new-logo-mandir-color.jpg?v=${cacheBreaker}" alt="मंदिर लोगो" class="right-logo">
            </div>
            
            <!-- Receipt body - exactly same structure as boli receipt -->
            <div class="receipt-body">
              <div class="info-section">
                <div class="info-row">
                  <div class="left-info">अनुक्रमांक: ${payment.receiptNo || 'N/A'}</div>
                  <div class="right-info">दिनांक: ${formatHindiDate(payment.date)}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">धर्मानुयायी: श्री/श्रीमती/सुश्री ${receiptFields.dharmanuyayi}</div>
                  <div class="right-info">भुगतान दिनांक: ${formatHindiDate(payment.date)}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">पता: ${receiptFields.address || 'पता उपलब्ध नहीं'}</div>
                  <div class="right-info">भुगतान विधि: ${getPaymentModeHindi(payment.mode)}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">बाबत: ${receiptFields.description}</div>
                  <div class="right-info">बेदी क्रमांक: ${receiptFields.bediNumber}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">विशेष अवसर: ${receiptFields.occasion}</div>
                  <div class="right-info"></div>
                </div>
              </div>
              
              <!-- Amount section - exactly from boli receipt -->
              <div class="amount-section">
                <div style="margin-bottom: 10px;">
                  <strong>भुगतान राशि: ₹${payment.amount.toLocaleString()}</strong>
                </div>
                <div style="font-size: 12px; color: #666;">
                  कुल राशि: ₹${record.outstandingAmount.toLocaleString()} | 
                  शेष राशि: ₹${record.pendingAmount.toLocaleString()}
                </div>
              </div>
              
              <!-- Signature area - exactly from boli receipt -->
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>बकाया भुगतान रसीद - Preview & Edit</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Editable Fields Preview */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">रसीद फील्ड्स (संपादित करें)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dharmanuyayi">धर्मानुयायी</Label>
                <Input
                  id="dharmanuyayi"
                  value={receiptFields.dharmanuyayi}
                  onChange={(e) => setReceiptFields({...receiptFields, dharmanuyayi: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="address">पता</Label>
                <Input
                  id="address"
                  value={receiptFields.address}
                  onChange={(e) => setReceiptFields({...receiptFields, address: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="description">बाबत</Label>
                <Input
                  id="description"
                  value={receiptFields.description}
                  onChange={(e) => setReceiptFields({...receiptFields, description: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="occasion">विशेष अवसर</Label>
                <Input
                  id="occasion"
                  value={receiptFields.occasion}
                  onChange={(e) => setReceiptFields({...receiptFields, occasion: e.target.value})}
                  placeholder="विशेष अवसर दर्ज करें"
                />
              </div>
              <div>
                <Label htmlFor="bediNumber">बेदी क्रमांक</Label>
                <Input
                  id="bediNumber"
                  value={receiptFields.bediNumber}
                  onChange={(e) => setReceiptFields({...receiptFields, bediNumber: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSaveFields} variant="outline">
                फील्ड्स सहेजें
              </Button>
            </div>
          </div>

          {/* Receipt Preview - matching boli receipt exactly */}
          <div className="border rounded-lg p-4 bg-white">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-4 mb-2">
                <div className="w-12 h-12 bg-gray-200 rounded"></div>
                <div>
                  <h1 className="text-lg font-bold text-orange-600">श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति</h1>
                  <p className="text-xs text-gray-600">शिवनगर, जबलपुर (म.प्र.)</p>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded"></div>
              </div>
              <h2 className="text-sm font-semibold bg-yellow-100 border border-yellow-400 rounded px-3 py-1 inline-block">भुगतान रसीद</h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>अनुक्रमांक: {payment.receiptNo || 'N/A'}</span>
                <span>दिनांक: {formatHindiDate(payment.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>धर्मानुयायी: श्री/श्रीमती/सुश्री {receiptFields.dharmanuyayi}</span>
                <span>भुगतान दिनांक: {formatHindiDate(payment.date)}</span>
              </div>
              <div className="flex justify-between">
                <span>पता: {receiptFields.address || 'पता उपलब्ध नहीं'}</span>
                <span>भुगतान विधि: {getPaymentModeHindi(payment.mode)}</span>
              </div>
              <div className="flex justify-between">
                <span>बाबत: {receiptFields.description}</span>
                <span>बेदी क्रमांक: {receiptFields.bediNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>विशेष अवसर: {receiptFields.occasion}</span>
                <span></span>
              </div>
            </div>

            <div className="bg-gray-100 p-4 my-4 text-center border">
              <div className="font-bold mb-2">भुगतान राशि: ₹{payment.amount.toLocaleString()}</div>
              <div className="text-xs text-gray-600">
                कुल राशि: ₹{record.outstandingAmount.toLocaleString()} | 
                शेष राशि: ₹{record.pendingAmount.toLocaleString()}
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <div className="text-center w-40">
                <div className="border-t border-black mt-8 pt-1 text-xs">धर्मानुयायी के हस्ताक्षर</div>
              </div>
              <div className="text-center w-40">
                <div className="border-t border-black mt-8 pt-1 text-xs">अधिकृत हस्ताक्षर</div>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              बंद करें
            </Button>
            <Button onClick={printReceipt} className="bg-red-600 hover:bg-red-700">
              <Printer className="h-4 w-4 mr-2" />
              रसीद प्रिंट करें
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}