import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Edit, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface PaymentRecord {
  date: string;
  amount: number;
  mode: string;
  fileUrl?: string;
  receiptNo?: string;
  updatedBy?: string;
}

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

interface PreviousOutstandingSectionProps {
  userId: number;
}

export function PreviousOutstandingSection({ userId }: PreviousOutstandingSectionProps) {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRecord, setEditingRecord] = useState<PreviousOutstandingRecord | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editUserId, setEditUserId] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Fetch previous outstanding records for this user
  const { data: previousOutstandingRecords = [], isLoading } = useQuery<PreviousOutstandingRecord[]>({
    queryKey: [`/api/previous-outstanding?userId=${userId}`],
    enabled: !!userId,
  });

  // Fetch users list for admin edit functionality
  const { data: users = [] } = useQuery<Array<{id: number, name: string, username: string}>>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin',
  });

  // State for handling form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatAmount = (amountInRupees: number) => {
    return amountInRupees.toLocaleString('en-IN');
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

  const handleEditClick = (record: PreviousOutstandingRecord) => {
    setEditingRecord(record);
    setEditAmount(record.outstandingAmount.toString()); // Amount already in rupees
    setEditUserId(record.userId.toString());
    setEditDescription(record.description);
    setEditFile(null); // Reset file selection
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingRecord || isSubmitting) return;
    
    setIsSubmitting(true);
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    const minAmount = editingRecord.receivedAmount; // Amount already in rupees
    if (amount < minAmount) {
      toast({
        title: "Error",
        description: `Amount cannot be less than already received amount of ₹${minAmount.toLocaleString()}`,
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const originalUserId = editingRecord.userId;
      const newUserId = parseInt(editUserId);
      
      // Create FormData for file upload if file is selected
      const formData = new FormData();
      formData.append('recordId', editingRecord.id.toString());
      formData.append('amount', amount.toString());
      
      // Only include fields that admin can edit
      if (user && user.role === 'admin') {
        if (originalUserId !== newUserId) {
          formData.append('userId', newUserId.toString());
        }
        if (editDescription !== editingRecord.description) {
          formData.append('description', editDescription);
        }
      }
      
      // Both admin and operator can upload files
      if (editFile) {
        formData.append('file', editFile);
      }

      // Use fetch for file upload instead of apiRequest
      const response = await fetch('/api/previous-outstanding/edit', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update record');
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Outstanding record updated successfully",
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/previous-outstanding?userId=${userId}`] });
      setIsEditDialogOpen(false);
      setEditFile(null);
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update record",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading previous outstanding records...</div>;
  }

  if (previousOutstandingRecords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No previous outstanding records found for this user.
      </div>
    );
  }

  const totalOutstanding = previousOutstandingRecords.reduce(
    (sum, record) => sum + record.outstandingAmount, 
    0
  );

  const totalReceived = previousOutstandingRecords.reduce(
    (sum, record) => sum + (record.receivedAmount || 0), 
    0
  );

  const totalPending = previousOutstandingRecords.reduce(
    (sum, record) => sum + (record.pendingAmount ?? 0), 
    0
  );

  return (
    <div className="space-y-4">
      {/* Enhanced Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div>
            <h3 className="font-medium text-amber-800">Total Outstanding</h3>
            <p className="text-xs text-amber-600">Original amounts</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-800">₹{formatAmount(totalOutstanding)}</p>
            <p className="text-xs text-amber-600">{previousOutstandingRecords.length} records</p>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div>
            <h3 className="font-medium text-green-800">Total Received</h3>
            <p className="text-xs text-green-600">Payments made</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-800">₹{formatAmount(totalReceived)}</p>
            <p className="text-xs text-green-600">
              {totalOutstanding > 0 ? Math.round((totalReceived / totalOutstanding) * 100) : 0}% paid
            </p>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div>
            <h3 className="font-medium text-red-800">Total Pending</h3>
            <p className="text-xs text-red-600">Remaining balance</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-red-800">₹{formatAmount(totalPending)}</p>
            <p className="text-xs text-red-600">
              {totalOutstanding > 0 ? Math.round((totalPending / totalOutstanding) * 100) : 0}% remaining
            </p>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previousOutstandingRecords.map((record) => {
              // Check if attachment exists and is not empty
              const hasAttachmentUrl = record.attachmentUrl && record.attachmentUrl.trim() !== '';
              
              return (
                <TableRow key={record.id}>
                <TableCell className="font-medium">{record.description}</TableCell>
                <TableCell>
                  <div className="font-medium">₹{formatAmount(record.outstandingAmount)}</div>
                  {(record.receivedAmount || 0) > 0 && (
                    <div className="text-sm text-green-600">Received: ₹{formatAmount(record.receivedAmount || 0)}</div>
                  )}
                  {(record.pendingAmount ?? 0) > 0 && (
                    <div className="text-sm text-red-600">Pending: ₹{formatAmount(record.pendingAmount ?? 0)}</div>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(record.status || 'pending', record.pendingAmount ?? 0)}
                </TableCell>
                <TableCell>{formatDate(record.createdAt)}</TableCell>
                <TableCell>{record.createdBy}</TableCell>
                <TableCell>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/previous-outstanding/${record.id}/details`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(record)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasAttachmentUrl}
                      className={hasAttachmentUrl ? "text-blue-600 border-blue-600 hover:bg-blue-50" : ""}
                      onClick={async () => {
                        if (!hasAttachmentUrl) return;
                        
                        try {
                          // Check if file exists by making a HEAD request first
                          const response = await fetch(record.attachmentUrl!, { method: 'HEAD' });
                          if (response.ok) {
                            window.open(record.attachmentUrl, '_blank');
                          } else {
                            toast({
                              title: "File Not Found",
                              description: "The attachment file could not be found. It may have been moved or deleted. Please contact administrator to update the record.",
                              variant: "destructive"
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Could not access the attachment file. Please check your connection.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View File
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog - Complete Rewrite */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Outstanding Amount</DialogTitle>
          </DialogHeader>
          
          {editingRecord && (
            <div className="space-y-4">
              {/* User Field - Show dropdown for admin, readonly for others */}
              {user?.role === 'admin' ? (
                <div>
                  <Label htmlFor="user-select">User</Label>
                  <Select value={editUserId} onValueChange={setEditUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.name} ({u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>User</Label>
                  <Input
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
                  <Label>Description</Label>
                  <Input
                    value={editingRecord.description}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              )}

              {/* Already Received - Always Read-only */}
              <div>
                <Label>Already Received</Label>
                <Input
                  value={`₹${editingRecord.receivedAmount.toLocaleString()}`}
                  disabled
                  className="bg-gray-50 text-green-700 font-medium"
                />
              </div>

              {/* Outstanding Amount - Editable for both Admin and Operator */}
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

              {/* File Attachment - Editable for both Admin and Operator */}
              <div>
                <Label htmlFor="file">Replace Attachment (Optional)</Label>
                <input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {editingRecord.payments && editingRecord.payments.length > 0 && editingRecord.payments[0]?.fileUrl && (
                  <p className="text-sm text-blue-600 mt-1">
                    Current: <a href={editingRecord.payments[0].fileUrl} target="_blank" rel="noopener noreferrer" className="underline">File attached</a>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditFile(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleEditSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}