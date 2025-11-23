import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PaymentMode, type Entry } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DatePicker from "react-datepicker";
import { useToast } from "@/hooks/use-toast";
import { HindiReceipt } from "@/components/hindi-receipt";
import "react-datepicker/dist/react-datepicker.css";
import { exportBoliPayments } from "@/lib/excel-export";
import { apiRequest } from "@/lib/queryClient";
import { Edit } from "lucide-react";

// Helper function to format dates from ISO string to DD/MM/YYYY format
const formatDate = (isoString: string) => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString('en-IN');
};

// WhatsApp notification function for payments
const sendWhatsAppPaymentNotification = (payment: any) => {
  // Clean phone number (remove spaces, dashes, parentheses)
  const cleanNumber = payment.userMobile?.replace(/[\s\-\(\)]/g, '');
  
  if (!cleanNumber) {
    alert('No phone number available for this user');
    return;
  }
  
  // Format phone number for WhatsApp (ensure it starts with country code)
  let formattedNumber = cleanNumber;
  if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
    formattedNumber = '91' + formattedNumber; // Add India country code
  }
  
  // Calculate payment amounts breakdown
  const paymentAmounts = payment.entry?.payments?.map((p: any) => `₹${p.amount}`) || [];
  const paymentAmountsText = paymentAmounts.join(' + ');
  
  // Calculate receipt numbers breakdown
  const receiptNumbers = payment.entry?.payments?.map((p: any) => p.receiptNo).filter((r: any) => r) || [];
  const receiptNumbersText = receiptNumbers.join(' + ');

  // Create payment confirmation message with simple text markers
  const message = 
    `शिवनगर जैन मंदिर के अग्रणी सदस्य आपका भुगतान सफलतापूर्वक प्राप्त हुआ है:\n\n` +
    `📝 विवरण: ${payment.entryDescription}\n` +
    `🗓️ भुगतान दिनांक: ${formatDate(payment.date)}\n` +
    `📅 बोली दिनांक: ${formatDate(payment.entry?.auctionDate) || 'N/A'}\n` +
    `💰 कुल राशि: ₹${payment.entry?.totalAmount?.toLocaleString() || 'N/A'}\n` +
    `✅ प्राप्त: ${paymentAmountsText}\n` +
    `⏳ शेष: ₹${payment.entry?.pendingAmount?.toLocaleString() || 'N/A'}\n` +
    `💳 भुगतान माध्यम: ${payment.mode}\n` +
    `🧾 रसीद नंबर: ${receiptNumbersText || 'N/A'}\n\n` +
    `आपके सहयोग के लिए धन्यवाद! 🙏`;
  
  // Create WhatsApp URL using different encoding approach
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
  
  // Open WhatsApp in new tab/window
  window.open(whatsappUrl, '_blank');
};

export default function Payments() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filterByMode, setFilterByMode] = useState("");
  
  // Edit upload state
  const [editUploadState, setEditUploadState] = useState<{
    isOpen: boolean;
    entryId: number | null;
    paymentIndex: number | null;
  }>({
    isOpen: false,
    entryId: null,
    paymentIndex: null
  });
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Edit payment state
  const [editPaymentState, setEditPaymentState] = useState<{
    isOpen: boolean;
    payment: any | null;
    entryId: number | null;
    paymentIndex: number | null;
  }>({
    isOpen: false,
    payment: null,
    entryId: null,
    paymentIndex: null
  });
  
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    mode: '',
    file: null as File | null
  });
  const [isEditingPayment, setIsEditingPayment] = useState(false);

