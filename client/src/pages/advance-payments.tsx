import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Calendar, FileText, Eye, Receipt } from "lucide-react";
import { AdvancePaymentReceipt } from "@/components/advance-payment-receipt";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportAdvancePayments } from "@/lib/excel-export";

interface AdvancePayment {
  id: number;
  userId: number;
  userName: string;
  userMobile?: string;
  userAddress?: string;
  date: string;
  amount: number;
  paymentMode: string;
  attachmentUrl?: string;
  receiptNo?: string;
  createdBy: string;
  createdAt: string;
}

export default function AdvancePayments() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all-modes");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Receipt modal state
  const [selectedAdvancePayment, setSelectedAdvancePayment] = useState<AdvancePayment | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Fetch advance payments with date range query params
  const queryParams = new URLSearchParams();
  if (startDate) {
    queryParams.append('startDate', startDate.toISOString().split('T')[0]);
  }
  if (endDate) {
    queryParams.append('endDate', endDate.toISOString().split('T')[0]);
  }

  const { data: advancePayments, isLoading } = useQuery<AdvancePayment[]>({
    queryKey: ['/api/advance-payments', queryParams.toString()],
  });

  // Apply filters
  const filteredPayments = useMemo(() => {
    return (advancePayments || []).filter(payment => {
      const matchesSearch = !searchTerm || 
        payment.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.userMobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPaymentMode = !paymentModeFilter || paymentModeFilter === "all-modes" || 
        payment.paymentMode?.toLowerCase() === paymentModeFilter.toLowerCase();
      
      const paymentDate = new Date(payment.date);
      const matchesDateRange = (!startDate || paymentDate >= startDate) && 
                              (!endDate || paymentDate <= endDate);
      
      return matchesSearch && matchesPaymentMode && matchesDateRange;
    });
  }, [advancePayments, searchTerm, paymentModeFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearchTerm("");
    setPaymentModeFilter("all-modes");
    setStartDate(null);
    setEndDate(null);
  };

  const formatAmount = (amountInRupees: number) => {
    return amountInRupees.toLocaleString();
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'upi': return 'bg-blue-100 text-blue-800';
      case 'cheque': return 'bg-yellow-100 text-yellow-800';
      case 'netbanking': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  // Calculate totals for filtered data
  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Loading advance payments...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Advance Payments</h1>
          <p className="text-gray-600">
            Total: ₹{formatAmount(totalAmount)} ({filteredPayments.length} payments)
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => exportAdvancePayments(filteredPayments)}
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            📊 Export
          </Button>
          {(user?.role === 'admin' || user?.role === 'operator') && (
            <Button onClick={() => setLocation('/advance-payment-form')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Advance Payment
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by user, mobile, or creator"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Mode</label>
              <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-modes">All Modes</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="netbanking">Net Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                <DatePicker
                  selected={startDate}
                  onChange={setStartDate}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select start date"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  isClearable
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                <DatePicker
                  selected={endDate}
                  onChange={setEndDate}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select end date"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  isClearable
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Payment Mode</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Receipt No</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Created By</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{payment.userName}</div>
                          {payment.userMobile && (
                            <div className="text-sm text-gray-500">{payment.userMobile}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(payment.date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        ₹{formatAmount(payment.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getPaymentModeColor(payment.paymentMode)}>
                          {payment.paymentMode?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {payment.receiptNo || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {payment.createdBy}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedAdvancePayment(payment);
                              setIsReceiptOpen(true);
                            }}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Receipt
                          </Button>
                          {payment.attachmentUrl && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle>Payment Screenshot - {payment.userName}</DialogTitle>
                                </DialogHeader>
                                <div className="mt-4">
                                  {payment.attachmentUrl.toLowerCase().endsWith('.pdf') ? (
                                    <div className="text-center">
                                      <FileText className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                                      <p className="text-gray-600 mb-4">PDF Document</p>
                                      <Button asChild>
                                        <a href={payment.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                          Open PDF
                                        </a>
                                      </Button>
                                    </div>
                                  ) : (
                                    <img 
                                      src={payment.attachmentUrl} 
                                      alt="Payment Screenshot"
                                      className="w-full h-auto max-h-96 object-contain mx-auto"
                                    />
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredPayments.map((payment) => (
          <Card key={payment.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{payment.userName}</h3>
                    {payment.userMobile && (
                      <p className="text-sm text-gray-500">{payment.userMobile}</p>
                    )}
                  </div>
                  <Badge className={getPaymentModeColor(payment.paymentMode)}>
                    {payment.paymentMode?.toUpperCase() || 'UNKNOWN'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Date:</span>
                    <br />
                    <span className="font-medium">{formatDate(payment.date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <br />
                    <span className="font-semibold text-lg">₹{formatAmount(payment.amount)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500">Receipt No:</span>
                    <br />
                    <span className="font-medium">{payment.receiptNo || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Created by:</span>
                    <br />
                    <span className="font-medium">{payment.createdBy}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedAdvancePayment(payment);
                      setIsReceiptOpen(true);
                    }}
                  >
                    <Receipt className="h-4 w-4 mr-1" />
                    Receipt
                  </Button>
                  {payment.attachmentUrl && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Payment Screenshot - {payment.userName}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          {payment.attachmentUrl.toLowerCase().endsWith('.pdf') ? (
                            <div className="text-center">
                              <FileText className="h-16 w-16 mx-auto text-gray-400 mb-2" />
                              <p className="text-gray-600 mb-4">PDF Document</p>
                              <Button asChild>
                                <a href={payment.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                  Open PDF
                                </a>
                              </Button>
                            </div>
                          ) : (
                            <img 
                              src={payment.attachmentUrl} 
                              alt="Payment Screenshot"
                              className="w-full h-auto max-h-96 object-contain mx-auto"
                            />
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPayments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No advance payments found.</p>
        </div>
      )}
      
      {/* Receipt Modal */}
      {selectedAdvancePayment && (
        <AdvancePaymentReceipt
          advancePayment={selectedAdvancePayment}
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            setSelectedAdvancePayment(null);
          }}
        />
      )}
    </div>
  );
}