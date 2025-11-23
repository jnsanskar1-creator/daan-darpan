import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, FileText, CreditCard, Receipt } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { OutstandingPaymentReceipt } from "@/components/outstanding-payment-receipt";

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
  attachmentUrl?: string;
  attachmentName?: string;
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

export default function PreviousOutstandingDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Payment form state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  
  // Receipt dialog state
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Check permissions
  if (user?.role === 'viewer') {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">You don't have permission to view previous outstanding details.</p>
        </div>
      </div>
    );
  }

  // Fetch record details
  const { data: record, isLoading, error } = useQuery<PreviousOutstandingRecord>({
    queryKey: [`/api/previous-outstanding/${id}`],
    enabled: !!id,
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (paymentData: FormData) => {
      const response = await fetch(`/api/previous-outstanding/${id}/payment`, {
        method: 'POST',
        body: paymentData,
      });
      if (!response.ok) {
        throw new Error('Failed to record payment');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both the specific record and the list
      queryClient.invalidateQueries({ queryKey: [`/api/previous-outstanding/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/previous-outstanding`] });
      setIsPaymentDialogOpen(false);
      resetPaymentForm();
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode("cash");
    setPaymentFile(null);
  };

  const handleRecordPayment = () => {
    if (!paymentAmount || !paymentDate || !paymentMode) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate payment screenshot for non-cash payments
    if (paymentMode !== "cash" && !paymentFile) {
      toast({
        title: "Error", 
        description: "Payment screenshot is required for non-cash payments",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('amount', parseFloat(paymentAmount).toString()); // Keep in rupees
    formData.append('date', paymentDate);
    formData.append('mode', paymentMode);
    if (paymentFile) formData.append('paymentFile', paymentFile);

    recordPaymentMutation.mutate(formData);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAmount = (amount: number | undefined) => {
    if (!amount && amount !== 0) return '0';
    return amount.toLocaleString('en-IN');
  };

  const getStatusBadge = (status: string, pendingAmount: number) => {
    if (status === 'full' || pendingAmount <= 0) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Payment Completed</Badge>;
    } else if (status === 'partial' && pendingAmount > 0) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Partially Paid</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Payment Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Record</h2>
          <p className="text-red-600">Failed to load the previous outstanding record. Please try again.</p>
          <pre className="text-xs mt-2">{JSON.stringify(error, null, 2)}</pre>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Record Not Found</h2>
          <p className="text-red-600">The previous outstanding record you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Debug: Log the record data
  console.log('Record data:', record);
  console.log('Record ID from params:', id);
  console.log('Is loading:', isLoading);
  console.log('Error:', error);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => setLocation('/previous-outstanding')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Records
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Previous Outstanding Details</h1>
          <p className="text-muted-foreground">
            Outstanding record for {record.userName}
          </p>
        </div>
      </div>

      {/* User & Record Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Name</Label>
              <p className="font-medium">{record.userName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Mobile</Label>
              <p>{record.userMobile}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Address</Label>
              <p>{record.userAddress}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Description</Label>
              <p className="font-medium">{record.description}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Created Date</Label>
              <p>{formatDate(record.createdAt)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Created By</Label>
              <p>{record.createdBy}</p>
            </div>
            {record.attachmentUrl && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Attachment</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Check if file exists by making a HEAD request first
                      fetch(record.attachmentUrl!, { method: 'HEAD' })
                        .then(response => {
                          if (response.ok) {
                            window.open(record.attachmentUrl, '_blank');
                          } else {
                            toast({
                              title: "File Not Found",
                              description: "The attachment file could not be found. It may have been moved or deleted.",
                              variant: "destructive"
                            });
                          }
                        })
                        .catch(() => {
                          toast({
                            title: "Error",
                            description: "Could not access the attachment file.",
                            variant: "destructive"
                          });
                        });
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View Attachment
                  </Button>
                  {record.attachmentName && (
                    <span className="text-sm text-muted-foreground">{record.attachmentName}</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Payment Summary
            {getStatusBadge(record.status, record.pendingAmount)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">₹{formatAmount(record.outstandingAmount)}</div>
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">₹{formatAmount(record.receivedAmount || 0)}</div>
              <p className="text-sm text-muted-foreground">Received Amount</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">₹{formatAmount(record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount)}</div>
              <p className="text-sm text-muted-foreground">Pending Amount</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History & Record Payment */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            {((record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount) || 0) > 0 && (
              <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount (₹) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Enter amount"
                        max={(record.pendingAmount || record.outstandingAmount) / 100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mode">Payment Mode *</Label>
                      <Select value={paymentMode} onValueChange={setPaymentMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="netbanking">Net Banking</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {paymentMode !== "cash" && (
                      <div>
                        <Label htmlFor="file">Payment Screenshot *</Label>
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                          required={paymentMode !== "cash"}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload proof of payment (screenshot, receipt, etc.)
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleRecordPayment} 
                        disabled={recordPaymentMutation.isPending}
                        className="flex-1"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                      </Button>
                      <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!record.payments || record.payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Receipt No</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.payments.map((payment, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">₹{formatAmount(payment.amount)}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{payment.mode}</TableCell>
                      <TableCell>{payment.updatedBy || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.receiptNo || 'No Receipt'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {payment.receiptNo && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowReceipt(true);
                              }}
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              Receipt
                            </Button>
                          )}
                          {payment.fileUrl && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(payment.fileUrl, '_blank')}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Proof
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
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      {showReceipt && selectedPayment && record && (
        <OutstandingPaymentReceipt 
          record={record}
          payment={selectedPayment}
          onClose={() => {
            setShowReceipt(false);
            setSelectedPayment(null);
          }}
        />
      )}
    </div>
  );
}