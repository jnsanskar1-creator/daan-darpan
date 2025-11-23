import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Entry, PaymentRecord } from '@shared/schema';

interface HindiReceiptProps {
  entry: Entry;
  payment: PaymentRecord;
  paymentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

// Function to convert numbers to Hindi words
const numberToHindiWords = (num: number): string => {
  const ones = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];
  const teens = ['दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस'];
  const tens = ['', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे'];
  const hundreds = ['', 'एक सौ', 'दो सौ', 'तीन सौ', 'चार सौ', 'पाँच सौ', 'छह सौ', 'सात सौ', 'आठ सौ', 'नौ सौ'];

  if (num === 0) return 'शून्य';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const tensDigit = Math.floor(num / 10);
    const onesDigit = num % 10;
    return tens[tensDigit] + (onesDigit > 0 ? ' ' + ones[onesDigit] : '');
  }
  if (num < 1000) {
    const hundredsDigit = Math.floor(num / 100);
    const remainder = num % 100;
    return hundreds[hundredsDigit] + (remainder > 0 ? ' ' + numberToHindiWords(remainder) : '');
  }
  if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return numberToHindiWords(thousands) + ' हजार' + (remainder > 0 ? ' ' + numberToHindiWords(remainder) : '');
  }
  if (num < 10000000) {
    const lakhs = Math.floor(num / 100000);
    const remainder = num % 100000;
    return numberToHindiWords(lakhs) + ' लाख' + (remainder > 0 ? ' ' + numberToHindiWords(remainder) : '');
  }
  
  const crores = Math.floor(num / 10000000);
  const remainder = num % 10000000;
  return numberToHindiWords(crores) + ' करोड़' + (remainder > 0 ? ' ' + numberToHindiWords(remainder) : '');
};

// Note: Payment modes are kept in English as requested

// Function to format date in DD/MM/YY format
const formatDateDDMMYY = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
};

