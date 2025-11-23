import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserSelect } from "@/components/user-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, User, Plus, X, Eye, Edit, MessageCircle } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { exportPreviousOutstanding } from "@/lib/excel-export";
import { apiRequest } from "@/lib/queryClient";

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

interface PreviousOutstanding {
  id: number;
  serialNumber?: string;
  recordNumber?: number;
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

export default function PreviousOutstanding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Edit dialog states
  const [editingRecord, setEditingRecord] = useState<PreviousOutstanding | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editAttachment, setEditAttachment] = useState<File | null>(null);
  const [editUserId, setEditUserId] = useState<number | undefined>(undefined);
  const [editDescription, setEditDescription] = useState<string>("");
  
  // Check if user has permission to view this page
  if (user?.role === 'viewer') {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">You don't have permission to view previous outstanding records.</p>
        </div>
      </div>
    );
  }

  // Fetch previous outstanding records with date range query params
  const queryParams = new URLSearchParams();
  if (startDate) {
    queryParams.append('startDate', startDate.toISOString().split('T')[0]);
  }
  if (endDate) {
    queryParams.append('endDate', endDate.toISOString().split('T')[0]);
  }

  const { data: records, isLoading } = useQuery<PreviousOutstanding[]>({
    queryKey: ['/api/previous-outstanding', queryParams.toString()],
    staleTime: 30000,
    gcTime: 300000,
  });



  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async ({ recordId, amount, attachment, userId, description }: { recordId: number; amount: number; attachment?: File; userId?: number; description?: string }) => {
      if (attachment) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('outstandingAmount', amount.toString());
        formData.append('attachmentFile', attachment);
        if (userId) formData.append('userId', userId.toString());
        if (description !== undefined) formData.append('description', description);
        
        const response = await fetch(`/api/previous-outstanding/${recordId}`, {
          method: 'PATCH',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update record');
        }
        
        return response.json();
      } else {
        const updateData: any = { outstandingAmount: amount };
        if (userId) updateData.userId = userId;
        if (description !== undefined) updateData.description = description;
        return apiRequest('PATCH', `/api/previous-outstanding/${recordId}`, updateData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/previous-outstanding'] });
      toast({
        title: "Success",
        description: "Outstanding amount updated successfully"
      });
      setIsEditDialogOpen(false);
      setEditingRecord(null);
      setEditAttachment(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update outstanding amount",
        variant: "destructive"
      });
    }
  });

  // Apply filters
  const filteredRecords = useMemo(() => {
    return (records || []).filter(record => {
      const matchesSearch = !searchTerm || 
        record.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.userMobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
      
      const recordDate = new Date(record.createdAt);
      const matchesDateRange = (!startDate || recordDate >= startDate) && 
                              (!endDate || recordDate <= endDate);
      
      return matchesSearch && matchesDateRange;
    });
  }, [records, searchTerm, startDate, endDate]);

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate(null);
    setEndDate(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString();
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

  const handleEditClick = (record: PreviousOutstanding) => {
    setEditingRecord(record);
    setEditAmount(record.outstandingAmount.toString()); // Amount already in rupees
    setEditUserId(record.userId);
    setEditDescription(record.description);
    setEditAttachment(null);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editingRecord) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    const minAmount = editingRecord.receivedAmount; // Amount already in rupees
    if (amount < minAmount) {
      toast({
        title: "Error",
        description: `Amount cannot be less than already received amount of ₹${minAmount.toLocaleString()}`,
        variant: "destructive"
      });
      return;
    }

    editMutation.mutate({
      recordId: editingRecord.id, 
      amount: amount,
      attachment: editAttachment || undefined,
      userId: user?.role === 'admin' ? editUserId : undefined,
      description: user?.role === 'admin' ? editDescription : undefined
    });
  };

  const handleWhatsappClick = (record: PreviousOutstanding) => {
    const message = 
      `🏛️ शिवनगर जैन मंदिर के अग्रणी सदस्य आपको सौम्य याद दिलाने हेतु संदेश प्रेषित है:\n\n` +
      `📝 विवरण: 31.07.2025 तक शेष (outstanding)\n` +
      `💰 राशि: ₹${record.outstandingAmount.toLocaleString()}\n` +
      `⏳ शेष: ₹${record.pendingAmount.toLocaleString()}\n\n` +
      `🙏 कृपया मंदिर व्यवस्था हेतु संकल्पित राशि जमा कर पुण्य लाभ संचित करें।\n\n` +
      `आपके सहयोग के लिए धन्यवाद! 🙏`;
    
    // Create WhatsApp URL using different encoding approach
    const phoneNumber = record.userMobile?.replace(/[^\d]/g, '') || '';
    
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "Mobile number not available for this user",
        variant: "destructive"
      });
      return;
    }
    
    // Use the same approach as working boli payments
    const whatsappUrl = `https://api.whatsapp.com/send?phone=91${phoneNumber}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.outstandingAmount, 0);

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Previous Outstanding Records</h1>
          <p className="text-muted-foreground">
            Historical outstanding amounts from old system
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => exportPreviousOutstanding(filteredRecords)}
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            📊 Export
          </Button>
          {(user?.role === 'admin' || user?.role === 'operator') && (
            <Button onClick={() => setLocation('/previous-outstanding/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Record
            </Button>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{filteredRecords.length}</div>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">₹{totalAmount.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ₹{filteredRecords.reduce((sum, record) => sum + (record.receivedAmount || 0), 0).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Total Received</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                ₹{filteredRecords.reduce((sum, record) => sum + (record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount), 0).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Total Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Filters</CardTitle>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by name, mobile, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate || undefined}
                    onSelect={(date) => setStartDate(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate || undefined}
                    onSelect={(date) => setEndDate(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Records ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {records?.length === 0 ? "No previous outstanding records found." : "No records match your search criteria."}
            </div>
          ) : (
            <>
              {/* Mobile view: Card layout */}
              {isMobile && (
                <div className="space-y-4">
                  {filteredRecords.map((record) => (
                    <Card key={record.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded font-mono">
                                {record.recordNumber ? `REC-${record.recordNumber}` : record.serialNumber || `REC-${filteredRecords.length - filteredRecords.indexOf(record)}`}
                              </span>
                              {getStatusBadge(record.status || 'pending', record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount)}
                            </div>
                            <h3 className="font-medium text-lg">{record.userName}</h3>
                            <p className="text-sm text-neutral-500">📱 {record.userMobile}</p>
                            {record.userAddress && (
                              <p className="text-xs text-neutral-600 mt-1">📍 {record.userAddress}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 my-3 text-sm">
                          <div>
                            <p className="text-neutral-500">Outstanding:</p>
                            <p className="font-medium">₹{formatAmount(record.outstandingAmount)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Received:</p>
                            <p className="text-green-600">₹{formatAmount(record.receivedAmount || 0)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Pending:</p>
                            <p className="text-red-600">₹{formatAmount(record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Created:</p>
                            <p>{formatDate(record.createdAt)}</p>
                          </div>
                        </div>
                        
                        {record.description && (
                          <div className="text-sm text-neutral-600 mt-2 mb-3">
                            <span className="text-neutral-500">Description:</span> {record.description}
                          </div>
                        )}
                        
                        {record.attachmentUrl && (
                          <div className="text-sm mb-3">
                            <a 
                              href="#"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              onClick={(e) => {
                                e.preventDefault();
                                let baseUrl = record.attachmentUrl?.startsWith('/uploads/') 
                                  ? record.attachmentUrl 
                                  : `/uploads/${record.attachmentUrl || ''}`;
                                
                                // URL encode the filename part
                                const parts = baseUrl.split('/');
                                if (parts.length > 0) {
                                  parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]);
                                  baseUrl = parts.join('/');
                                }
                                
                                window.open(baseUrl, '_blank');
                              }}
                            >
                              📎 View Attachment
                            </a>
                          </div>
                        )}
                        
                        <div className="text-xs text-neutral-500 mb-3">
                          Created by {record.createdBy}
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/previous-outstanding/${record.id}/details`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {record.userMobile && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleWhatsappClick(record)}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                          {(user?.role === 'admin' || user?.role === 'operator') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/previous-outstanding/${record.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
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
                    <TableHead>Record Number</TableHead>
                    <TableHead>User Details</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {record.recordNumber ? `REC-${record.recordNumber}` : record.serialNumber || `REC-${filteredRecords.length - filteredRecords.indexOf(record)}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.userName}</div>
                          <div className="text-sm text-muted-foreground">{record.userMobile}</div>
                          <div className="text-xs text-muted-foreground">{record.userAddress}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">₹{formatAmount(record.outstandingAmount)}</div>
                        {(record.receivedAmount || 0) > 0 && (
                          <div className="text-sm text-green-600">Received: ₹{formatAmount(record.receivedAmount || 0)}</div>
                        )}
                        {(record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount) > 0 && (
                          <div className="text-sm text-red-600">Pending: ₹{formatAmount(record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.status || 'pending', record.pendingAmount !== undefined ? record.pendingAmount : record.outstandingAmount)}
                      </TableCell>
                      <TableCell>{record.description}</TableCell>
                      <TableCell>
                        {record.attachmentUrl ? (
                          <a 
                            href="#"
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                            onClick={(e) => {
                              e.preventDefault();
                              let baseUrl = record.attachmentUrl?.startsWith('/uploads/') 
                                ? record.attachmentUrl 
                                : `/uploads/${record.attachmentUrl || ''}`;
                              
                              // URL encode the filename part while keeping the path structure
                              const parts = baseUrl.split('/');
                              if (parts.length > 0) {
                                parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]);
                                baseUrl = parts.join('/');
                              }
                              
                              window.open(baseUrl, '_blank');
                            }}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            View File
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">No file</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{formatDate(record.createdAt)}</div>
                          <div className="text-xs text-muted-foreground">by {record.createdBy}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/previous-outstanding/${record.id}/details`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {record.userMobile && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleWhatsappClick(record)}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                          {(user?.role === 'admin' || user?.role === 'operator') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/previous-outstanding/${record.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Outstanding Amount</DialogTitle>
          </DialogHeader>
          
          {editingRecord && (
            <div className="space-y-4">
              {/* User Field - Dropdown for admin, readonly for others */}
              {user?.role === 'admin' ? (
                <div>
                  <Label htmlFor="user-select">Select User *</Label>
                  <UserSelect
                    value={editUserId}
                    onValueChange={setEditUserId}
                    placeholder="Search and select user"
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="user">User</Label>
                  <Input
                    id="user"
                    value={editingRecord.userName}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              )}
              
              {/* Description Field - Editable for admin, readonly for operators */}
              {user?.role === 'admin' ? (
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Enter description"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editingRecord.description}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="received">Already Received</Label>
                <Input
                  id="received"
                  value={`₹${editingRecord.receivedAmount.toLocaleString()}`}
                  disabled
                  className="bg-gray-50 text-green-700 font-medium"
                />
              </div>

              <div>
                <Label htmlFor="amount">Outstanding Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  min={editingRecord.receivedAmount}
                  step="0.01"
                  placeholder="Enter amount in rupees"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum: ₹{editingRecord.receivedAmount.toLocaleString()} (already received)
                </p>
              </div>

              <div>
                <Label htmlFor="attachment">Replace Attachment (Optional)</Label>
                <Input
                  id="attachment"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setEditAttachment(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {editingRecord.attachmentUrl && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current: <span className="text-blue-600">File attached</span>
                  </p>
                )}
                {editAttachment && (
                  <p className="text-xs text-green-600 mt-1">
                    New file selected: {editAttachment.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={editMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleEditSubmit}
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}