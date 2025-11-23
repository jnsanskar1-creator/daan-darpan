import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, MessageCircle, Search, X, RefreshCw, Printer, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { OutstandingPaymentReceipt } from "@/components/outstanding-payment-receipt";

// Create a simplified media query hook inline
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

type PreviousOutstandingPayment = {
  id: string;
  recordId: number;
  recordNumber?: number;
  userId: number;
  userName: string;
  userMobile: string;
  userAddress: string;
  outstandingAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  status: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMode: string;
  receiptNo: string;
  fileUrl?: string;
  updatedBy: string;
  description: string;
  createdBy: string;
  createdAt: string;
};

export default function PreviousOutstandingPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Receipt dialog state
  const [selectedPayment, setSelectedPayment] = useState<PreviousOutstandingPayment | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  
  // Attachment dialog state
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);
  const [showAttachment, setShowAttachment] = useState(false);

  // Check permissions
  if (user?.role === 'viewer') {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">You don't have permission to view previous outstanding payments.</p>
        </div>
      </div>
    );
  }

  // Fetch payments data
  const { data: payments = [], isLoading, error } = useQuery<PreviousOutstandingPayment[]>({
    queryKey: ['/api/previous-outstanding-payments'],
  });

  // Generate receipt numbers mutation
  const generateReceiptsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/previous-outstanding-payments/generate-receipts', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to generate receipt numbers');
      }
      return response.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/previous-outstanding-payments'] });
      toast({
        title: "Success",
        description: response.message || "Receipt numbers generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate receipt numbers",
        variant: "destructive",
      });
    },
  });

  // Filter and sort payments based on search term and receipt number
  const filteredPayments = payments
    .filter(payment =>
      payment.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.userMobile?.includes(searchTerm) ||
      payment.receiptNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.paymentMode.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Extract receipt numbers (format: SPDJMSJ-2025-00001)
      const getReceiptNumber = (receiptNo: string) => {
        if (!receiptNo) return 0;
        const match = receiptNo.match(/SPDJMSJ-\d{4}-(\d{5})/);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      const aNum = getReceiptNumber(a.receiptNo || '');
      const bNum = getReceiptNumber(b.receiptNo || '');
      
      return bNum - aNum; // Descending order (highest receipt number first)
    });

  const formatAmount = (amount: number) => {
    return amount.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "bg-red-100 text-red-800 border-red-200",
      partial: "bg-yellow-100 text-yellow-800 border-yellow-200",
      full: "bg-green-100 text-green-800 border-green-200"
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.pending}>
        {status === 'pending' ? 'Pending' : status === 'partial' ? 'Partial' : 'Paid'}
      </Badge>
    );
  };

  const generateReceipt = (payment: PreviousOutstandingPayment) => {
    const receiptContent = `
===========================================
        शिवनगर जैन मंदिर
      Previous Outstanding Payment Receipt
===========================================

Receipt Number: ${payment.receiptNo}
Date: ${formatDate(payment.paymentDate)}

Payer Details:
Name: ${payment.userName}
Mobile: ${payment.userMobile || 'N/A'}
Address: ${payment.userAddress || 'N/A'}

Payment Details:
Description: ${payment.description}
Total Outstanding: ₹${formatAmount(payment.outstandingAmount)}
Payment Amount: ₹${formatAmount(payment.paymentAmount)}
Payment Mode: ${payment.paymentMode.toUpperCase()}
Remaining Balance: ₹${formatAmount(payment.pendingAmount)}

Recorded By: ${payment.updatedBy}
Generated On: ${format(new Date(), "dd/MM/yyyy HH:mm")}

===========================================
        Thank you for your payment!
           आपके सहयोग के लिए धन्यवाद!
===========================================
    `.trim();

    // Create and download receipt
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt-${payment.receiptNo}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Receipt Generated",
      description: `Receipt ${payment.receiptNo} has been downloaded`,
    });
  };

  const handleWhatsappClick = (payment: PreviousOutstandingPayment) => {
    const phoneNumber = payment.userMobile?.replace(/[^\d]/g, '') || '';
    
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Mobile number not available for this user",
        variant: "destructive"
      });
      return;
    }

    // Find all payments for this record ID to create combined message
    const recordPayments = filteredPayments.filter(p => p.recordId === payment.recordId);
    
    let message = '';
    
    if (recordPayments.length === 1) {
      // Single payment - use original format
      message = 
        `🏛️ शिवनगर जैन मंदिर के अग्रणी सदस्य आपका भुगतान सफलतापूर्वक प्राप्त हुआ है:\n\n` +
        `📝 विवरण: 31.07.2025 तक कुल शेष राशि:- ₹${payment.outstandingAmount.toLocaleString()}\n` +
        `🗓️ भुगतान दिनांक: ${formatDate(payment.paymentDate)}\n` +
        `💰 कुल राशि: ₹${payment.outstandingAmount.toLocaleString()}\n` +
        `✅ प्राप्त: ₹${payment.paymentAmount.toLocaleString()}\n` +
        `⏳ शेष: ₹${payment.pendingAmount.toLocaleString()}\n` +
        `💳 भुगतान माध्यम: ${payment.paymentMode}\n` +
        `🧾 रसीद नंबर: ${payment.receiptNo}\n\n` +
        `आपके सहयोग के लिए धन्यवाद! 🙏`;
    } else {
      // Multiple payments - use combined format
      const totalOutstanding = payment.outstandingAmount;
      const totalReceived = recordPayments.reduce((sum, p) => sum + p.paymentAmount, 0);
      const pendingAmount = totalOutstanding - totalReceived;
      
      // Get unique payment date (assuming all payments on same date for same record)
      const paymentDate = formatDate(payment.paymentDate);
      
      // Combine amounts, modes, and receipt numbers
      const amounts = recordPayments.map(p => `₹${p.paymentAmount.toLocaleString()}`).join(' + ');
      const modes = recordPayments.map(p => p.paymentMode).join(' + ');
      const receiptNumbers = recordPayments.map(p => p.receiptNo).join(' + ');
      
      message = 
        `🏛️ शिवनगर जैन मंदिर के अग्रणी सदस्य आपका भुगतान सफलतापूर्वक प्राप्त हुआ है:\n\n` +
        `📝 विवरण: 31.07.2025 तक कुल शेष राशि:- ₹${totalOutstanding.toLocaleString()}\n` +
        `🗓️ भुगतान दिनांक: ${paymentDate}\n` +
        `💰 कुल राशि: ₹${totalOutstanding.toLocaleString()}\n` +
        `✅ प्राप्त: ${amounts}\n` +
        `⏳ शेष: ₹${pendingAmount.toLocaleString()}\n` +
        `💳 भुगतान माध्यम: ${modes}\n` +
        `🧾 रसीद नंबर: ${receiptNumbers}\n\n` +
        `आपके सहयोग के लिए धन्यवाद! 🙏`;
    }
    
    // Use the same approach as working boli payments
    const whatsappUrl = `https://api.whatsapp.com/send?phone=91${phoneNumber}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const totalPayments = filteredPayments.reduce((sum, payment) => sum + payment.paymentAmount, 0);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading previous outstanding payments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">Failed to load previous outstanding payments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Previous Outstanding Payments</h1>
          <p className="text-gray-600">View and manage all payment records for previous outstanding amounts</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{filteredPayments.length}</div>
              <div className="text-sm text-blue-600">Total Payments</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">₹{formatAmount(totalPayments)}</div>
              <div className="text-sm text-green-600">Total Amount Received</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{new Set(filteredPayments.map(p => p.userId)).size}</div>
              <div className="text-sm text-purple-600">Unique Payers</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, mobile, receipt number, or payment mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Records ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No payment records found</p>
            </div>
          ) : (
            <>
              {/* Mobile view: Card layout */}
              {isMobile && (
                <div className="space-y-4">
                  {filteredPayments.map((payment) => (
                    <Card key={payment.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded font-mono">
                                {payment.recordNumber ? `REC-${payment.recordNumber}` : `REC-${payment.recordId}`}
                              </span>
                              {getStatusBadge(payment.status)}
                            </div>
                            <h3 className="font-medium text-lg">{payment.userName}</h3>
                            <p className="text-sm text-neutral-500">📱 {payment.userMobile}</p>
                            {payment.userAddress && (
                              <p className="text-xs text-neutral-600 mt-1">📍 {payment.userAddress}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 my-3 text-sm">
                          <div>
                            <p className="text-neutral-500">Total Outstanding:</p>
                            <p className="font-medium">₹{formatAmount(payment.outstandingAmount)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Payment Amount:</p>
                            <p className="text-green-600 font-medium">₹{formatAmount(payment.paymentAmount)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Received:</p>
                            <p className="text-green-600">₹{formatAmount(payment.receivedAmount)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Pending:</p>
                            <p className="text-red-600">₹{formatAmount(payment.pendingAmount)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 my-3 text-sm">
                          <div>
                            <p className="text-neutral-500">Payment Date:</p>
                            <p>{formatDate(payment.paymentDate)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Payment Mode:</p>
                            <p>{payment.paymentMode.toUpperCase()}</p>
                          </div>
                        </div>
                        
                        <div className="text-sm mb-3">
                          <p className="text-neutral-500">Receipt Number:</p>
                          <p className="font-mono text-sm">
                            {!payment.receiptNo || payment.receiptNo === 'No Receipt Generated' ? (
                              <span className="text-red-500 italic">No Receipt Generated</span>
                            ) : (
                              payment.receiptNo
                            )}
                          </p>
                        </div>
                        
                        <div className="text-xs text-neutral-500 mb-3">
                          Updated by {payment.updatedBy}
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowReceipt(true);
                            }}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Receipt
                          </Button>
                          {payment.fileUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAttachment(payment.fileUrl!);
                                setShowAttachment(true);
                              }}
                              className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View File
                            </Button>
                          )}
                          {payment.userMobile && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleWhatsappClick(payment)}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Desktop view: Table layout */}
              {!isMobile && (
                <div className="overflow-x-auto">
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record No.</TableHead>
                    <TableHead>Payer Details</TableHead>
                    <TableHead>Outstanding Details</TableHead>
                    <TableHead>Payment Info</TableHead>
                    <TableHead>Receipt & Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">
                          {payment.recordNumber ? `REC-${payment.recordNumber}` : `REC-${payment.recordId}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.userName}</div>
                          <div className="text-sm text-muted-foreground">{payment.userMobile}</div>
                          <div className="text-xs text-muted-foreground">{payment.userAddress}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">Total: ₹{formatAmount(payment.outstandingAmount)}</div>
                          <div className="text-sm text-green-600">Received: ₹{formatAmount(payment.receivedAmount)}</div>
                          <div className="text-sm text-red-600">Pending: ₹{formatAmount(payment.pendingAmount)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">₹{formatAmount(payment.paymentAmount)}</div>
                          <div className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</div>
                          <div className="text-xs text-muted-foreground">{payment.paymentMode.toUpperCase()}</div>
                          <div className="text-xs text-muted-foreground">by {payment.updatedBy}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-mono">
                            {!payment.receiptNo || payment.receiptNo === 'No Receipt Generated' ? (
                              <span className="text-red-500 italic">No Receipt Generated</span>
                            ) : (
                              payment.receiptNo
                            )}
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowReceipt(true);
                            }}
                            disabled={false}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Hindi Receipt
                          </Button>
                          {payment.fileUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAttachment(payment.fileUrl!);
                                setShowAttachment(true);
                              }}
                              className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Attachment
                            </Button>
                          )}
                          {payment.userMobile && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleWhatsappClick(payment)}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      {showReceipt && selectedPayment && (
        <OutstandingPaymentReceipt 
          record={{
            id: selectedPayment.recordId,
            userId: selectedPayment.userId,
            userName: selectedPayment.userName,
            userMobile: selectedPayment.userMobile,
            userAddress: selectedPayment.userAddress,
            outstandingAmount: selectedPayment.outstandingAmount,
            receivedAmount: selectedPayment.receivedAmount,
            pendingAmount: selectedPayment.pendingAmount,
            status: selectedPayment.status as 'pending' | 'partial' | 'full',
            payments: [{
              date: selectedPayment.paymentDate,
              amount: selectedPayment.paymentAmount,
              mode: selectedPayment.paymentMode,
              receiptNo: selectedPayment.receiptNo,
              updatedBy: selectedPayment.updatedBy
            }],
            description: selectedPayment.description,
            createdBy: selectedPayment.createdBy,
            createdAt: selectedPayment.createdAt,
            updatedAt: selectedPayment.createdAt
          }}
          payment={{
            date: selectedPayment.paymentDate,
            amount: selectedPayment.paymentAmount,
            mode: selectedPayment.paymentMode,
            receiptNo: selectedPayment.receiptNo,
            updatedBy: selectedPayment.updatedBy
          }}
          onClose={() => {
            setShowReceipt(false);
            setSelectedPayment(null);
          }}
        />
      )}

      {/* Attachment Dialog */}
      {showAttachment && selectedAttachment && (
        <Dialog open={showAttachment} onOpenChange={setShowAttachment}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Payment Attachment</DialogTitle>
            </DialogHeader>
            <div className="mt-4 overflow-auto">
              {selectedAttachment.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedAttachment}
                  className="w-full h-[70vh] border-0"
                  title="Payment Attachment"
                />
              ) : (
                <img
                  src={selectedAttachment}
                  alt="Payment Attachment"
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => window.open(selectedAttachment, '_blank')}
              >
                Open in New Tab
              </Button>
              <Button onClick={() => setShowAttachment(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}