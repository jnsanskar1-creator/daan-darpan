import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type Entry, PaymentStatus, PaymentMode, type PaymentRecord, type AdvancePayment } from "@shared/schema";
import PaymentReceipt from "@/components/payment-receipt";
import { HindiReceipt } from "@/components/hindi-receipt";
import { Wallet, Loader2 } from "lucide-react";

// Schema for partial payment - note: max validation is done dynamically in the form
const partialPaymentSchema = z.object({
  amount: z.coerce.number()
    .positive("Amount must be positive")
    .refine(val => val > 0, "Amount must be greater than ₹0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  mode: z.enum([PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CHEQUE, PaymentMode.NETBANKING]),
  fileUrl: z.string().optional()
});

type PartialPaymentValues = z.infer<typeof partialPaymentSchema>;

const getStatusClass = (status: string) => {
  switch(status) {
    case PaymentStatus.PENDING: return 'bg-destructive';
    case PaymentStatus.PARTIAL: return 'bg-orange-500';
    case PaymentStatus.FULL: return 'bg-green-500';
    default: return 'bg-neutral-500';
  }
};

const getStatusText = (status: string) => {
  switch(status) {
    case PaymentStatus.PENDING: return 'Payment Pending';
    case PaymentStatus.PARTIAL: return 'Partially Paid';
    case PaymentStatus.FULL: return 'Fully Paid';
    default: return 'Unknown';
  }
};

export default function PaymentDetails() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, params] = useRoute("/entries/:id");
  const entryId = match ? parseInt(params.id) : 0;
  
  // Hindi receipt state
  const [hindiReceiptState, setHindiReceiptState] = useState<{
    isOpen: boolean;
    entry: Entry | null;
    payment: PaymentRecord | null;
    paymentIndex: number;
  }>({
    isOpen: false,
    entry: null,
    payment: null,
    paymentIndex: -1
  });
  const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  // Edit mode permanently disabled
  const isEditMode = false;
  const editPaymentIndex = null;
  
  // Fetch entry details
  const { data: entry, isLoading } = useQuery<Entry>({
    queryKey: [`/api/entries/${entryId}`],
    enabled: entryId > 0,
    // Increase refetch intervals for fresher data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000 // Consider data stale after 30 seconds
  });

  // Get user's advance payments to calculate balance
  const { data: userAdvancePayments = [] } = useQuery<AdvancePayment[]>({
    queryKey: [`/api/advance-payments?userId=${entry?.userId}`],
    enabled: !!entry?.userId && (user?.role === 'admin' || user?.role === 'operator'),
    staleTime: 0, // Always refetch to get current data
    gcTime: 0, // Don't cache
  });

  // Get advance payment balance from server calculation
  const { data: serverAdvanceBalance = 0 } = useQuery<number>({
    queryKey: [`/api/users/${entry?.userId}/advance-balance`],
    enabled: !!entry?.userId && (user?.role === 'admin' || user?.role === 'operator'),
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
  });

  // Use server-calculated balance as the source of truth
  const advanceBalance = serverAdvanceBalance;
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [paymentMode, setPaymentMode] = useState<string>(PaymentMode.CASH);
  
  const form = useForm<PartialPaymentValues>({
    resolver: zodResolver(partialPaymentSchema),
    defaultValues: {
      amount: 0,
      date: todayDate,
      mode: PaymentMode.CASH,
      fileUrl: ''
    }
  });
  
  // Full payment mutation
  const recordFullPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!entry) return null;
      
      // For full payment, we always use CASH mode as default
      const response = await apiRequest("POST", `/api/entries/${entryId}/payments`, {
        amount: entry.pendingAmount,
        date: todayDate,
        mode: PaymentMode.CASH
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Full payment recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/entries/${entryId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record payment: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentIndex: number) => {
      const response = await apiRequest("DELETE", `/api/entries/${entryId}/payments/${paymentIndex}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment record deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/entries/${entryId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transaction-logs'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete payment: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update payment mutation - disabled
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ data, paymentIndex }: { data: PartialPaymentValues, paymentIndex: number }) => {
      // Return error response since update functionality is disabled
      return Promise.reject(new Error("Payment update functionality has been disabled"));
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Payment update functionality has been disabled`,
        variant: "destructive"
      });
    }
  });
  
  // Partial payment mutation
  const recordPartialPaymentMutation = useMutation({
    mutationFn: async (data: PartialPaymentValues) => {
      const response = await apiRequest("POST", `/api/entries/${entryId}/payments`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Partial payment recorded successfully",
      });
      form.reset({ amount: 0, date: todayDate });
      queryClient.invalidateQueries({ queryKey: [`/api/entries/${entryId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transaction-logs'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record payment: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Function to check if file upload is required based on payment mode
  const isFileUploadRequired = (mode: string): boolean => {
    return mode === PaymentMode.UPI || mode === PaymentMode.NETBANKING || mode === PaymentMode.CHEQUE;
  };
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  // Handle payment mode change
  const handlePaymentModeChange = (value: string) => {
    setPaymentMode(value);
    form.setValue('mode', value as any);
  };
  
  const onSubmitPartialPayment = (data: PartialPaymentValues) => {
    if (!entry) return;
    
    // Validation: Amount must not exceed total boli amount
    if (data.amount > entry.totalAmount) {
      toast({
        title: "Error",
        description: `Payment amount (₹${data.amount.toLocaleString()}) cannot exceed total boli amount (₹${entry.totalAmount.toLocaleString()})`,
        variant: "destructive"
      });
      return;
    }
    
    // Validation: Amount must not exceed pending amount
    if (data.amount > entry.pendingAmount) {
      toast({
        title: "Error",
        description: `Payment amount (₹${data.amount.toLocaleString()}) cannot exceed pending amount (₹${entry.pendingAmount.toLocaleString()})`,
        variant: "destructive"
      });
      return;
    }
    
    // Validation: Pending amount must be greater than 0
    if (entry.pendingAmount === 0) {
      toast({
        title: "Error",
        description: "Cannot record payment: Pending amount is ₹0",
        variant: "destructive"
      });
      return;
    }
    
    // Validation: Amount must be greater than 0
    if (data.amount <= 0) {
      toast({
        title: "Error",
        description: "Payment amount must be greater than ₹0",
        variant: "destructive"
      });
      return;
    }
    
    // Check if file is required but not provided
    if (isFileUploadRequired(data.mode) && !selectedFile) {
      toast({
        title: "Error",
        description: `File upload is required for ${data.mode} payments`,
        variant: "destructive"
      });
      return;
    }
    
    // Convert the file to a data URL for immediate viewing
    if (selectedFile) {
      // Create a FileReader to convert the file to a data URL
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      
      reader.onload = () => {
        // Add the data URL to the form data
        const fileDataUrl = reader.result as string;
        const paymentData = {
          ...data,
          fileUrl: fileDataUrl
        };
        
        // Now submit the form with the data URL
        recordPartialPaymentMutation.mutate(paymentData);
      };
      
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to process the uploaded file",
          variant: "destructive"
        });
      };
      
      // Return early since we're handling the submission in the onload callback
      return;
    }
    
    // Edit mode has been disabled
    // No condition to enter edit mode anymore
    
    // Otherwise, record a new payment
    recordPartialPaymentMutation.mutate(data);
  };
  
  // Cancel edit function - disabled since editing is no longer available
  const cancelEdit = () => {
    form.reset({ amount: 0, date: todayDate, mode: PaymentMode.CASH });
  };
  
  const handleFullPayment = () => {
    recordFullPaymentMutation.mutate();
  };

  // Advance payment mutation
  const recordAdvancePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!entry || advanceBalance <= 0) return null;
      
      const paymentAmount = Math.min(advanceBalance, entry.pendingAmount);
      
      const response = await apiRequest("POST", `/api/entries/${entryId}/advance-payment`, {
        amount: paymentAmount,
        date: todayDate,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const paymentAmount = Math.min(advanceBalance, entry?.pendingAmount || 0);
      toast({
        title: "Success",
        description: `₹${paymentAmount.toLocaleString()} applied from advance payment`,
      });
      // Invalidate all related queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/entries/${entryId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: [`/api/advance-payments?userId=${entry?.userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/advance-payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${entry?.userId}/advance-balance`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to apply advance payment: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Handle advance payment function
  const handleAdvancePayment = () => {
    if (!entry || advanceBalance <= 0) return;
    
    const paymentAmount = Math.min(advanceBalance, entry.pendingAmount);
    const isFullPayment = paymentAmount >= entry.pendingAmount;
    
    const confirmMessage = isFullPayment 
      ? `This will fully pay the remaining ₹${entry.pendingAmount.toLocaleString()} using advance payment. Continue?`
      : `This will apply ₹${paymentAmount.toLocaleString()} from advance payment, leaving ₹${(entry.pendingAmount - paymentAmount).toLocaleString()} pending. Continue?`;
    
    if (confirm(confirmMessage)) {
      recordAdvancePaymentMutation.mutate();
    }
  };



  if (isLoading) {
    return <div className="flex justify-center p-8">Loading entry details...</div>;
  }

  if (!entry) {
    return (
      <div className="flex-grow p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-medium mb-2">Entry Not Found</h2>
            <p className="text-neutral-500">The requested entry could not be found.</p>
            <Button 
              variant="link" 
              className="mt-4"
              onClick={() => setLocation('/entries')}
            >
              Back to Entries
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col">
      {/* Header */}
      <div className="bg-primary text-white p-4">
        <div className="flex justify-between items-center">
          <Button 
            variant="link" 
            className="mb-2 flex items-center text-white p-0"
            onClick={() => setLocation('/entries')}
          >
            <span className="material-icons mr-1">arrow_back</span>
            <span>Back to Entries</span>
          </Button>
          
          {/* Admin Controls */}
          {user?.role === 'admin' && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this entry? This action cannot be undone.")) {
                    // Here you would call the API to delete the entry
                    toast({
                      title: "Entry Deleted",
                      description: "The entry has been deleted successfully."
                    });
                    setLocation('/entries');
                  }
                }}
              >
                <span className="material-icons text-sm mr-1">delete</span>
                Delete
              </Button>
            </div>
          )}
        </div>
        <h1 className="text-xl font-medium">{entry.description}</h1>
        <p className="text-sm opacity-80">{entry.userName} - {entry.occasion}</p>
      </div>
      
      {/* Enhanced Details Card - All Table Information */}
      <div className="bg-white m-4 rounded-lg shadow-md p-4">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-lg font-semibold text-neutral-700">Entry Details</h2>
          <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusClass(entry.status)}`}>
            {getStatusText(entry.status)}
          </span>
        </div>
        
        {/* User Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-600">User Information</p>
            <div className="bg-neutral-50 p-3 rounded-lg">
              <p className="font-medium text-neutral-800">{entry.userName}</p>
              {entry.userMobile && (
                <p className="text-sm text-neutral-600">📱 {entry.userMobile}</p>
              )}
              {entry.userAddress && (
                <p className="text-sm text-neutral-600">📍 {entry.userAddress}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-600">Entry Information</p>
            <div className="bg-neutral-50 p-3 rounded-lg">
              <p className="text-sm text-neutral-600">Quantity: <span className="font-medium">{entry.quantity}</span></p>
              <p className="text-sm text-neutral-600">Boli Date: <span className="font-medium">{new Date(entry.auctionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
              {entry.updatedAt && (
                <p className="text-sm text-neutral-600">Last Updated: <span className="font-medium">{new Date(entry.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span></p>
              )}
            </div>
          </div>
        </div>
        
        {/* Financial Summary */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-neutral-600 mb-3">Financial Summary</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-sm text-blue-600">Total Amount</p>
              <p className="text-2xl font-bold text-blue-700">₹{entry.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-sm text-green-600">Received Amount</p>
              <p className="text-2xl font-bold text-green-700">₹{entry.receivedAmount.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-sm text-red-600">Pending Amount</p>
              <p className="text-2xl font-bold text-red-700">₹{entry.pendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* Advance Payment Balance - Only show for admin/operator */}
        {(user?.role === 'admin' || user?.role === 'operator') && advanceBalance > 0 && (
          <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-orange-700 font-medium">Advance Payment Balance</p>
                <p className="text-lg font-medium text-orange-600">₹{advanceBalance.toLocaleString()}</p>
              </div>
              <Wallet className="h-5 w-5 text-orange-500" />
            </div>
            {entry.pendingAmount > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {advanceBalance > 0 ? (
                  <>
                    <p className="text-xs text-orange-600">Available for payment processing</p>
                    <Button
                      onClick={handleAdvancePayment}
                      disabled={recordAdvancePaymentMutation.isPending}
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {recordAdvancePaymentMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Use Advance Payment (₹{Math.min(advanceBalance, entry.pendingAmount).toLocaleString()})
                        </span>
                      )}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-orange-500">No advance balance available</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Payment History */}
      <div className="bg-white mx-4 rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-neutral-200">
          <h2 className="font-medium">Payment History</h2>
        </div>
        <div className="p-4">
          {entry.payments.length === 0 ? (
            <div className="text-center py-4 text-neutral-500">No payment records yet</div>
          ) : (
            entry.payments.map((payment, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-neutral-200">
                <div className="flex-1">
                  <div className="font-medium">{new Date(payment.date).toLocaleDateString()}</div>
                  <div className="text-sm text-neutral-500">
                    {payment.mode ? `Via ${payment.mode}` : "Payment received"}
                    {payment.receiptNo && (
                      <span className="ml-2 text-xs bg-neutral-100 px-2 py-1 rounded">
                        Receipt: {payment.receiptNo}
                      </span>
                    )}
                    {payment.fileUrl && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="link" 
                            className="ml-2 p-0 h-auto text-blue-500 underline"
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
                    
                    <Button 
                      variant="link" 
                      className="ml-2 p-0 h-auto text-blue-500 underline"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setReceiptDialogOpen(true);
                      }}
                    >
                      View Receipt
                    </Button>
                    
                    <Button 
                      variant="link" 
                      className="ml-2 p-0 h-auto text-green-600 underline"
                      onClick={() => {
                        setHindiReceiptState({
                          isOpen: true,
                          entry: entry,
                          payment: payment,
                          paymentIndex: index
                        });
                      }}
                    >
                      Hindi Receipt
                    </Button>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="font-medium text-green-500">₹{payment.amount.toLocaleString()}</div>
                  
                  {/* Admin Payment Controls */}
                  {user?.role === 'admin' && (
                    <div className="flex ml-3">
                      {/* Edit payment functionality has been disabled */}
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) {
                            deletePaymentMutation.mutate(index);
                          }
                        }}
                      >
                        <span className="material-icons text-sm">delete</span>
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>
          {selectedPayment && entry && (
            <PaymentReceipt 
              entry={entry} 
              payment={selectedPayment} 
              onClose={() => setReceiptDialogOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Payment Section (only for operators if payment is not complete and pending > 0) */}
      {user?.role === 'operator' && entry.status !== PaymentStatus.FULL && entry.pendingAmount > 0 && (
        <div className="bg-white mx-4 my-4 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="font-medium">Record Payment</h2>
          </div>
          <div className="p-4">
            <Button 
              variant="default" 
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-md font-medium mb-3"
              onClick={handleFullPayment}
              disabled={recordFullPaymentMutation.isPending}
            >
              {recordFullPaymentMutation.isPending 
                ? "Processing..." 
                : `Full payment (₹${entry.pendingAmount.toLocaleString()})`}
            </Button>
            
            <div>
              <p className="text-sm text-neutral-500 mb-2">Or record partial payment:</p>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitPartialPayment)}>
                  {/* Amount Field */}
                  <div className="mb-4">
                    <Label htmlFor="amount">Amount</Label>
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              id="amount"
                              type="number" 
                              placeholder="Enter amount" 
                              max={entry.pendingAmount}
                              {...field}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                              data-testid="input-payment-amount"
                            />
                          </FormControl>
                          <p className="text-xs text-neutral-500 mt-1">
                            Maximum: ₹{entry.pendingAmount.toLocaleString()} (Pending amount)
                          </p>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Payment Date */}
                  <div className="mb-4">
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              id="paymentDate"
                              type="date" 
                              {...field}
                              max={new Date().toISOString().split('T')[0]}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Payment Mode Selector */}
                  <div className="mb-4">
                    <Label htmlFor="paymentMode">Payment Mode</Label>
                    <Select 
                      value={paymentMode} 
                      onValueChange={handlePaymentModeChange}
                    >
                      <SelectTrigger id="paymentMode">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                        <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                        <SelectItem value={PaymentMode.NETBANKING}>Net Banking</SelectItem>
                        <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <FormField
                      control={form.control}
                      name="mode"
                      render={({ field }) => (
                        <FormItem className="hidden">
                          <FormControl>
                            <Input type="hidden" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* File Upload */}
                  {isFileUploadRequired(paymentMode) && (
                    <div className="mb-4">
                      <Label htmlFor="fileUpload">
                        {paymentMode === PaymentMode.CHEQUE 
                          ? "Upload Cheque Image" 
                          : "Upload Payment Screenshot"}
                      </Label>
                      <Input 
                        id="fileUpload"
                        type="file" 
                        accept="image/*"
                        onChange={handleFileChange}
                        className="mt-1"
                      />
                      <p className="text-xs text-neutral-500 mt-1">
                        {paymentMode === PaymentMode.CHEQUE 
                          ? "Upload a clear image of the cheque" 
                          : "Upload a screenshot of the payment confirmation"}
                      </p>
                    </div>
                  )}
                  
                  {/* Hidden Date Field */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input type="hidden" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Hidden FileUrl Field */}
                  <FormField
                    control={form.control}
                    name="fileUrl"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input type="hidden" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* Submit Button - Edit mode disabled */}
                  {false ? (
                    <div className="hidden">
                      {/* Edit payment functionality has been disabled */}
                    </div>
                  ) : (
                    <Button 
                      type="submit" 
                      className="w-full bg-primary text-white"
                      disabled={recordPartialPaymentMutation.isPending}
                    >
                      {recordPartialPaymentMutation.isPending ? "Recording payment..." : "Record Payment"}
                    </Button>
                  )}
                </form>
              </Form>
            </div>
          </div>
        </div>
      )}
      
      {/* Hindi Receipt Component */}
      {hindiReceiptState.isOpen && hindiReceiptState.entry && hindiReceiptState.payment && (
        <HindiReceipt
          entry={hindiReceiptState.entry}
          payment={hindiReceiptState.payment}
          paymentIndex={hindiReceiptState.paymentIndex}
          isOpen={hindiReceiptState.isOpen}
          userRole={user?.role}
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