// Enhanced Hindi translation function
const convertToHindi = (englishText: string): string => {
  if (!englishText || englishText.trim() === '') return englishText;
  
  // If already contains Hindi characters, return as is
  if (/[\u0900-\u097F]/.test(englishText)) {
    return englishText;
  }

  // Proper Hindi transliteration using standard rules
  const properHindiTransliteration = (text: string): string => {
    // Standard transliteration patterns for common English to Hindi
    const transliterationMap: { [key: string]: string } = {
      // Common name patterns
      'anand': 'आनंद',
      'jain': 'जैन',
      'kumar': 'कुमार',
      'singh': 'सिंह',
      'sharma': 'शर्मा',
      'gupta': 'गुप्ता',
      'agarwal': 'अग्रवाल',
      'choudhary': 'चौधरी',
      'chaudhary': 'चौधरी',
      'modi': 'मोदी',
      'shah': 'शाह',
      'patel': 'पटेल',
      'verma': 'वर्मा',
      'yadav': 'यादव',
      'mishra': 'मिश्रा',
      'tiwari': 'तिवारी',
      'pandey': 'पांडे',
      'shukla': 'शुक्ला',
      // Common first names with correct spellings
      'raj': 'राज',
      'ravi': 'रवि',
      'amit': 'अमित',
      'rohit': 'रोहित',
      'rahul': 'राहुल',
      'arjun': 'अर्जुन',
      'vikash': 'विकाश',
      'vikas': 'विकास',
      'akash': 'आकाश',
      'aakash': 'आकाश',
      'prakash': 'प्रकाश',
      'dev': 'देव',
      'devi': 'देवी',
      'mata': 'माता',
      'bai': 'बाई',
      'ben': 'बेन',
      'ji': 'जी',
      // Place names
      'jabalpur': 'जबलपुर',
      'mumbai': 'मुंबई',
      'delhi': 'दिल्ली',
      'kolkata': 'कोलकाता',
      'chennai': 'चेन्नई',
      'bangalore': 'बंगलुरु',
      'hyderabad': 'हैदराबाद',
      'pune': 'पुणे',
      'ahmedabad': 'अहमदाबाद',
      'surat': 'सूरत',
      'kanpur': 'कानपुर',
      'lucknow': 'लखनऊ',
      'nagpur': 'नागपुर',
      'indore': 'इंदौर',
      'bhopal': 'भोपाल',
      'shivnagar': 'शिवनगर'
    };

    const lowerText = text.toLowerCase().trim();
    
    // Check for exact matches first
    if (transliterationMap[lowerText]) {
      return transliterationMap[lowerText];
    }
    
    // For unknown words, apply basic phonetic conversion for common patterns
    const basicPhoneticConversion = (word: string): string => {
      let result = word.toLowerCase();
      
      // Basic consonant-vowel patterns
      const patterns: { [key: string]: string } = {
        'a': 'अ', 'e': 'ए', 'i': 'इ', 'o': 'ओ', 'u': 'उ',
        'ka': 'का', 'ki': 'की', 'ku': 'कु', 'ko': 'को',
        'ga': 'गा', 'gi': 'गी', 'gu': 'गु', 'go': 'गो',
        'ja': 'जा', 'ji': 'जी', 'ju': 'जु', 'jo': 'जो',
        'ta': 'ता', 'ti': 'ती', 'tu': 'तु', 'to': 'तो',
        'da': 'दा', 'di': 'दी', 'du': 'दु', 'do': 'दो',
        'na': 'ना', 'ni': 'नी', 'nu': 'नु', 'no': 'नो',
        'pa': 'पा', 'pi': 'पी', 'pu': 'पु', 'po': 'पो',
        'ba': 'बा', 'bi': 'बी', 'bu': 'बु', 'bo': 'बो',
        'ma': 'मा', 'mi': 'मी', 'mu': 'मु', 'mo': 'मो',
        'ya': 'या', 'yi': 'यी', 'yu': 'यु', 'yo': 'यो',
        'ra': 'रा', 'ri': 'री', 'ru': 'रु', 'ro': 'रो',
        'la': 'ला', 'li': 'ली', 'lu': 'लु', 'lo': 'लो',
        'va': 'वा', 'vi': 'वी', 'vu': 'वु', 'vo': 'वो',
        'sa': 'सा', 'si': 'सी', 'su': 'सु', 'so': 'सो',
        'ha': 'हा', 'hi': 'ही', 'hu': 'हु', 'ho': 'हो',
        'sha': 'शा', 'shi': 'शी', 'shu': 'शु', 'sho': 'शो',
        // Ending patterns
        'ya$': 'या', 'ia$': 'िया', 'iya$': 'िया',
        // Simple consonants at end
        'k$': 'क्', 'g$': 'ग्', 'n$': 'न्', 't$': 'त्', 'd$': 'द्',
        'p$': 'प्', 'b$': 'ब्', 'm$': 'म्', 'r$': 'र्', 'l$': 'ल्',
        'v$': 'व्', 's$': 'स्', 'h$': 'ह्'
      };
      
      // Try to convert basic patterns
      for (const [pattern, hindi] of Object.entries(patterns)) {
        if (pattern.endsWith('$')) {
          const regex = new RegExp(pattern);
          result = result.replace(regex, hindi);
        } else {
          result = result.replace(new RegExp(pattern, 'g'), hindi);
        }
      }
      
      // If result still contains English letters, return original
      if (/[a-zA-Z]/.test(result)) {
        return text;
      }
      
      return result;
    };
    
    return basicPhoneticConversion(text);
  };
  
  // Comprehensive mapping for names, places, and terms
  const englishToHindi: { [key: string]: string } = {
    // Common names - Male
    'sanskar': 'संस्कार',
    'shailesh': 'शैलेश', 
    'anand': 'आनंद',
    'sunil': 'सुनील',
    'manish': 'मनीष',
    'prasann': 'प्रसन्न',
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
    'ashish': 'आशीष',
    'sanjay': 'संजय',
    'ajay': 'अजय',
    'vijay': 'विजय',
    'ravi': 'रवि',
    'aman': 'अमन',
    'arun': 'अरुण',
    'raj': 'राज',
    'amit': 'अमित',
    'rohit': 'रोहित',
    'rahul': 'राहुल',
    'arjun': 'अर्जुन',
    'vikas': 'विकास',
    'vikash': 'विकाश',
    'akash': 'आकाश',
    'prakash': 'प्रकाश',
    'dev': 'देव',
    'manoj': 'मनोज',
    'anil': 'अनिल',
    'kapil': 'कपिल',
    'kunal': 'कुणाल',
    'vishal': 'विशाल',
    'shubham': 'शुभम',
    'sachin': 'सचिन',
    'gaurav': 'गौरव',
    'harsh': 'हर्ष',
    'karan': 'करण',
    'varun': 'वरुण',
    'tarun': 'तरुण',
    'pawan': 'पवन',
    'mohan': 'मोहन',
    'sohan': 'सोहन',
    'rohan': 'रोहन',
    'nitin': 'नितिन',
    'lalit': 'ललित',
    'sumit': 'सुमित',
    'hemant': 'हेमंत',
    'pankaj': 'पंकज',
    'neeraj': 'नीरज',
    'dheeraj': 'धीरज',
    'dileep': 'दिलीप',
    'dilip': 'दिलीप',
    'sandheliya': 'संधेलिया',
    'sandhilya': 'संधिल्या',
    // Common names - Female
    'aashi': 'आशी',
    'deepika': 'दीपिका',
    'priya': 'प्रिया',
    'pooja': 'पूजा',
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
    'kiran': 'किरण',
    'devi': 'देवी',
    'mata': 'माता',
    'bai': 'बाई',
    'ben': 'बेन',
    'asha': 'आशा',
    'usha': 'उषा',
    'nisha': 'निशा',
    'ritu': 'रितु',
    'mitu': 'मितु',
    'sita': 'सीता',
    'gita': 'गीता',
    'lata': 'लता',
    'maya': 'माया',
    'jaya': 'जया',
    'vijaya': 'विजया',
    'sujata': 'सुजाता',
    'sangita': 'संगीता',
    'sarita': 'सरिता',
    'namita': 'नमिता',
    'lalita': 'ललिता',
    'malti': 'मालती',
    'shilpa': 'शिल्पा',
    'rashmi': 'रश्मि',
    'swati': 'स्वाती',
    'shruti': 'श्रुति',
    'sneha': 'स्नेहा',
    'neha': 'नेहा',
    'reha': 'रेहा',
    'komal': 'कोमल',
    'payal': 'पायल',
    'simran': 'सिमरन',
    'gunjan': 'गुंजन',
    'shweta': 'श्वेता',
    // Surnames/Last names
    'jain': 'जैन',
    'choudhary': 'चौधरी',
    'chaudhary': 'चौधरी',
    'kumar': 'कुमार',
    'singh': 'सिंह',
    'sharma': 'शर्मा',
    'gupta': 'गुप्ता',
    'agarwal': 'अग्रवाल',
    'aggarwal': 'अग्रवाल',
    'modi': 'मोदी',
    'shah': 'शाह',
    'patel': 'पटेल',
    'verma': 'वर्मा',
    'yadav': 'यादव',
    'mishra': 'मिश्रा',
    'tiwari': 'तिवारी',
    'pandey': 'पांडे',
    'shukla': 'शुक्ला',
    'dubey': 'दुबे',
    'tripathi': 'त्रिपाठी',
    'srivastava': 'श्रीवास्तव',
    'rastogi': 'रस्तोगी',
    'saxena': 'सक्सेना',
    'malhotra': 'मल्होत्रा',
    'chopra': 'चोपड़ा',
    'kapoor': 'कपूर',
    'mehra': 'मेहरा',
    'sethi': 'सेठी',
    'bansal': 'बंसल',
    'goel': 'गोयल',
    'goyal': 'गोयल',
    'mittal': 'मित्तल',
    'jindal': 'जिंदल',
    'singhal': 'सिंघल',
    'agrawal': 'अग्रवाल',
    'maheshwari': 'माहेश्वरी',
    'porwal': 'पोरवाल',
    'khandelwal': 'खंडेलवाल',
    'oswaal': 'ओसवाल',
    'oswal': 'ओसवाल',
    'pareek': 'पारीक',
    'kothari': 'कोठारी',
    'bhansali': 'भंसाली',
    'somani': 'सोमानी',
    'bohra': 'बोहरा',
    'daga': 'डागा',
    'saraf': 'सराफ',
    'bafna': 'बाफना',
    'bothra': 'बोथरा',
    'chordia': 'चोरडिया',
    'sanghvi': 'संघवी',
    'mehta': 'मेहता',
    'doshi': 'दोशी',
    'thakkar': 'ठक्कर',
    'vaishnav': 'वैष्णव',
    'bhandari': 'भंडारी',
    'mundra': 'मुंद्रा',
    'lohia': 'लोहिया',
    'garg': 'गर्ग',
    'tayal': 'तयाल',
    'bhargava': 'भार्गव',
    'mathur': 'माथुर',
    'tandon': 'टंडन',
    'khanna': 'खन्ना',
    'arora': 'अरोड़ा',
    'sood': 'सूद',
    'bhatia': 'भाटिया',
    'bajaj': 'बजाज',
    'dhawan': 'धवन',
    'nair': 'नायर',
    'menon': 'मेनन',
    'iyer': 'अय्यर',
    'reddy': 'रेड्डी',
    'rao': 'राव',
    'das': 'दास',
    'sen': 'सेन',
    'bose': 'बोस',
    'ghosh': 'घोष',
    'mukherji': 'मुखर्जी',
    'mukherjee': 'मुखर्जी',
    'chatterjee': 'चटर्जी',
    'banerjee': 'बनर्जी',
    'bhattacharya': 'भट्टाचार्य',
    // Common titles and honorifics  
    'ji': 'जी',
    'saheb': 'साहब',
    'sahib': 'साहिब',
    'bhai': 'भाई',
    'sister': 'बहन',
    'uncle': 'अंकल',
    'aunty': 'आंटी',
    'dada': 'दादा',
    'dadi': 'दादी',
    'nana': 'नाना',
    'nani': 'नानी',
    // System terms
    'system': 'सिस्टम',
    'admin': 'व्यवस्थापक',
    'operator': 'संचालक',
    'sanad': 'सनद',
    // Places
    'jabalpur': 'जबलपुर',
    'shivnagar': 'शिवनगर',
    'damoh': 'दमोह',
    'road': 'रोड',
    'mp': 'म.प्र.',
    'madhya': 'मध्य',
    'pradesh': 'प्रदेश',
    'colony': 'कॉलोनी',
    'nagar': 'नगर',
    'gali': 'गली',
    'mohalla': 'मोहल्ला',
    'ward': 'वार्ड',
    'near': 'के पास',
    'behind': 'के पीछे',
    'front': 'के सामने',
    'street': 'स्ट्रीट',
    'sector': 'सेक्टर',
    'block': 'ब्लॉक',
    'house': 'मकान',
    'no': 'नं',
    'number': 'संख्या',
    'plot': 'प्लॉट',
    'area': 'क्षेत्र',
    'circle': 'सर्कल',
    'phase': 'फेज',
    'extension': 'एक्सटेंशन',
    'main': 'मुख्य',
    'chowk': 'चौक',
    'park': 'पार्क',
    'market': 'मार्केट',
    'complex': 'कॉम्प्लेक्स',
    'apartment': 'अपार्टमेंट',
    'society': 'सोसाइटी',
    'layout': 'लेआउट',
    'township': 'टाउनशिप',
    'residency': 'रेसिडेंसी',
    'enclave': 'एन्क्लेव',
    'heights': 'हाइट्स',
    'gardens': 'गार्डन्स',
    'vihar': 'विहार',
    'puram': 'पुरम',
    'nagri': 'नगरी',
    'marg': 'मार्ग',
    'path': 'पथ',
    'lane': 'लेन',
    // Common words
    'shantidhara': 'शांतिधारा',
    'puja': 'पूजा',
    'donation': 'दान',
    'temple': 'मंदिर',
    'festival': 'त्योहार',
    'ceremony': 'समारोह',
    'abhishek': 'अभिषेक',
    'aarti': 'आरती',
    'prasad': 'प्रसाद',
    'darshan': 'दर्शन',
    'birthday': 'जन्मदिन',
    'anniversary': 'वर्षगांठ',
    'marriage': 'विवाह',
    'navratri': 'नवरात्रि',
    'diwali': 'दिवाली',
    'holi': 'होली',
    'mahavir': 'महावीर',
    'jayanti': 'जयंती',
    'paryushan': 'पर्युषण',
    'special': 'विशेष',
    'occasion': 'अवसर',
    'general': 'सामान्य',
    'regular': 'नियमित',
    'monthly': 'मासिक',
    // Key boli description translations
    'shanti dhara sanskar': 'शांति धारा संस्कार',
    'shantidhara sanskar': 'शांतिधारा संस्कार',
    'shanti dhara': 'शांति धारा',
    'dhara': 'धारा',
    'food': 'भोजन',
    'decoration': 'सजावट',
    'flowers': 'फूल',
    'offering': 'अर्पण',
    'daily': 'दैनिक',
    // Common address patterns
    'p-207': 'पी-207',
    'shiv': 'शिव'
  };

  // Convert the entire text as a phrase first, then word by word
  const lowerText = englishText.toLowerCase();
  
  // Check for complete phrase matches first
  for (const [eng, hindi] of Object.entries(englishToHindi)) {
    if (lowerText === eng) {
      return hindi;
    }
  }
  
  // Split the text into words and convert each word
  const words = englishText.toLowerCase().split(' ');
  const hindiWords = words.map(word => {
    // Remove extra characters and check if word exists in mapping
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (englishToHindi[cleanWord]) {
      return englishToHindi[cleanWord];
    }
    
    // If no direct mapping found, use proper Hindi transliteration
    return properHindiTransliteration(cleanWord);
  });

  return hindiWords.join(' ');
};

