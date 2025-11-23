import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface DravyaEntry {
  id: number;
  userId: number;
  userName: string;
  description: string;
  quantity: number;
  createdAt: string;
  userAddress?: string;
  userMobile?: string;
}

interface DravyaHindiReceiptProps {
  entry: DravyaEntry;
  receiptNo?: string;
}

export function DravyaHindiReceipt({ entry, receiptNo }: DravyaHindiReceiptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editableData, setEditableData] = useState({
    dharmanuyayi: entry.userName || "",
    address: entry.userAddress || "शिवनगर, जबलपुर (म.प्र.)",
    date: new Date().toLocaleDateString('hi-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/'),
    receiptNumber: receiptNo || `DD-${new Date().getFullYear()}-${String(entry.id).padStart(5, '0')}`
  });
  const { toast } = useToast();

  const formatDateDDMMYY = (date: string | Date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Function to convert English names to Hindi
  const convertToHindi = (text: string): string => {
    if (!text) return text;
    
    // Name and description conversion mappings
    const conversions: { [key: string]: string } = {
      // Common English names to Hindi
      'Akansha': 'आकांक्षा',
      'Shailesh': 'शैलेश',
      'Jain': 'जैन',
      'Sandheliya': 'संधेलिया',
      'Suresh': 'सुरेश',
      'Ramesh': 'रमेश',
      'Rajesh': 'राजेश',
      'Mukesh': 'मुकेश',
      'Mahesh': 'महेश',
      'Dinesh': 'दिनेश',
      'Naresh': 'नरेश',
      'Prakash': 'प्रकाश',
      'Anil': 'अनिल',
      'Sunil': 'सुनील',
      'Vinod': 'विनोद',
      'Manoj': 'मनोज',
      'Sandeep': 'संदीप',
      'Pradeep': 'प्रदीप',
      'Deepak': 'दीपक',
      'Ashok': 'अशोक',
      'Vijay': 'विजय',
      'Ajay': 'अजय',
      'Sanjay': 'संजय',
      'Ravi': 'रवि',
      'Kumar': 'कुमार',
      'Singh': 'सिंह',
      'Sharma': 'शर्मा',
      'Gupta': 'गुप्ता',
      'Agarwal': 'अग्रवाल',
      'Bansal': 'बंसल',
      'Mittal': 'मित्तल',
      'Garg': 'गर्ग',
      'Arora': 'अरोड़ा',
      'Malhotra': 'मल्होत्रा',
      'Chopra': 'चोपड़ा',
      'Kapoor': 'कपूर',
      'Verma': 'वर्मा',
      'Yadav': 'यादव',
      'Mishra': 'मिश्रा',
      'Pandey': 'पांडे',
      'Tiwari': 'तिवारी',
      'Dubey': 'दुबे',
      'Shukla': 'शुक्ला',
      'Srivastava': 'श्रीवास्तव',
      'Tripathi': 'त्रिपाठी',
      
      // Common descriptions and items to Hindi
      'bora': 'बोरा',
      'nariyal': 'नारियल',
      'coconut': 'नारियल',
      'rice': 'चावल',
      'wheat': 'गेहूं',
      'dal': 'दाल',
      'oil': 'तेल',
      'sugar': 'चीनी',
      'salt': 'नमक',
      'ghee': 'घी',
      'milk': 'दूध',
      'fruits': 'फल',
      'vegetables': 'सब्जी',
      'clothes': 'कपड़े',
      'books': 'किताबें',
      'cash': 'नकद',
      'donation': 'दान',
      'food': 'भोजन',
      'grains': 'अनाज',
      'pulses': 'दालें',
      'spices': 'मसाले',
      'tea': 'चाय',
      'coffee': 'कॉफी',
      'sweets': 'मिठाई',
      'flour': 'आटा',
      'kg': 'किलो',
      'liter': 'लीटर',
      'packet': 'पैकेट',
      'bag': 'बैग',
      'box': 'डिब्बा'
    };

    let convertedText = text;
    
    // Convert each word if it has a Hindi mapping
    Object.entries(conversions).forEach(([english, hindi]) => {
      const regex = new RegExp(`\\b${english}\\b`, 'gi');
      convertedText = convertedText.replace(regex, hindi);
    });
    
    return convertedText;
  };

  const generateReceiptHTML = () => {
    const formattedUserName = convertToHindi(editableData.dharmanuyayi || entry.userName);
    const hindiAddress = editableData.address;
    const hindiDescription = convertToHindi(entry.description);
    
    // Add cache breaker for images
    const cacheBreaker = Date.now();
    
    return `
      <!DOCTYPE html>
      <html lang="hi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>द्रव्य दान रसीद - ${formattedUserName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
            
            body {
              font-family: 'Noto Sans Devanagari', sans-serif;
              margin: 0;
              padding: 5px;
              background-color: #f5f5f5;
            }
            
            .receipt-container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border: 2px solid #000;
              border-radius: 8px;
              padding: 0;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              font-family: 'Noto Sans Devanagari', Arial, sans-serif;
            }
            
            .receipt-header {
              text-align: center;
              border-bottom: 3px solid #000;
              padding: 12px;
              background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .left-logo, .right-logo {
              position: absolute;
              top: 12px;
              width: 60px;
              height: 60px;
              object-fit: contain;
            }
            
            .left-logo {
              left: 15px;
            }
            
            .right-logo {
              right: 15px;
            }
            
            .center-content {
              flex: 1;
              text-align: center;
            }
            
            .temple-name {
              font-size: 18px;
              font-weight: 700;
              color: #d97706;
              margin: 5px 0 3px 0;
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
            
            .dravya-section {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 4px;
              padding: 8px;
              margin: 12px 0;
              text-align: center;
            }
            
            .dravya-title {
              font-size: 12px;
              font-weight: 700;
              color: #92400e;
              margin-bottom: 5px;
            }
            
            .dravya-description {
              font-size: 11px;
              font-weight: 600;
              color: #1f2937;
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
                <div class="receipt-title">द्रव्य दान रसीद</div>
              </div>
              
              <img src="/uploads/new-logo-mandir-color.jpg?v=${cacheBreaker}" alt="मंदिर लोगो" class="right-logo">
            </div>
            
            <!-- Receipt body -->
            <div class="receipt-body">
              <div class="info-section">
                <div class="info-row">
                  <div class="left-info">अनुक्रमांक: ${editableData.receiptNumber}</div>
                  <div class="right-info">दिनांक: ${editableData.date}</div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">धर्मानुयायी: श्री/श्रीमती/सुश्री ${formattedUserName}</div>
                  <div class="right-info"></div>
                </div>
                
                <div class="info-row">
                  <div class="left-info">पता: ${hindiAddress}</div>
                  <div class="right-info"></div>
                </div>
                
              </div>
              
              <!-- Dravya Section -->
              <div class="dravya-section">
                <div class="dravya-title">दान वस्तु</div>
                <div class="dravya-description">${hindiDescription}</div>
              </div>
              
              <!-- Signature area -->
              <div class="signature-area">
                <div class="signature-box">
                  <div class="signature-line">दाता के हस्ताक्षर</div>
                </div>
                <div class="signature-box">
                  <div class="signature-line">अधिकृत हस्ताक्षर</div>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #666;">
                <p><strong>धन्यवाद! आपका सहयोग अमूल्य है।</strong></p>
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
  };

  const handleSaveAndPrint = () => {
    const receiptHTML = generateReceiptHTML();
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 100);
      };
      
      toast({
        title: "Success",
        description: "Receipt opened for printing"
      });
    } else {
      toast({
        title: "Error", 
        description: "Unable to open print window. Please check popup settings.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">
          🧾 Hindi Receipt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Editable fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Edit Receipt Details</h3>
            
            <div>
              <Label htmlFor="dharmanuyayi">धर्मानुयायी (संपादनीय)</Label>
              <Input
                id="dharmanuyayi"
                value={editableData.dharmanuyayi}
                onChange={(e) => setEditableData({...editableData, dharmanuyayi: e.target.value})}
                placeholder="नाम"
              />
            </div>
            
            <div>
              <Label htmlFor="address">पता (संपादनीय)</Label>
              <Textarea
                id="address"
                value={editableData.address}
                onChange={(e) => setEditableData({...editableData, address: e.target.value})}
                placeholder="पता"
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="date">दिनांक (संपादनीय)</Label>
              <Input
                id="date"
                value={editableData.date}
                onChange={(e) => setEditableData({...editableData, date: e.target.value})}
                placeholder="DD/MM/YY"
              />
            </div>
            
            <div>
              <Label htmlFor="receiptNumber">रसीद संख्या (संपादनीय)</Label>
              <Input
                id="receiptNumber"
                value={editableData.receiptNumber}
                onChange={(e) => setEditableData({...editableData, receiptNumber: e.target.value})}
                placeholder="रसीद संख्या"
              />
            </div>
          </div>
          
          {/* Right side - Preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Receipt Preview</h3>
            <div 
              className="bg-white border rounded scale-75 origin-top-left"
              style={{ width: '133%', height: 'auto' }}
              dangerouslySetInnerHTML={{ __html: generateReceiptHTML() }}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAndPrint} className="bg-orange-600 hover:bg-orange-700">
            Save & Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}