import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, ExternalLink, Eye, Image, Pencil, Trash2 } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportExpenseEntries } from "@/lib/excel-export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

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

export default function ExpenseEntries() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all-modes");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);

  const { data: expenseEntries, isLoading, error } = useQuery<any[]>({
    queryKey: ['/api/expense-entries'],
  });
  
  // Delete mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/expense-entries/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete expense entry');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense entry deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-entries'] });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense entry",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
  });
  
  const handleDeleteClick = (id: number) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = () => {
    if (entryToDelete !== null) {
      deleteExpenseMutation.mutate(entryToDelete);
    }
  };
  
  const handleEditClick = (id: number) => {
    setLocation(`/expense-entry-form/${id}`);
  };

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-500">
          <p>Error loading expense entries: {error.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Get unique payment modes from expense entries
  const uniquePaymentModes = Array.from(new Set((expenseEntries || []).map(entry => entry.payment_mode).filter(Boolean)));

  // Apply filters
  const filteredEntries = useMemo(() => {
    return (expenseEntries || []).filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.reason && entry.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
        entry.approved_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.firm_name && entry.firm_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.bill_no && entry.bill_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.paid_by && entry.paid_by.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesPaymentMode = !paymentModeFilter || paymentModeFilter === "all-modes" || 
        entry.payment_mode?.toLowerCase() === paymentModeFilter.toLowerCase();
      
      const entryDate = new Date(entry.expense_date);
      const matchesDateRange = (!startDate || entryDate >= startDate) && 
                              (!endDate || entryDate <= endDate);
      
      return matchesSearch && matchesPaymentMode && matchesDateRange;
    });
  }, [expenseEntries, searchTerm, paymentModeFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearchTerm("");
    setPaymentModeFilter("all-modes");
    setStartDate(null);
    setEndDate(null);
  };

  const formatAmount = (amountInRupees: number) => {
    return amountInRupees.toFixed(2);
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode.toLowerCase()) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'upi': return 'bg-blue-100 text-blue-800';
      case 'cheque': return 'bg-yellow-100 text-yellow-800';
      case 'netbanking': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Parse attachment URLs
  const parseAttachments = (attachmentUrl: string | null) => {
    if (!attachmentUrl) return { receipt: null, paymentScreenshot: null };
    
    const urls = attachmentUrl.split(';').filter(Boolean);
    const receipt = urls.find(url => url.includes('receiptFile')) || null;
    const paymentScreenshot = urls.find(url => url.includes('paymentScreenshot')) || null;
    
    return { receipt, paymentScreenshot };
  };

  // File preview component
  const FilePreview = ({ url, title }: { url: string; title: string }) => {
    const isPDF = url.toLowerCase().endsWith('.pdf');
    
    return (
      <div className="space-y-2">
        <h4 className="font-medium">{title}</h4>
        {isPDF ? (
          <div className="border rounded-lg p-4 text-center">
            <FileText className="h-16 w-16 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-muted-foreground mb-2">PDF Document</p>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center justify-center gap-1"
            >
              View PDF <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <img 
              src={url} 
              alt={title}
              className="w-full h-auto max-h-96 object-contain"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                const nextElement = target.nextElementSibling as HTMLElement;
                target.style.display = 'none';
                if (nextElement) nextElement.style.display = 'block';
              }}
            />
            <div className="hidden p-4 text-center">
              <Image className="h-16 w-16 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-muted-foreground">Could not load image</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (user?.role !== 'operator' && user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Only operators and admins can view expense entries.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Expense Entries</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => exportExpenseEntries(filteredEntries)}
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            📊 Export
          </Button>
          <Button onClick={() => setLocation('/expense-entry-form')}>
            Add Expense Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search by description, reason, or approver"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Payment Mode</label>
              <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All payment modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-modes">All payment modes</SelectItem>
                  {uniquePaymentModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Actions</label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 border border-input rounded-md"
                placeholderText="Select start date"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 border border-input rounded-md"
                placeholderText="Select end date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredEntries.length} of {(expenseEntries || []).length} expense entries
        </p>
      </div>

      {/* Entries Table/Cards */}
      {isMobile ? (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{entry.description}</h3>
                    <p className="text-lg font-bold text-green-600">₹{formatAmount(entry.amount)}</p>
                  </div>
                  <Badge className={getPaymentModeColor(entry.payment_mode)}>
                    {entry.payment_mode}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  {entry.firm_name && <div><strong>Firm:</strong> {entry.firm_name}</div>}
                  {entry.bill_no && <div><strong>Bill No:</strong> {entry.bill_no}</div>}
                  {entry.quantity && <div><strong>Quantity:</strong> {entry.quantity}</div>}
                  {entry.reason && <div><strong>Reason:</strong> {entry.reason}</div>}
                  <div><strong>Date:</strong> {entry.expense_date ? new Date(entry.expense_date).toLocaleDateString() : 'N/A'}</div>
                  <div><strong>Approved by:</strong> {entry.approved_by}</div>
                  {entry.paid_by && <div><strong>Paid by:</strong> {entry.paid_by}</div>}
                  <div><strong>Created by:</strong> {entry.created_by}</div>
                  
                  {/* Attachments */}
                  {entry.attachment_url && (
                    <div className="space-y-2">
                      {(() => {
                        const { receipt, paymentScreenshot } = parseAttachments(entry.attachment_url);
                        return (
                          <div className="flex flex-wrap gap-2">
                            {receipt && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button className="flex items-center gap-1 text-blue-600 hover:underline text-sm">
                                    <FileText className="h-4 w-4" />
                                    View Receipt
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Expense Receipt</DialogTitle>
                                  </DialogHeader>
                                  <FilePreview url={receipt} title="Expense Receipt" />
                                </DialogContent>
                              </Dialog>
                            )}
                            
                            {paymentScreenshot && entry.payment_mode !== 'cash' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <button className="flex items-center gap-1 text-green-600 hover:underline text-sm">
                                    <Image className="h-4 w-4" />
                                    Payment Proof
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Payment Screenshot</DialogTitle>
                                  </DialogHeader>
                                  <FilePreview url={paymentScreenshot} title="Payment Screenshot" />
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    {(user?.role === 'admin' || user?.role === 'operator') && (
                      <Button
                        onClick={() => handleEditClick(entry.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        data-testid={`button-edit-expense-${entry.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {user?.role === 'admin' && (
                      <Button
                        onClick={() => handleDeleteClick(entry.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                        data-testid={`button-delete-expense-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Firm/Bill</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Payment Proof</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <div>{entry.description}</div>
                      {entry.reason && <div className="text-xs text-muted-foreground">{entry.reason}</div>}
                    </TableCell>
                    <TableCell>
                      {entry.firm_name && <div className="font-medium">{entry.firm_name}</div>}
                      {entry.bill_no && <div className="text-xs text-muted-foreground">Bill: {entry.bill_no}</div>}
                      {entry.bill_date && <div className="text-xs text-muted-foreground">{new Date(entry.bill_date).toLocaleDateString()}</div>}
                      {!entry.firm_name && !entry.bill_no && !entry.bill_date && <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="font-bold text-green-600">
                      ₹{formatAmount(entry.amount)}
                      {entry.quantity && <div className="text-xs text-muted-foreground">Qty: {entry.quantity}</div>}
                    </TableCell>
                    <TableCell>{entry.expense_date ? new Date(entry.expense_date).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={getPaymentModeColor(entry.payment_mode)}>
                        {entry.payment_mode}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.approved_by}</TableCell>
                    <TableCell>{entry.paid_by || entry.approved_by}</TableCell>
                    
                    {/* Receipt Column */}
                    <TableCell>
                      {(() => {
                        const { receipt } = parseAttachments(entry.attachment_url);
                        return receipt ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="flex items-center gap-1 text-blue-600 hover:underline">
                                <Eye className="h-4 w-4" />
                                View
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Expense Receipt</DialogTitle>
                              </DialogHeader>
                              <FilePreview url={receipt} title="Expense Receipt" />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-muted-foreground">No receipt</span>
                        );
                      })()}
                    </TableCell>
                    
                    {/* Payment Proof Column */}
                    <TableCell>
                      {(() => {
                        const { paymentScreenshot } = parseAttachments(entry.attachment_url);
                        if (entry.payment_mode === 'cash') {
                          return <span className="text-muted-foreground">Not required</span>;
                        }
                        
                        return paymentScreenshot ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="flex items-center gap-1 text-green-600 hover:underline">
                                <Eye className="h-4 w-4" />
                                View
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Payment Screenshot</DialogTitle>
                              </DialogHeader>
                              <FilePreview url={paymentScreenshot} title="Payment Screenshot" />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-red-500">Missing</span>
                        );
                      })()}
                    </TableCell>
                    
                    {/* Actions Column */}
                    <TableCell>
                      <div className="flex gap-2">
                        {(user?.role === 'admin' || user?.role === 'operator') && (
                          <Button
                            onClick={() => handleEditClick(entry.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            data-testid={`button-edit-expense-${entry.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {user?.role === 'admin' && (
                          <Button
                            onClick={() => handleDeleteClick(entry.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`button-delete-expense-${entry.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filteredEntries.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground">No expense entries found.</p>
          <Button onClick={() => setLocation('/expense-entry-form')} className="mt-4">
            Add First Expense Entry
          </Button>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense entry from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}