// Function to get payment mode in Hindi
const getPaymentModeHindi = (mode: string): string => {
  const modeMap: { [key: string]: string } = {
    'cash': 'नगद',
    'upi': 'यूपीआई',
    'cheque': 'चेक',
    'netbanking': 'नेट बैंकिंग',
    'online': 'ऑनलाइन',
    'card': 'कार्ड',
    'bank_transfer': 'बैंक स्थानांतरण',
    'advance_payment': 'अग्रिम भुगतान'
  };
  return modeMap[mode.toLowerCase()] || convertToHindi(mode);
};

// Local storage key for saved values
const SAVED_VALUES_KEY = 'hindi_receipt_saved_values';

// Interface for saved values
interface SavedValues {
  referredBy: string;
  bediNumber: string;
  customBediOptions: string[];
}

export const HindiReceipt: React.FC<HindiReceiptProps> = ({
  entry,
  payment,
  paymentIndex,
  isOpen,
  onClose,
  userRole
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  
  // Saved values state
  const [savedValues, setSavedValues] = useState<SavedValues>({
    referredBy: '',
    bediNumber: '1',
    customBediOptions: []
  });
  
  // Only keep referredBy as editable field for receipt notes
  const [referredBy, setReferredBy] = useState('');
  
  // Editable fields for receipt
  const [editableFields, setEditableFields] = useState({
    referredBy: '',
    otherDetails: ''
  });
  
  // Combined bedi options (default + custom) - kept for legacy data
  const allBediOptions = ['1', '2', '3', ...savedValues.customBediOptions];

  // Load saved values on component mount
  useEffect(() => {
    const stored = localStorage.getItem(SAVED_VALUES_KEY);
    if (stored) {
      const parsedValues = JSON.parse(stored);
      // Handle backward compatibility - add customBediOptions if missing
      // Filter out any unwanted default values that might have been saved as custom
      const cleanCustomOptions = (parsedValues.customBediOptions || []).filter(
        (option: string) => !['1', '2', '3', 'Pandal', '9'].includes(option)
      );
      
      const fullSavedValues = {
        referredBy: parsedValues.referredBy || '',
        bediNumber: parsedValues.bediNumber || '1',
        customBediOptions: cleanCustomOptions
      };
      setSavedValues(fullSavedValues);
      
      // Save the cleaned values back to localStorage
      localStorage.setItem(SAVED_VALUES_KEY, JSON.stringify(fullSavedValues));
      
      // Auto-fill with saved referredBy value
      setReferredBy(fullSavedValues.referredBy);
    }
  }, [isOpen]);

  // Function removed as fields are no longer editable

  // Function to add custom bedi option permanently
  const addCustomBediOption = (newOption: string) => {
    const trimmedOption = newOption.trim();
    if (trimmedOption && !allBediOptions.includes(trimmedOption)) {
      const updatedCustomOptions = [...savedValues.customBediOptions, trimmedOption];
      const updatedSavedValues = {
        ...savedValues,
        customBediOptions: updatedCustomOptions,
        bediNumber: trimmedOption
      };
      
      localStorage.setItem(SAVED_VALUES_KEY, JSON.stringify(updatedSavedValues));
      setSavedValues(updatedSavedValues);
      
      // Note: Custom bedi options are no longer editable in receipt
    }
  };

  // Save editable values function
  const handleSaveValues = () => {
    const valuesToSave: SavedValues = {
      referredBy: referredBy,
      bediNumber: entry.bediNumber || '1',
      customBediOptions: savedValues.customBediOptions
    };
    
    localStorage.setItem(SAVED_VALUES_KEY, JSON.stringify(valuesToSave));
    setSavedValues(valuesToSave);
    alert('Values saved successfully!');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const currentDate = new Date().toLocaleDateString('hi-IN');
      const amountInWords = numberToHindiWords(amountInRupees);
      const paymentModeHindi = getPaymentModeHindi(payment.mode);
      
      // Add श्री/श्रीमती/सुश्री prefix to user name and convert to Hindi
      const hindiUserName = convertToHindi(entry.userName);
      const formattedUserName = hindiUserName.startsWith('श्री') || hindiUserName.startsWith('श्रीमती') || hindiUserName.startsWith('सुश्री')
        ? hindiUserName 
        : `श्री/श्रीमती/सुश्री   ${hindiUserName}`;
      
      // Convert all text fields to Hindi
      const hindiDescription = convertToHindi(entry.description);
      const hindiOccasion = convertToHindi(entry.occasion);
      const hindiAddress = convertToHindi(entry.userAddress || '');
      
      // Add cache breaker for images
      const cacheBreaker = Date.now();
      
      const html = `
        <!DOCTYPE html>
        <html lang="hi">
          <head>
            <meta charset="UTF-8">
            <title>दान रसीद - ${payment.receiptNo}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
              
              body {
                font-family: 'Noto Sans Devanagari', 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                background: white;
                color: #000;
                font-size: 14px;
                line-height: 1.6;
              }
              
              .receipt-container {
                width: 210mm;
                height: 148mm;
                margin: 0 auto;
                border: 2px solid #000;
                padding: 0;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
              }
              
              .receipt-header {
                text-align: center;
                padding: 12px;
                background: #f8f9fa;
                position: relative;
                min-height: 70px;
              }
              
              .temple-name {
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 3px;
                color: #d97706;
                line-height: 1.1;
              }
              
              .temple-subtitle {
                font-size: 13px;
                margin-bottom: 1px;
                color: #666;
              }
              
              .receipt-title {
                font-size: 19px;
                font-weight: 600;
                margin-top: 4px;
                color: #000;
              }
              
              .receipt-body {
                padding: 12px;
                padding-top: 25px;
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                font-size: 16px;
              }
              
              .receipt-section {
                margin-bottom: 1px;
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
                justify-content: flex-start;
                align-items: center;
                margin-bottom: 1px;
                padding: 0;
                width: 100%;
                position: relative;
              }
              
              .receipt-label {
                font-weight: 600;
                color: #374151;
                font-size: 16px;
              }
              
              .receipt-value {
                color: #000;
                margin-left: 3px;
                font-size: 16px;
              }
              
              .left-item {
                display: flex;
                align-items: center;
                flex: 0 0 360px; /* Fixed width to prevent wrapping */
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              
              .right-item {
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                justify-content: flex-start;
                position: absolute;
                left: 500px; /* Align with first letter 'स' of 'समिति' */
                white-space: nowrap;
              }
              
              .amount-section {
                background: #fef3c7;
                padding: 6px;
                border: 1px solid #f59e0b;
                margin: 6px 0;
                border-radius: 3px;
              }
              
              .amount-large {
                font-size: 24px;
                font-weight: 700;
                color: #d97706;
              }
              
              .amount-words {
                font-size: 15px;
                font-style: italic;
                margin-top: 2px;
                color: #92400e;
              }
              
              .signature-section {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
                padding-top: 10px;
                border-top: 1px solid #e5e7eb;
              }
              
              .signature-box {
                text-align: center;
                flex: 1;
                margin: 0 5px;
              }
              
              .signature-line {
                border-top: 1px solid #000;
                margin-top: 45px;
                padding-top: 2px;
                font-size: 14px;
                color: #666;
              }
              
              .footer-notes {
                margin-top: 12px;
                padding: 8px;
                background: #f9fafb;
                border-radius: 3px;
                text-align: center;
                font-size: 11px;
                color: #6b7280;
              }
              
              .user-address {
                font-size: 14px;
                color: #6b7280;
                margin-top: 5px;
              }
              
              .two-column {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 20px;
              }
              
              .left-column {
                flex: 1;
                min-width: 0;
              }
              
              .right-column {
                flex: 1;
                text-align: right;
                min-width: 0;
              }
              
              .single-line {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              
              @media print {
                body { 
                  margin: 0; 
                  padding: 5px; 
                }
                .receipt-container {
                  border: 1px solid #000;
                  page-break-inside: avoid;
                  box-shadow: none;
                }
                @page {
                  size: A5 landscape;
                  margin: 10mm;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <!-- Header -->
              <div class="receipt-header" style="position: relative;">
                <!-- Left Logo - Jain Stambh (reduced by 10%: 74px - 10% = 67px) -->
                <div style="position: absolute; left: 50px; top: 8px;">
                  <img src="/uploads/jain-stabh-logo.jpg?v=${cacheBreaker}" 
                       alt="जैन स्तंभ" style="width: 67px; height: 100px; object-fit: contain;">
                </div>
                
                <!-- Right Logo - New Mandir Color (reduced by 10% from 104px to 94px) -->
                <div style="position: absolute; right: 50px; top: 8px;">
                  <img src="/uploads/new-logo-mandir-color.jpg?v=${cacheBreaker}" 
                       alt="मंदिर लोगो" style="width: 94px; height: 94px; object-fit: contain; border-radius: 50%;">
                </div>
                
                <!-- Center Text -->
                <div class="temple-name">श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति</div>
                <div class="temple-subtitle">शिवनगर, जबलपुर (म.प्र.)</div>
                <div class="receipt-title">दान रसीद</div>
              </div>
              
              <!-- Body -->
              <div class="receipt-body">
                <!-- Row 1: Receipt Number and Date -->
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="left-item">
                      <span class="receipt-label">अनुक्रमांक:</span>
                      <span class="receipt-value">${payment.receiptNo}</span>
                    </div>
                    <div class="right-item">
                      <span class="receipt-label">दिनांक:</span>
                      <span class="receipt-value">${formatDateDDMMYY(payment.date)}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Row 2: User Name and Boli Date -->
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="left-item">
                      <span class="receipt-label">धर्मानुयायी:</span>
                      <span class="receipt-value">${formattedUserName}</span>
                    </div>
                    <div class="right-item">
                      <span class="receipt-label">बोली दिनांक:</span>
                      <span class="receipt-value">${formatDateDDMMYY(entry.auctionDate)}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Row 3: Address and Payment Method -->
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="left-item">
                      <span class="receipt-label">पता:</span>
                      <span class="receipt-value">${hindiAddress ? `${hindiAddress}, शिवनगर, जबलपुर (म.प्र.)` : 'शिवनगर, जबलपुर (म.प्र.)'}</span>
                    </div>
                    <div class="right-item">
                      <span class="receipt-label">भुगतान विधि:</span>
                      <span class="receipt-value">${paymentModeHindi}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Row 4: Description and Bedi Number -->
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="left-item">
                      <span class="receipt-label">बाबत:</span>
                      <span class="receipt-value">${hindiDescription}</span>
                    </div>
                    <div class="right-item">
                      <span class="receipt-label">बेदी क्रमांक:</span>
                      <span class="receipt-value">${entry.bediNumber || '1'}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Row 5: Occasion -->
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="left-item">
                      <span class="receipt-label">विशेष अवसर:</span>
                      <span class="receipt-value">${hindiOccasion}</span>
                    </div>
                    <div class="right-item">
                      <!-- Empty right item for spacing -->
                    </div>
                  </div>
                </div>
                
                ${editableFields.referredBy || editableFields.otherDetails ? `
                <!-- Row 6: Editable Fields -->
                <div class="receipt-section">
                  <div class="receipt-row">
                    <div class="left-item">
                      <span class="receipt-label">द्वारा संदर्भित:</span>
                      <span class="receipt-value">${convertToHindi(editableFields.referredBy)}</span>
                    </div>
                    <div class="right-item">
                      <span class="receipt-label">अन्य विवरण:</span>
                      <span class="receipt-value">${convertToHindi(editableFields.otherDetails)}</span>
                    </div>
                  </div>
                </div>` : ''}
                
                <!-- Amount Section -->
                <div class="amount-section">
                  <div class="receipt-row">
                    <span class="receipt-label">राशि (अंकों में):</span>
                    <span class="receipt-value amount-large">₹${amountInRupees.toLocaleString('hi-IN')}</span>
                  </div>
                  <div class="amount-words">
                    शब्दों में: ${amountInWords} रुपये मात्र
                  </div>
                </div>
                
                <!-- Signature Section -->
                <div class="signature-section">
                  <div class="signature-box">
                    <div class="signature-line">दाता के हस्ताक्षर</div>
                  </div>
                  <div class="signature-box">
                    <div class="signature-line">हस्ताक्षर प्राप्तकर्ता</div>
                  </div>
                </div>
                
                <!-- Footer -->
                <div class="footer-notes">
                  <div>धन्यवाद! आपका सहयोग अमूल्य है।</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      
      // Show print preview instead of immediate print
      // User can then manually click print from the preview page
      setTimeout(() => {
        printWindow.print();
      }, 1000);
    }
  };

  const handleSaveAndPrint = () => {
    // Simply print the receipt with the data from entry
    handlePrint();
  };

  const amountInRupees = payment.amount; // Amount is already in rupees
  const amountInWords = numberToHindiWords(amountInRupees);
  const currentDate = formatDateDDMMYY(new Date().toISOString());
  const boliDate = formatDateDDMMYY(entry.auctionDate);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>दान रसीद - Edit & Print</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Save Values Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Save Common Values</h3>
                <Button onClick={handleSaveValues} variant="outline" size="sm">
                  Save Values
                </Button>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                Save common values (द्वारा संदर्भित) for auto-fill in future receipts
              </div>
              {savedValues.referredBy && (
                <div className="text-sm text-green-600">
                  ✓ Saved values: द्वारा संदर्भित: {savedValues.referredBy}
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Editable Fields Section */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4">Receipt Fields (Editable)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* द्वारा संदर्भित (Referred By) */}
                <div>
                  <Label htmlFor="referredBy">द्वारा संदर्भित</Label>
                  <Input
                    id="referredBy"
                    value={editableFields.referredBy}
                    onChange={(e) => setEditableFields(prev => ({ ...prev, referredBy: e.target.value }))}
                    placeholder="संदर्भ व्यक्ति का नाम"
                  />
                </div>

                {/* अन्य विवरण (Other Details) */}
                <div>
                  <Label htmlFor="otherDetails">अन्य विवरण</Label>
                  <Input
                    id="otherDetails"
                    value={editableFields.otherDetails}
                    onChange={(e) => setEditableFields(prev => ({ ...prev, otherDetails: e.target.value }))}
                    placeholder="अतिरिक्त जानकारी"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipt Information - Non-editable */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded text-center">
            <p className="text-gray-700">
              📄 बोली की जानकारी (बावत, विशेष अवसर, बेदी क्रमांक) मूल बोली एंट्री से ली गई है
            </p>
            <p className="text-sm text-gray-600 mt-1">
              इन विवरणों को बदलने के लिए कृपया मूल बोली एंट्री को संपादित करें
            </p>
          </div>

          {/* Receipt Preview - Colorful Format */}
          <div 
            ref={printRef}
            className="bg-white border-2 border-gray-800 rounded-lg shadow-lg print:shadow-none print:border-2 max-w-2xl mx-auto"
          >
            {/* Header */}
            <div className="bg-gray-100 py-4 px-6 border-b-2 border-gray-800 rounded-t-lg relative">
              {/* Left Logo - Jain Symbol */}
              <div className="absolute left-4 top-4">
                <img 
                  src="/jain-symbol.png" 
                  alt="Jain Symbol"
                  className="w-16 h-16 object-contain"
                />
              </div>
              
              {/* Right Logo - Temple Building */}
              <div className="absolute right-4 top-4">
                <img 
                  src="/temple-logo.png" 
                  alt="Temple Logo"
                  className="w-16 h-16 object-contain rounded-full"
                />
              </div>
              
              {/* Center Text */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-orange-600 mb-2">शिवनगर जैन मंदिर समिति</h1>
                <p className="text-gray-600 mb-1">शिवनगर, दमोह रोड, जबलपुर (म.प्र.)</p>
                <h2 className="text-lg font-semibold text-black mt-2">बोली भुगतान रसीद</h2>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              {/* Row 1: User Name and Address */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">धर्मानुयायी:</span>
                  <span className="text-black">{entry.userName.startsWith('श्री') || entry.userName.startsWith('श्रीमती') ? entry.userName : `श्री/श्रीमती ${entry.userName}`}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">पता:</span>
                  <span className="text-black">{entry.userAddress ? `${entry.userAddress}, शिवनगर, जबलपुर (म.प्र.)` : 'शिवनगर, जबलपुर (म.प्र.)'}</span>
                </div>
              </div>

              {/* Row 2: Receipt Number and Date */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">अनुक्रमांक:</span>
                  <span className="text-black">{payment.receiptNo}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">दिनांक:</span>
                  <span className="text-black">{formatDateDDMMYY(payment.date)}</span>
                </div>
              </div>

              {/* Row 3: Description and Bedi Number */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">बाबत:</span>
                  <span className="text-black">{convertToHindi(entry.description)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">बेदी क्रमांक:</span>
                  <span className="text-black">{entry.bediNumber || '1'}</span>
                </div>
              </div>

              {/* Row 4: Payment Method */}
              <div className="flex items-center space-x-1">
                <span className="font-semibold text-gray-700">भुगतान विधि:</span>
                <span className="text-black">{getPaymentModeHindi(payment.mode)}</span>
              </div>

              {/* Row 5: Boli Date and Occasion */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">बोली दिनांक:</span>
                  <span className="text-black">{boliDate}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">विशेष अवसर:</span>
                  <span className="text-black">{convertToHindi(entry.occasion)}</span>
                </div>
              </div>

              {/* Row 6: Editable Fields */}
              {(editableFields.referredBy || editableFields.otherDetails) && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1">
                    <span className="font-semibold text-gray-700">द्वारा संदर्भित:</span>
                    <span className="text-black">{convertToHindi(editableFields.referredBy)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="font-semibold text-gray-700">अन्य विवरण:</span>
                    <span className="text-black">{convertToHindi(editableFields.otherDetails)}</span>
                  </div>
                </div>
              )}

              {/* Amount Section - Highlighted */}
              <div className="bg-yellow-100 border border-yellow-400 rounded p-4 my-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-700">राशि (अंकों में):</span>
                  <span className="text-2xl font-bold text-orange-600">₹{amountInRupees.toLocaleString('hi-IN')}</span>
                </div>
                <div className="text-sm italic text-yellow-800">
                  शब्दों में: {amountInWords} रुपये मात्र
                </div>
              </div>

              {/* Signature Section */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-300">
                <div className="text-center flex-1">
                  <div className="border-t border-black mt-10 pt-1 text-xs text-gray-600">
                    दाता के हस्ताक्षर
                  </div>
                </div>
                <div className="text-center flex-1 mx-4">
                  <div className="border-t border-black mt-10 pt-1 text-xs text-gray-600">
                    हस्ताक्षर प्राप्तकर्ता
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 rounded p-3 text-center mt-6">
                <div className="text-sm text-gray-600">धन्यवाद! आपका सहयोग अमूल्य है।</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {userRole !== 'viewer' ? (
              <Button onClick={handleSaveAndPrint} className="bg-blue-600 hover:bg-blue-700">
                Save & Print Receipt
              </Button>
            ) : (
              <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
                Print Receipt Only
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};