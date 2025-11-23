import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Upload, X } from "lucide-react";
import { UserSelect } from "@/components/user-select";

interface User {
  id: number;
  name: string;
  mobile?: string;
}

export default function AdvancePaymentForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  
  // File upload state
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch users for dropdown
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const selectedUser = users?.find(u => u.id === selectedUserId);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload JPG, PNG, or PDF files only.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload files smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setPaymentScreenshot(file);
    }
  };

  const removeFile = () => {
    setPaymentScreenshot(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  // Create advance payment mutation
  const createAdvancePaymentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/advance-payments', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create advance payment');
      }
      
      return response.json();
    },
    onSuccess: async (createdPayment) => {
      toast({
        title: "Success",
        description: `Advance payment of ₹${createdPayment.amount.toLocaleString()} recorded successfully.`,
      });

      // Invalidate all related queries immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/advance-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/entries'] }),
        queryClient.invalidateQueries({ predicate: (query) => {
          const queryKey = query.queryKey[0];
          return queryKey ? queryKey.toString().includes('/advance-balance') : false;
        } })
      ]);
      
      // Clear form
      setSelectedUserId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setAmount("");
      setPaymentMode("");
      setPaymentScreenshot(null);
      if (fileRef.current) fileRef.current.value = "";
      
      // Navigate to list immediately
      setLocation('/advance-payments');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create advance payment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId || !selectedUser) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    
    if (!paymentMode) {
      toast({
        title: "Error",
        description: "Please select a payment mode",
        variant: "destructive",
      });
      return;
    }

    // Check if payment screenshot is required for non-cash payments
    if (paymentMode !== 'cash' && !paymentScreenshot) {
      toast({
        title: "Error",
        description: "Payment screenshot is required for UPI, Cheque, and Net Banking",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('userId', selectedUserId.toString());
    formData.append('userName', selectedUser.name);
    formData.append('userMobile', selectedUser.mobile || '');
    formData.append('date', date);
    formData.append('amount', parseFloat(amount).toString()); // Amount in rupees
    formData.append('paymentMode', paymentMode);
    formData.append('createdBy', user?.username || 'system');
    
    if (paymentScreenshot) {
      formData.append('paymentScreenshot', paymentScreenshot);
    }

    createAdvancePaymentMutation.mutate(formData);
  };

  const paymentModeOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'netbanking', label: 'Net Banking' }
  ];

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLocation('/advance-payments')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <h1 className="text-2xl font-bold">Add Advance Payment</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Advance Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="user">Select User *</Label>
                <UserSelect
                  value={selectedUserId || undefined}
                  onValueChange={(value) => setSelectedUserId(value || null)}
                  placeholder="Search and select user"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Enter amount in rupees"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMode">Payment Mode *</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Screenshot Upload - Required for non-cash payments */}
            {paymentMode && paymentMode !== 'cash' && (
              <div className="space-y-2">
                <Label htmlFor="paymentScreenshot">Payment Screenshot *</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileRef.current?.click()}
                      className="w-full sm:w-auto"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Payment Screenshot
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  
                  {paymentScreenshot && (
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <span className="text-sm text-gray-600 truncate">
                        {paymentScreenshot.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500">
                    Upload payment screenshot for {paymentMode.toUpperCase()}. Accepted formats: JPG, PNG, PDF (Max 10MB)
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button 
                type="submit" 
                disabled={createAdvancePaymentMutation.isPending}
                className="min-w-[120px]"
              >
                {createAdvancePaymentMutation.isPending ? "Creating..." : "Create Payment"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setLocation('/advance-payments')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}