import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Save, X } from "lucide-react";

interface AdvancePayment {
  id: number;
  userId: number;
  userName: string;
  userMobile?: string;
  userAddress?: string;
  date: string;
  amount: number;
  paymentMode: string;
  receiptNo?: string;
  createdBy: string;
  createdAt: string;
}

interface AdvancePaymentReceiptProps {
  advancePayment: AdvancePayment;
  isOpen: boolean;
  onClose: () => void;
}

// Local storage key for saved values
const SAVED_VALUES_KEY = 'advance_receipt_saved_values';

// Interface for saved values
interface SavedValues {
  referredBy: string;
  recordedBy: string;
}

// Function to get payment mode in Hindi
const getPaymentModeHindi = (mode: string): string => {
  const modeMap: { [key: string]: string } = {
    'cash': 'नगद',
    'upi': 'यूपीआई',
    'cheque': 'चेक',
    'netbanking': 'नेट बैंकिंग'
  };
  return modeMap[mode.toLowerCase()] || mode;
};

// Function to convert English names to Hindi (enhanced transliteration)
const convertNameToHindi = (name: string): string => {
  if (!name) return name;
  
  // Comprehensive name mappings
  const nameMap: { [key: string]: string } = {
    // Common names
    'shailesh': 'शैलेश',
    'aashi': 'आशी',
    'raj': 'राज',
    'rajesh': 'राजेश',
    'suresh': 'सुरेश',
    'ramesh': 'रमेश',
    'mukesh': 'मुकेश',
    'dinesh': 'दिनेश',
    'mahesh': 'महेश',
    'naresh': 'नरेश',
    'rakesh': 'राकेश',
    'umesh': 'उमेश',
    'yogesh': 'योगेश',
    'ritesh': 'रितेश',
    'hitesh': 'हितेश',
    'nilesh': 'नीलेश',
    'pradip': 'प्रदीप',
    'pradeep': 'प्रदीप',
    'deepak': 'दीपक',
    'deepika': 'दीपिका',
    'priya': 'प्रिया',
    'pooja': 'पूजा',
    'manish': 'मनीष',
    'ashish': 'आशीष',
    'sanjay': 'संजय',
    'ajay': 'अजय',
    'vijay': 'विजय',
    'ravi': 'रवि',
    'kiran': 'किरण',
    'aman': 'अमन',
    'arun': 'अरुण',
    'anita': 'अनीता',
    'sunita': 'सुनीता',
    'rekha': 'रेखा',
    'meera': 'मीरा',
    'seeta': 'सीता',
    'geeta': 'गीता',
    'rita': 'रीता',
    'kavita': 'कविता',
    'savita': 'सविता',
    'mamta': 'ममता',
    'sushma': 'सुष्मा',
    'krishna': 'कृष्णा',
    'radha': 'राधा',
    'shanti': 'शांति',
    'bharti': 'भारती',
    'aarti': 'आरती',
    'sanskar': 'संस्कार',
    
    // Surnames
    'jain': 'जैन',
    'sharma': 'शर्मा',
    'kumar': 'कुमार',
    'singh': 'सिंह',
    'gupta': 'गुप्ता',
    'agarwal': 'अग्रवाल',
    'agrawal': 'अग्रवाल',
    'shah': 'शाह',
    'patel': 'पटेल',
    'mehta': 'मेहता',
    'modi': 'मोदी',
    'verma': 'वर्मा',
    'tiwari': 'तिवारी',
    'pandey': 'पांडे',
    'mishra': 'मिश्रा',
    'yadav': 'यादव',
    'soni': 'सोनी',
    'goel': 'गोयल',
    'goyal': 'गोयल',
    'bansal': 'बंसल',
    'mittal': 'मित्तल',
    'singhal': 'सिंघल',
    'jindal': 'जिंदल',
    'chopra': 'चोपड़ा',
    'kapoor': 'कपूर',
    'malhotra': 'मल्होत्रा',
    'khanna': 'खन्ना',
    'arora': 'अरोड़ा',
    'bhatia': 'भाटिया',
    'sethi': 'सेठी',
    'tandon': 'टंडन',
    'saxena': 'सक्सेना',
    'srivastava': 'श्रीवास्तव',
    'mathur': 'माथुर',
    'chandra': 'चंद्र',
    'prakash': 'प्रकाश',
    
    // Titles
    'shree': 'श्री',
    'shri': 'श्री',
    'smt': 'श्रीमती',
    'mr': 'श्री',
    'mrs': 'श्रीमती',
    'ms': 'कुमारी',
    'dr': 'डॉ',
    'prof': 'प्रो'
  };
  
  // Split name into words and process each
  const words = name.toLowerCase().trim().split(/\s+/);
  const hindiWords = words.map(word => {
    // Remove punctuation for mapping lookup
    const cleanWord = word.replace(/[.,!?;:]/g, '');
    
    // Check direct mapping
    if (nameMap[cleanWord]) {
      return nameMap[cleanWord];
    }
    
    // Check partial matches for compound names
    for (const [eng, hindi] of Object.entries(nameMap)) {
      if (cleanWord.includes(eng) && eng.length > 2) {
        return hindi;
      }
    }
    
    // Return original with proper case if no mapping found
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return hindiWords.join(' ');
};

// Function to convert addresses and locations to Hindi
const convertAddressToHindi = (address: string): string => {
  if (!address) return address;
  
  const addressMap: { [key: string]: string } = {
    'sector': 'सेक्टर',
    'block': 'ब्लॉक',
    'plot': 'प्लॉट',
    'house': 'मकान',
    'flat': 'फ्लैट',
    'apartment': 'अपार्टमेंट',
    'colony': 'कॉलोनी',
    'nagar': 'नगर',
    'city': 'शहर',
    'road': 'रोड',
    'street': 'स्ट्रीट',
    'lane': 'लेन',
    'main': 'मुख्य',
    'near': 'के पास',
    'behind': 'के पीछे',
    'front': 'के सामने',
    'jabalpur': 'जबलपुर',
    'shivnagar': 'शिवनगर',
    'bhopal': 'भोपाल',
    'indore': 'इंदौर',
    'gwalior': 'ग्वालियर',
    'ujjain': 'उज्जैन'
  };
  
  let hindiAddress = address;
  
  // Replace each English word with Hindi if mapping exists
  for (const [eng, hindi] of Object.entries(addressMap)) {
    const regex = new RegExp(`\\b${eng}\\b`, 'gi');
    hindiAddress = hindiAddress.replace(regex, hindi);
  }
  
  return hindiAddress;
};

// Function to convert numbers to Hindi words
const convertToHindiWords = (amount: number): string => {
  const ones = ['', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ'];
  const teens = ['दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस'];
  const tens = ['', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे'];
  
  if (amount === 0) return 'शून्य';
  if (amount < 10) return ones[amount];
  if (amount < 20) return teens[amount - 10];
  if (amount < 100) {
    const ten = Math.floor(amount / 10);
    const one = amount % 10;
    return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
  }
  if (amount < 1000) {
    const hundred = Math.floor(amount / 100);
    const remainder = amount % 100;
    return ones[hundred] + ' सौ' + (remainder > 0 ? ' ' + convertToHindiWords(remainder) : '');
  }
  if (amount < 100000) {
    const thousand = Math.floor(amount / 1000);
    const remainder = amount % 1000;
    return convertToHindiWords(thousand) + ' हजार' + (remainder > 0 ? ' ' + convertToHindiWords(remainder) : '');
  }
  if (amount < 10000000) {
    const lakh = Math.floor(amount / 100000);
    const remainder = amount % 100000;
    return convertToHindiWords(lakh) + ' लाख' + (remainder > 0 ? ' ' + convertToHindiWords(remainder) : '');
  }
  
  return amount.toString(); // Fallback for very large numbers
};

export function AdvancePaymentReceipt({ advancePayment, isOpen, onClose }: AdvancePaymentReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  
  // Saved values state
  const [savedValues, setSavedValues] = useState<SavedValues>({
    referredBy: '',
    recordedBy: ''
  });

  // Load saved values on component mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_VALUES_KEY);
    if (saved) {
      try {
        setSavedValues(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved values:', error);
      }
    }
  }, []);

  // Save values to localStorage
  const handleSaveValues = () => {
    localStorage.setItem(SAVED_VALUES_KEY, JSON.stringify(savedValues));
    alert('मान सफलतापूर्वक सहेजे गए!');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('hi-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const currentDate = new Date().toLocaleDateString('hi-IN');
      const amountInWords = convertToHindiWords(advancePayment.amount);
      const paymentModeHindi = getPaymentModeHindi(advancePayment.paymentMode);
      
      const html = `
        <!DOCTYPE html>
        <html lang="hi">
          <head>
            <meta charset="UTF-8">
            <title>अग्रिम भुगतान रसीद - ${advancePayment.receiptNo}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
              
              body {
                font-family: 'Noto Sans Devanagari', 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                background: white;
                color: #000;
                font-size: 16px;
                line-height: 1.4;
              }
              
              .receipt-container {
                max-width: 600px;
                margin: 0 auto;
                border: 2px solid #000;
                padding: 0;
              }
              
              .receipt-header {
                text-align: center;
                padding: 15px;
                background: #f8f9fa;
                border-bottom: 2px solid #000;
              }
              
              .temple-name {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 8px;
                color: #d97706;
              }
              
              .temple-subtitle {
                font-size: 16px;
                margin-bottom: 5px;
                color: #666;
              }
              
              .receipt-title {
                font-size: 20px;
                font-weight: 600;
                margin-top: 10px;
                color: #000;
              }
              
              .receipt-body {
                padding: 20px;
              }
              
              .receipt-section {
                margin-bottom: 20px;
              }
              
              .section-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 10px;
                color: #374151;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 5px;
              }
              
              .receipt-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
                padding: 4px 0;
              }
              
              .receipt-label {
                font-weight: 600;
                color: #374151;
                flex: 1;
              }
              
              .receipt-value {
                flex: 2;
                text-align: right;
                color: #000;
              }
              
              .amount-section {
                background: #fef3c7;
                padding: 15px;
                border: 1px solid #f59e0b;
                margin: 15px 0;
                border-radius: 4px;
              }
              
              .amount-large {
                font-size: 24px;
                font-weight: 700;
                color: #d97706;
              }
              
              .amount-words {
                font-size: 14px;
                font-style: italic;
                margin-top: 5px;
                color: #92400e;
              }
              
              .signature-section {
                display: flex;
                justify-content: space-between;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
              }
              
              .signature-box {
                text-align: center;
                flex: 1;
                margin: 0 10px;
              }
              
              .signature-line {
                border-top: 1px solid #000;
                margin-top: 40px;
                padding-top: 5px;
                font-size: 12px;
                color: #666;
              }
              
              .receipt-footer {
                text-align: center;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 2px solid #000;
                font-size: 12px;
                color: #666;
              }
              
              .footer-note {
                margin: 5px 0;
              }
              
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none !important; }
                .receipt-container { border: 2px solid #000; }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="receipt-header">
                <div class="temple-name">श्री शिवनगर जैन मंदिर समिति</div>
                <div class="temple-subtitle">शिवनगर, जबलपुर</div>
                <div class="receipt-title">अग्रिम भुगतान रसीद</div>
              </div>
              
              <div class="receipt-body">
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="receipt-label">रसीद नंबर:</div>
                    <div class="receipt-value" style="font-weight: 600;">${advancePayment.receiptNo || 'अनुपलब्ध'}</div>
                  </div>
                  <div class="receipt-row">
                    <div class="receipt-label">दिनांक:</div>
                    <div class="receipt-value">${formatDate(advancePayment.date)}</div>
                  </div>
                </div>
                
                <div class="receipt-section">
                  <div class="section-title">दाता का विवरण</div>
                  <div class="receipt-row">
                    <div class="receipt-label">नाम:</div>
                    <div class="receipt-value" style="font-weight: 700;">${convertNameToHindi(advancePayment.userName)}</div>
                  </div>
                  ${advancePayment.userMobile ? `
                  <div class="receipt-row">
                    <div class="receipt-label">मोबाइल:</div>
                    <div class="receipt-value">${advancePayment.userMobile}</div>
                  </div>
                  ` : ''}
                  ${advancePayment.userAddress ? `
                  <div class="receipt-row">
                    <div class="receipt-label">पता:</div>
                    <div class="receipt-value">${convertAddressToHindi(advancePayment.userAddress)}</div>
                  </div>
                  ` : ''}
                </div>
                
                <div class="amount-section">
                  <div class="receipt-row">
                    <div class="receipt-label">भुगतान माध्यम:</div>
                    <div class="receipt-value">${paymentModeHindi}</div>
                  </div>
                  <div class="receipt-row" style="margin-top: 10px;">
                    <div class="receipt-label">राशि:</div>
                    <div class="receipt-value amount-large">₹${advancePayment.amount.toLocaleString('hi-IN')}</div>
                  </div>
                  <div class="amount-words">
                    <strong>शब्दों में:</strong> ${amountInWords} रुपये मात्र
                  </div>
                </div>
                
                <div class="receipt-section">
                  <div class="section-title">अतिरिक्त जानकारी</div>
                  <div class="receipt-row">
                    <div class="receipt-label">संदर्भित द्वारा:</div>
                    <div class="receipt-value">${savedValues.referredBy || 'अनुपलब्ध'}</div>
                  </div>
                  <div class="receipt-row">
                    <div class="receipt-label">दर्ज किया गया:</div>
                    <div class="receipt-value">${convertNameToHindi(savedValues.recordedBy || advancePayment.createdBy)}</div>
                  </div>
                </div>
                
                <div class="signature-section">
                  <div class="signature-box">
                    <div class="signature-line">दाता के हस्ताक्षर</div>
                  </div>
                  <div class="signature-box">
                    <div class="signature-line">अधिकृत हस्ताक्षर</div>
                  </div>
                </div>
              </div>
              
              <div class="receipt-footer">
                <div class="footer-note"><strong>नोट:</strong> यह अग्रिम भुगतान आपकी भविष्य की बोली प्रविष्टियों के विरुद्ध समायोजित किया जाएगा।</div>
                <div class="footer-note"><strong>मुद्रण दिनांक:</strong> ${currentDate}</div>
              </div>
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            अग्रिम भुगतान रसीद
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {/* Saved Values Section */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
          <div>
            <Label htmlFor="referredBy">संदर्भित द्वारा</Label>
            <Input
              id="referredBy"
              value={savedValues.referredBy}
              onChange={(e) => setSavedValues(prev => ({ ...prev, referredBy: e.target.value }))}
              placeholder="रेफरी का नाम दर्ज करें"
            />
          </div>
          <div>
            <Label htmlFor="recordedBy">दर्ज किया गया</Label>
            <Input
              id="recordedBy"
              value={savedValues.recordedBy}
              onChange={(e) => setSavedValues(prev => ({ ...prev, recordedBy: e.target.value }))}
              placeholder="रिकॉर्डर का नाम दर्ज करें"
            />
          </div>
        </div>
        
        {/* Receipt Preview */}
        <div className="border rounded-lg p-6 bg-white mb-4">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-orange-600 mb-2">श्री शिवनगर जैन मंदिर समिति</h1>
            <p className="text-gray-600">शिवनगर, जबलपुर</p>
            <h2 className="text-xl font-semibold mt-4">अग्रिम भुगतान रसीद</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="font-semibold">रसीद नंबर:</span>
              <span>{advancePayment.receiptNo || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">दिनांक:</span>
              <span>{formatDate(advancePayment.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">नाम:</span>
              <span className="font-bold">{convertNameToHindi(advancePayment.userName)}</span>
            </div>
            {advancePayment.userMobile && (
              <div className="flex justify-between">
                <span className="font-semibold">मोबाइल:</span>
                <span>{advancePayment.userMobile}</span>
              </div>
            )}
            {advancePayment.userAddress && (
              <div className="flex justify-between">
                <span className="font-semibold">पता:</span>
                <span>{convertAddressToHindi(advancePayment.userAddress)}</span>
              </div>
            )}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex justify-between mb-2">
                <span className="font-semibold">भुगतान माध्यम:</span>
                <span>{getPaymentModeHindi(advancePayment.paymentMode)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold">राशि:</span>
                <span className="text-xl font-bold text-orange-600">₹{advancePayment.amount.toLocaleString('hi-IN')}</span>
              </div>
              <div className="text-sm italic text-orange-800">
                <strong>शब्दों में:</strong> {convertToHindiWords(advancePayment.amount)} रुपये मात्र
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSaveValues} variant="outline" className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            मान सहेजें
          </Button>
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            रसीद प्रिंट करें
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}