// Handle file upload for editing payment screenshot
const handleUploadFile = async (entryId: number, paymentIndex: number, file: File) => {
  if (!file) return;
  
  setIsUploading(true);
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entryId', entryId.toString());
    formData.append('paymentIndex', paymentIndex.toString());
    
    const response = await fetch('/api/payments/update-attachment', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to update attachment');
    }
    
    // Refresh the data
    await queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
    await queryClient.refetchQueries({ queryKey: ['/api/entries'] });
    
    toast({
      title: "Success",
      description: "Payment attachment updated successfully",
    });
    
    // Close dialog and reset state
    setEditUploadState({ isOpen: false, entryId: null, paymentIndex: null });
    setUploadFile(null);
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to update attachment",
      variant: "destructive",
    });
  } finally {
    setIsUploading(false);
  }
};

  // Hindi Receipt state
  const [hindiReceiptState, setHindiReceiptState] = useState<{
    isOpen: boolean;
    entry: Entry | null;
    payment: any | null;
    paymentIndex: number;
  }>({
    isOpen: false,
    entry: null,
    payment: null,
    paymentIndex: -1
  });
  
  // Fetch all entries to extract payments
  const { data: entries, isLoading } = useQuery<Entry[]>({
    queryKey: ['/api/entries']
  });
  
  // Flatten all payments from all entries
  const allPayments = entries?.flatMap(entry => entry.payments.map((payment, paymentIndex) => ({
    ...payment,
    entryId: entry.id,
    paymentIndex,
    entryDescription: entry.description,
    userName: entry.userName,
    userMobile: entry.userMobile,
    entry: entry // Add entry reference for Hindi receipt
  }))) || [];
  
  // Sort all payments by receipt number in descending order
  const sortedPayments = [...allPayments].sort((a, b) => {
    // Extract receipt numbers (format: SPDJMSJ-2025-00001)
    const getReceiptNumber = (receiptNo: string) => {
      if (!receiptNo) return 0;
      const match = receiptNo.match(/SPDJMSJ-\d{4}-(\d{5})/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const aNum = getReceiptNumber(a.receiptNo || '');
    const bNum = getReceiptNumber(b.receiptNo || '');
    
    // If both have valid receipt numbers, sort by them
    if (aNum > 0 && bNum > 0) {
      return bNum - aNum; // Descending order
    }
    
    // If only one has a receipt number, prioritize it
    if (aNum > 0) return -1;
    if (bNum > 0) return 1;
    
    // If neither has receipt numbers, sort by date (fallback)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  
  // Apply filters
  const filteredPayments = sortedPayments.filter(payment => {
    // Search filter (case insensitive)
    const searchMatches = !searchQuery || 
      payment.entryDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.userMobile?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date range filter
    let dateMatches = true;
    if (dateRange[0] || dateRange[1]) {
      const paymentDate = new Date(payment.date);
      
      if (dateRange[0]) {
        // Start date is set, check if payment date is on or after it
        const startDate = new Date(dateRange[0]);
        startDate.setHours(0, 0, 0, 0);
        if (paymentDate < startDate) {
          dateMatches = false;
        }
      }
      
      if (dateRange[1]) {
        // End date is set, check if payment date is on or before it
        const endDate = new Date(dateRange[1]);
        // Set to end of day to include the full day
        endDate.setHours(23, 59, 59, 999);
        if (paymentDate > endDate) {
          dateMatches = false;
        }
      }
    }
    
    // Mode filter
    const modeMatches = !filterByMode || filterByMode === 'all' || payment.mode === filterByMode;
    
    return searchMatches && dateMatches && modeMatches;
  });

  // Function to delete a payment
  const handleDeletePayment = async (entryId: number, paymentIndex: number) => {
    if (confirm("Are you sure you want to delete this payment record? This will be logged as a credit entry.")) {
      try {
        // Make API call to delete the payment
        const response = await fetch(`/api/entries/${entryId}/payments/${paymentIndex}`, { 
          method: 'DELETE' 
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete payment');
        }
        
        toast({
          title: "Payment Deleted",
          description: "The payment record has been deleted and logged as a credit."
        });
        
        // Refresh all relevant data
        queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/transaction-logs'] });
      } catch (error) {
        console.error('Error deleting payment:', error);
        toast({
          title: "Error",
          description: "Failed to delete payment record",
          variant: "destructive"
        });
      }
    }
  };
  
  // Function to open edit payment dialog
  const openEditPaymentDialog = (payment: any, entryId: number, paymentIndex: number) => {
    setEditPaymentState({
      isOpen: true,
      payment,
      entryId,
      paymentIndex
    });
    
    // Pre-fill form data
    setEditFormData({
      date: payment.date ? new Date(payment.date).toISOString().split('T')[0] : '',
      amount: payment.amount.toString(),
      mode: payment.mode,
      file: null
    });
  };
  
  // Function to handle payment edit submission
  const handleEditPayment = async () => {
    if (!editPaymentState.entryId || editPaymentState.paymentIndex === null) return;
    
    setIsEditingPayment(true);
    
    try {
      const formData = new FormData();
      
      // Add fields based on user role
      if (user?.role === 'admin') {
        formData.append('date', editFormData.date);
        formData.append('amount', editFormData.amount);
        formData.append('mode', editFormData.mode);
      } else {
        // Operators can only edit mode
        formData.append('mode', editFormData.mode);
      }
      
      // Add file if present
      if (editFormData.file) {
        formData.append('file', editFormData.file);
      }
      
      const response = await fetch(
        `/api/entries/${editPaymentState.entryId}/payments/${editPaymentState.paymentIndex}`, 
        { 
          method: 'PATCH',
          body: formData
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to edit payment');
      }
      
      toast({
        title: "Payment Updated",
        description: "The payment record has been updated successfully."
      });
      
      // Close dialog and reset state
      setEditPaymentState({ isOpen: false, payment: null, entryId: null, paymentIndex: null });
      setEditFormData({ date: '', amount: '', mode: '', file: null });
      
      // Refresh all relevant data
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transaction-logs'] });
    } catch (error: any) {
      console.error('Error editing payment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to edit payment record",
        variant: "destructive"
      });
    } finally {
      setIsEditingPayment(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading payments...</div>;
  }

  return (
    <div className="flex-grow p-4 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium">All Boli Payments</h1>
          <p className="text-sm text-neutral-500">View all recorded boli payments</p>
        </div>
        <Button 
          onClick={() => exportBoliPayments(filteredPayments)}
          variant="outline"
          size="sm"
          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 rounded-full shadow-sm flex gap-2 items-center"
        >
          <span className="text-sm">📊</span>
          <span>Export</span>
        </Button>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <Label htmlFor="search" className="mb-1 block">Search</Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-icons text-neutral-500 text-lg">search</span>
              </span>
              <Input 
                id="search"
                placeholder="Search by description or user" 
                className="pl-10 pr-4 py-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Date Range Filter */}
          <div>
            <Label htmlFor="dateFilter" className="mb-1 block">Date Range</Label>
            <div className="datepicker-container w-full">
              <DatePicker
                selectsRange={true}
                startDate={dateRange[0]}
                endDate={dateRange[1]}
                onChange={(update) => {
                  setDateRange(update);
                }}
                isClearable={true}
                placeholderText="Select date range"
                className="w-full border rounded-md p-2 text-sm"
                dateFormat="MMM d, yyyy"
                monthsShown={2}
                showMonthYearPicker={false}
                calendarStartDay={1}
                fixedHeight
                renderMonthContent={(month, shortMonth) => <div>{shortMonth}</div>}
                renderCustomHeader={({
                  date,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
                }) => (
                  <div className="flex items-center justify-between px-2 py-2">
                    <button
                      onClick={decreaseMonth}
                      disabled={prevMonthButtonDisabled}
                      type="button"
                      className="p-1 rounded-full hover:bg-neutral-100"
                    >
                      <span className="material-icons">chevron_left</span>
                    </button>
                    <div className="text-lg font-medium">
                      {date.toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      type="button"
                      className="p-1 rounded-full hover:bg-neutral-100"
                    >
                      <span className="material-icons">chevron_right</span>
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
          
          {/* Payment Mode Filter */}
          <div>
            <Label htmlFor="modeFilter" className="mb-1 block">Payment Mode</Label>
            <Select
              value={filterByMode}
              onValueChange={setFilterByMode}
            >
              <SelectTrigger id="modeFilter">
                <SelectValue placeholder="All payment modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment modes</SelectItem>
                <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                <SelectItem value={PaymentMode.NETBANKING}>Net Banking</SelectItem>
                <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Payment list - desktop view */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden hidden md:block">
        <table className="w-full">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Receipt No.</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-neutral-500">
                  No payment records found
                </td>
              </tr>
            ) : (
              filteredPayments.map((payment, index) => (
                <tr key={`${payment.entryId}-${index}`} className="border-t border-neutral-200">
                  <td className="px-4 py-3">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">
                      {payment.receiptNo || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-blue-600 font-medium"
                      onClick={() => setLocation(`/entries/${payment.entryId}`)}
                    >
                      {payment.entryDescription}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div>{payment.userName}</div>
                      {payment.userMobile && (
                        <div className="text-xs text-neutral-500">📱 {payment.userMobile}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-green-500">
                    ₹{payment.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{payment.mode}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Hindi Receipt Button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-blue-600"
                        onClick={() => {
                          setHindiReceiptState({
                            isOpen: true,
                            entry: payment.entry,
                            payment: payment,
                            paymentIndex: payment.paymentIndex
                          });
                        }}
                      >
                        Hindi Receipt
                      </Button>
                      
                      {/* WhatsApp Button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-green-600"
                        onClick={() => sendWhatsAppPaymentNotification(payment)}
                      >
                        WhatsApp
                      </Button>
                      
                      {/* View Payment Screenshot Button (if available) */}
                      {payment.fileUrl && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-blue-600"
                            >
                              View Upload
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Payment Upload</DialogTitle>
                            </DialogHeader>
                            <div className="flex justify-center p-2">
                              <img 
                                src={payment.fileUrl}
                                alt="Payment upload" 
                                className="max-h-[70vh] object-contain"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {/* Edit Upload Button (Admin Only) */}
                      {user?.role === 'admin' && payment.fileUrl && (
                        <Dialog 
                          open={editUploadState.isOpen && editUploadState.entryId === payment.entryId && editUploadState.paymentIndex === payment.paymentIndex}
                          onOpenChange={(open) => {
                            if (open) {
                              setEditUploadState({
                                isOpen: true,
                                entryId: payment.entryId,
                                paymentIndex: payment.paymentIndex
                              });
                            } else {
                              setEditUploadState({ isOpen: false, entryId: null, paymentIndex: null });
                              setUploadFile(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-orange-600"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit Upload
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update Payment Screenshot</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="payment-file">Select New Screenshot</Label>
                                <Input
                                  id="payment-file"
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                  className="mt-2"
                                />
                              </div>
                              
                              {uploadFile && (
                                <div className="text-sm text-gray-600">
                                  Selected: {uploadFile.name}
                                </div>
                              )}
                              
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline"
                                  onClick={() => {
                                    setEditUploadState({ isOpen: false, entryId: null, paymentIndex: null });
                                    setUploadFile(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleUploadFile(payment.entryId, payment.paymentIndex, uploadFile!)}
                                  disabled={!uploadFile || isUploading}
                                >
                                  {isUploading ? 'Uploading...' : 'Update Screenshot'}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {/* Edit and Delete Controls - Admin and Operator */}
                      {(user?.role === 'admin' || user?.role === 'operator') && (
                        <>
                          {/* Edit Payment Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600"
                            onClick={() => openEditPaymentDialog(payment, payment.entryId, payment.paymentIndex)}
                            data-testid={`button-edit-payment-${payment.entryId}-${payment.paymentIndex}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </>
                      )}
                      
                      {/* Delete Control - Admin Only */}
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => handleDeletePayment(payment.entryId, payment.paymentIndex)}
                          data-testid={`button-delete-payment-${payment.entryId}-${payment.paymentIndex}`}
                        >
                          <span className="material-icons text-sm">delete</span>
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Payment list - mobile view */}
      <div className="md:hidden space-y-4">
        {filteredPayments.length === 0 ? (
          <div className="bg-white p-4 rounded-lg shadow text-center text-neutral-500">
            No payment records found
          </div>
        ) : (
          filteredPayments.map((payment, index) => (
            <Card key={`${payment.entryId}-${index}`} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-primary text-white p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{payment.entryDescription}</h3>
                      <p className="text-sm opacity-90">{payment.userName}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">₹{payment.amount.toLocaleString()}</div>
                      <div className="text-xs">{formatDate(payment.date)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-neutral-500">Receipt No:</p>
                      <p className="font-medium">{payment.receiptNo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500">Mode:</p>
                      <p className="font-medium">{payment.mode}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t flex justify-between">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-blue-600 text-sm"
                      onClick={() => setLocation(`/entries/${payment.entryId}`)}
                    >
                      View Entry
                    </Button>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-blue-600 text-xs"
                        onClick={() => {
                          setHindiReceiptState({
                            isOpen: true,
                            entry: payment.entry,
                            payment: payment,
                            paymentIndex: payment.paymentIndex
                          });
                        }}
                      >
                        Hindi Receipt
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-green-600 text-xs"
                        onClick={() => sendWhatsAppPaymentNotification(payment)}
                      >
                        WhatsApp
                      </Button>
                      
                      {payment.fileUrl && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-blue-600 text-xs"
                            >
                              View Upload
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Payment Upload</DialogTitle>
                            </DialogHeader>
                            <div className="flex justify-center p-2">
                              <img 
                                src={payment.fileUrl}
                                alt="Payment upload" 
                                className="max-h-[70vh] object-contain"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {/* Edit Upload Button for Mobile (Admin Only) */}
                      {user?.role === 'admin' && payment.fileUrl && (
                        <Dialog 
                          open={editUploadState.isOpen && editUploadState.entryId === payment.entryId && editUploadState.paymentIndex === payment.paymentIndex}
                          onOpenChange={(open) => {
                            if (open) {
                              setEditUploadState({
                                isOpen: true,
                                entryId: payment.entryId,
                                paymentIndex: payment.paymentIndex
                              });
                            } else {
                              setEditUploadState({ isOpen: false, entryId: null, paymentIndex: null });
                              setUploadFile(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-orange-600 text-xs"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update Payment Screenshot</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="payment-file-mobile">Select New Screenshot</Label>
                                <Input
                                  id="payment-file-mobile"
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                  className="mt-2"
                                />
                              </div>
                              
                              {uploadFile && (
                                <div className="text-sm text-gray-600">
                                  Selected: {uploadFile.name}
                                </div>
                              )}
                              
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline"
                                  onClick={() => {
                                    setEditUploadState({ isOpen: false, entryId: null, paymentIndex: null });
                                    setUploadFile(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleUploadFile(payment.entryId, payment.paymentIndex, uploadFile!)}
                                  disabled={!uploadFile || isUploading}
                                >
                                  {isUploading ? 'Updating...' : 'Update Screenshot'}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      
                      {/* Edit Payment Button for Mobile (Admin and Operator) */}
                      {(user?.role === 'admin' || user?.role === 'operator') && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-blue-600 text-xs"
                          onClick={() => openEditPaymentDialog(payment, payment.entryId, payment.paymentIndex)}
                          data-testid={`button-edit-payment-mobile-${payment.entryId}-${payment.paymentIndex}`}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit Payment
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Edit Payment Dialog */}
      <Dialog 
        open={editPaymentState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditPaymentState({ isOpen: false, payment: null, entryId: null, paymentIndex: null });
            setEditFormData({ date: '', amount: '', mode: '', file: null });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {user?.role === 'admin' ? (
              <>
                {/* Admin can edit all fields */}
                <div>
                  <Label htmlFor="edit-payment-date">Payment Date</Label>
                  <Input
                    id="edit-payment-date"
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="mt-2"
                    data-testid="input-edit-payment-date"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-payment-amount">Amount</Label>
                  <Input
                    id="edit-payment-amount"
                    type="number"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="mt-2"
                    data-testid="input-edit-payment-amount"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-payment-mode">Payment Mode</Label>
                  <Select
                    value={editFormData.mode}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, mode: value }))}
                  >
                    <SelectTrigger id="edit-payment-mode" className="mt-2" data-testid="select-edit-payment-mode">
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                      <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                      <SelectItem value={PaymentMode.NETBANKING}>Net Banking</SelectItem>
                      <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-payment-file">
                    Payment Screenshot {editPaymentState.payment?.mode === PaymentMode.CASH && editFormData.mode !== PaymentMode.CASH && editFormData.mode !== '' ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-gray-500">(Optional)</span>
                    )}
                  </Label>
                  {editPaymentState.payment?.mode === PaymentMode.CASH && editFormData.mode !== PaymentMode.CASH && editFormData.mode !== '' && (
                    <p className="text-sm text-amber-600 mb-2">
                      Required when changing from cash to UPI/other modes
                    </p>
                  )}
                  <Input
                    id="edit-payment-file"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setEditFormData(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                    className="mt-2"
                    data-testid="input-edit-payment-file"
                  />
                  {editFormData.file && (
                    <p className="text-sm text-gray-600 mt-1">Selected: {editFormData.file.name}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Operators can only edit mode */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> As an operator, you can only edit the payment mode. 
                    Date and amount changes require admin access.
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="edit-payment-mode-operator">Payment Mode</Label>
                  <Select
                    value={editFormData.mode}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, mode: value }))}
                  >
                    <SelectTrigger id="edit-payment-mode-operator" className="mt-2" data-testid="select-edit-payment-mode-operator">
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                      <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                      <SelectItem value={PaymentMode.NETBANKING}>Net Banking</SelectItem>
                      <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Show file input if changing from cash to non-cash */}
                {editPaymentState.payment?.mode === PaymentMode.CASH && 
                 editFormData.mode !== PaymentMode.CASH && (
                  <div>
                    <Label htmlFor="edit-payment-file-operator">
                      Payment Screenshot <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-sm text-gray-600 mb-2">
                      Required when changing from cash to UPI/other modes
                    </p>
                    <Input
                      id="edit-payment-file-operator"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setEditFormData(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                      className="mt-2"
                      data-testid="input-edit-payment-file-operator"
                    />
                    {editFormData.file && (
                      <p className="text-sm text-gray-600 mt-1">Selected: {editFormData.file.name}</p>
                    )}
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline"
                onClick={() => {
                  setEditPaymentState({ isOpen: false, payment: null, entryId: null, paymentIndex: null });
                  setEditFormData({ date: '', amount: '', mode: '', file: null });
                }}
                disabled={isEditingPayment}
                data-testid="button-cancel-edit-payment"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditPayment}
                disabled={isEditingPayment}
                data-testid="button-save-edit-payment"
              >
                {isEditingPayment ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Hindi Receipt Component */}
      {hindiReceiptState.isOpen && hindiReceiptState.entry && hindiReceiptState.payment && (
        <HindiReceipt
          entry={hindiReceiptState.entry}
          payment={hindiReceiptState.payment}
          paymentIndex={hindiReceiptState.paymentIndex}
          isOpen={hindiReceiptState.isOpen}
          onClose={() => setHindiReceiptState({
            isOpen: false,
            entry: null,
            payment: null,
            paymentIndex: -1
          })}
        />
      )}
    </div>
  );
}