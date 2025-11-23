import { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Plus, Upload, X, FileImage, Search, Save } from "lucide-react";
import { PaymentMode } from "@shared/schema";
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExpenseEntryForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if we're in edit mode
  const [match, params] = useRoute("/expense-entry-form/:id");
  const expenseId = match ? params?.id : null;
  const isEditMode = Boolean(expenseId);

  // Form state - ordered as per requirement
  const [firmName, setFirmName] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [paidBy, setPaidBy] = useState("");

  // User selection states
  const [approvedByOpen, setApprovedByOpen] = useState(false);
  const [paidByOpen, setPaidByOpen] = useState(false);
  const [approvedBySearch, setApprovedBySearch] = useState("");
  const [paidBySearch, setPaidBySearch] = useState("");

  // File upload states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);
  const paymentFileRef = useRef<HTMLInputElement>(null);

  // Fetch users for dropdowns
  const { data: users } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Fetch expense entry data if editing
  const { data: expenseEntry, isLoading: isLoadingEntry } = useQuery<any>({
    queryKey: ['/api/expense-entries', expenseId],
    queryFn: async () => {
      const response = await fetch(`/api/expense-entries/${expenseId}`);
      if (!response.ok) throw new Error('Failed to fetch expense entry');
      return response.json();
    },
    enabled: isEditMode && Boolean(expenseId),
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && expenseEntry) {
      setFirmName(expenseEntry.firm_name || "");
      setBillNo(expenseEntry.bill_no || "");
      setBillDate(expenseEntry.bill_date || "");
      setDescription(expenseEntry.description || "");
      setAmount(expenseEntry.amount?.toString() || "");
      setQuantity(expenseEntry.quantity?.toString() || "");
      setReason(expenseEntry.reason || "");
      setExpenseDate(expenseEntry.expense_date || new Date().toISOString().split('T')[0]);
      setPaymentMode(expenseEntry.payment_mode || "");
      setApprovedBy(expenseEntry.approved_by || "");
      setPaidBy(expenseEntry.paid_by || "");
    }
  }, [isEditMode, expenseEntry]);

  const saveExpenseEntryMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const url = isEditMode ? `/api/expense-entries/${expenseId}` : '/api/expense-entries';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} expense entry`);
      }

      return response.json();
    },
    onSuccess: async (savedEntry) => {
      toast({
        title: "Success",
        description: `Expense entry ${isEditMode ? 'updated' : 'created'} successfully for ₹${savedEntry.amount.toFixed(2)}.`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/expense-entries'] });

      // Navigate to list
      setTimeout(() => setLocation('/expense-entries'), 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} expense entry`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation - only mandatory fields marked with *
    if (!description.trim() || !amount || !paymentMode || !approvedBy.trim() || !paidBy.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields: Line Item Description, Amount, Mode of Payment, Approved By, and Paid By.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    // Validate quantity if provided
    if (quantity.trim()) {
      const numQuantity = parseInt(quantity);
      if (isNaN(numQuantity) || numQuantity < 1) {
        toast({
          title: "Validation Error",
          description: "Quantity must be at least 1 if provided.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate receipt file is provided (only for create mode, in edit mode it's optional)
    if (!isEditMode && !receiptFile) {
      toast({
        title: "Validation Error",
        description: "Please upload an expense receipt.",
        variant: "destructive",
      });
      return;
    }

    // Validate payment screenshot for non-cash payments (only for create mode, in edit mode it's optional)
    if (!isEditMode && paymentMode !== 'cash' && !paymentScreenshot) {
      toast({
        title: "Validation Error",
        description: "Payment screenshot is required for non-cash payments.",
        variant: "destructive",
      });
      return;
    }

    // Create FormData for file uploads
    const formData = new FormData();
    formData.append('firmName', firmName.trim());
    formData.append('billNo', billNo.trim());
    formData.append('billDate', billDate);
    formData.append('description', description.trim());
    formData.append('amount', numAmount.toString()); // Amount in rupees
    formData.append('quantity', quantity.trim() || '0');
    formData.append('reason', reason.trim());
    formData.append('expenseDate', expenseDate);
    formData.append('paymentMode', paymentMode);
    formData.append('approvedBy', approvedBy.trim());
    formData.append('paidBy', paidBy.trim());
    formData.append('createdBy', user?.username || "system");

    // Add files (only if provided - in edit mode, existing files will be kept if not replaced)
    if (receiptFile) {
      formData.append('receiptFile', receiptFile);
    }
    if (paymentScreenshot) {
      formData.append('paymentScreenshot', paymentScreenshot);
    }

    saveExpenseEntryMutation.mutate(formData);
  };

  if (user?.role !== 'operator' && user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Only operators and admins can {isEditMode ? 'edit' : 'create'} expense entries.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading skeleton when fetching expense entry data in edit mode
  if (isEditMode && isLoadingEntry) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/expense-entries')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expense Entries
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEditMode ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {isEditMode ? 'Edit Expense Entry' : 'Create New Expense Entry'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isEditMode
              ? 'Update the expense entry details below.'
              : 'Record a new expense with all required details and approvals.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Firm Name */}
            <div className="space-y-2">
              <Label htmlFor="firm-name">Firm Name</Label>
              <Input
                id="firm-name"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Enter firm name (optional)"
              />
            </div>

            {/* Bill No and Bill Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bill-no">Bill No</Label>
                <Input
                  id="bill-no"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="Enter bill number (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill-date">Bill Date</Label>
                <Input
                  id="bill-date"
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
            </div>

            {/* Line Item Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Line Item Description *</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter item description"
              />
            </div>

            {/* Amount and Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity (optional)"
                />
              </div>
            </div>

            {/* Reason for Expense */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Expense</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for this expense (optional)"
                rows={3}
              />
            </div>

            {/* Date and Payment Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense-date">Date of Expense *</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-mode">Mode of Payment *</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentMode.CASH}>Cash</SelectItem>
                    <SelectItem value={PaymentMode.UPI}>UPI</SelectItem>
                    <SelectItem value={PaymentMode.CHEQUE}>Cheque</SelectItem>
                    <SelectItem value={PaymentMode.NETBANKING}>Net Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Receipt File Upload */}
            <div className="space-y-2">
              <Label htmlFor="receipt-file">Expense Receipt *</Label>
              <div className="flex gap-2">
                <Input
                  ref={receiptFileRef}
                  id="receipt-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {receiptFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReceiptFile(null);
                      if (receiptFileRef.current) receiptFileRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {receiptFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileImage className="h-4 w-4" />
                  <span>{receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload the expense receipt (JPG, JPEG, PNG, PDF)
              </p>
            </div>

            {/* Payment Screenshot (conditional) */}
            {paymentMode && paymentMode !== PaymentMode.CASH && (
              <div className="space-y-2">
                <Label htmlFor="payment-screenshot">Payment Screenshot *</Label>
                <div className="flex gap-2">
                  <Input
                    ref={paymentFileRef}
                    id="payment-screenshot"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {paymentScreenshot && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPaymentScreenshot(null);
                        if (paymentFileRef.current) paymentFileRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {paymentScreenshot && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileImage className="h-4 w-4" />
                    <span>{paymentScreenshot.name} ({(paymentScreenshot.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload payment screenshot for {paymentMode.toUpperCase()} transaction (JPG, JPEG, PNG, PDF)
                </p>
              </div>
            )}

            {/* Approved By - User Selection */}
            <div className="space-y-2">
              <Label htmlFor="approved-by">Approved By *</Label>
              <Popover open={approvedByOpen} onOpenChange={setApprovedByOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={approvedByOpen}
                    className="w-full justify-between"
                  >
                    {approvedBy ?
                      users?.find((user) => user.name === approvedBy)?.name || approvedBy :
                      "Select approver..."
                    }
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search users..."
                      value={approvedBySearch}
                      onValueChange={setApprovedBySearch}
                    />
                    <CommandList>
                      <CommandEmpty>No user found.</CommandEmpty>
                      {users?.filter(user =>
                        user.name.toLowerCase().includes(approvedBySearch.toLowerCase()) ||
                        user.username.toLowerCase().includes(approvedBySearch.toLowerCase())
                      ).map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={(currentValue) => {
                            setApprovedBy(currentValue === approvedBy ? "" : currentValue);
                            setApprovedByOpen(false);
                            setApprovedBySearch("");
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Paid By - User Selection */}
            <div className="space-y-2">
              <Label htmlFor="paid-by">Paid By *</Label>
              <Popover open={paidByOpen} onOpenChange={setPaidByOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={paidByOpen}
                    className="w-full justify-between"
                  >
                    {paidBy ?
                      users?.find((user) => user.name === paidBy)?.name || paidBy :
                      "Select payer..."
                    }
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search users..."
                      value={paidBySearch}
                      onValueChange={setPaidBySearch}
                    />
                    <CommandList>
                      <CommandEmpty>No user found.</CommandEmpty>
                      {users?.filter(user =>
                        user.name.toLowerCase().includes(paidBySearch.toLowerCase()) ||
                        user.username.toLowerCase().includes(paidBySearch.toLowerCase())
                      ).map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={(currentValue) => {
                            setPaidBy(currentValue === paidBy ? "" : currentValue);
                            setPaidByOpen(false);
                            setPaidBySearch("");
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/expense-entries')}
                className="flex-1"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveExpenseEntryMutation.isPending}
                className="flex-1"
                data-testid="button-submit-expense"
              >
                {saveExpenseEntryMutation.isPending
                  ? (isEditMode ? "Updating..." : "Creating...")
                  : (isEditMode ? "Update Expense Entry" : "Create Expense Entry")
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}