import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserSelect } from "@/components/user-select";
import { ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PreviousOutstanding {
  id: number;
  serialNumber?: string;
  recordNumber?: number;
  userId: number;
  userName: string;
  userMobile?: string;
  userAddress?: string;
  outstandingAmount: number;
  receivedAmount?: number;
  pendingAmount?: number;
  status: 'pending' | 'partial' | 'full';
  description: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  payments?: any[];
}

export default function EditPreviousOutstanding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get record ID from URL
  const recordId = parseInt(window.location.pathname.split('/')[2]);
  
  // Form states
  const [editUserId, setEditUserId] = useState<number | undefined>(undefined);
  const [editDescription, setEditDescription] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editAttachment, setEditAttachment] = useState<File | null>(null);

  // Fetch the record to edit
  const { data: record, isLoading, error } = useQuery({
    queryKey: ['/api/previous-outstanding', recordId],
    queryFn: async () => {
      const response = await fetch(`/api/previous-outstanding/${recordId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch record: ${response.status}`);
      }
      const data = await response.json();
      console.log('API response:', data);
      return data as PreviousOutstanding;
    },
    enabled: !!recordId && !isNaN(recordId),
  });

  // Initialize form values when record loads
  useEffect(() => {
    if (record) {
      setEditUserId(record.userId);
      setEditDescription(record.description || "");
      setEditAmount((record.outstandingAmount || 0).toString());
    }
  }, [record]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updateData: { userId?: number; description?: string; outstandingAmount: number; attachmentFile?: File }) => {
      if (updateData.attachmentFile) {
        // Use FormData for file upload
        const formData = new FormData();
        formData.append('outstandingAmount', updateData.outstandingAmount.toString());
        formData.append('attachmentFile', updateData.attachmentFile);
        if (updateData.userId) formData.append('userId', updateData.userId.toString());
        if (updateData.description !== undefined) formData.append('description', updateData.description);
        
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
        const payload: any = { outstandingAmount: updateData.outstandingAmount };
        if (updateData.userId) payload.userId = updateData.userId;
        if (updateData.description !== undefined) payload.description = updateData.description;
        return apiRequest('PATCH', `/api/previous-outstanding/${recordId}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/previous-outstanding'] });
      toast({
        title: "Success",
        description: "Outstanding record updated successfully"
      });
      setLocation('/previous-outstanding');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update outstanding record",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    if (!record) return;

    const minAmount = record.receivedAmount || 0;
    if (amount < minAmount) {
      toast({
        title: "Error",
        description: `Amount cannot be less than already received amount of ₹${minAmount.toLocaleString()}`,
        variant: "destructive"
      });
      return;
    }

    updateMutation.mutate({
      userId: user?.role === 'admin' ? editUserId : undefined,
      description: user?.role === 'admin' ? editDescription : undefined,
      outstandingAmount: amount,
      attachmentFile: editAttachment || undefined
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-600">Error loading record: {error.message}</div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-600">Record not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLocation('/previous-outstanding')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <h1 className="text-2xl font-bold">Edit Outstanding Payment</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Outstanding Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Field - Editable for admin, readonly for others */}
              {user?.role === 'admin' ? (
                <div className="space-y-2">
                  <Label htmlFor="user-select">Select User *</Label>
                  <UserSelect
                    value={editUserId}
                    onValueChange={setEditUserId}
                    placeholder="Search and select user"
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>User</Label>
                  <Input
                    value={record?.userName || ""}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              )}

              {/* Description Field - Editable for admin, readonly for others */}
              {user?.role === 'admin' ? (
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Input
                    id="description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Enter description"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={record?.description || ""}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Already Received</Label>
                <Input
                  value={`₹${((record?.receivedAmount || 0)).toLocaleString()}`}
                  disabled
                  className="bg-gray-50 text-green-700 font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Outstanding Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  min={record.receivedAmount || 0}
                  step="0.01"
                  placeholder="Enter amount in rupees"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: ₹{(record.receivedAmount || 0).toLocaleString()} (already received)
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="attachment">Replace Attachment (Optional)</Label>
                <Input
                  id="attachment"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setEditAttachment(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {record.attachmentUrl && (
                  <p className="text-xs text-muted-foreground">
                    Current: <a href={record.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">File attached</a>
                  </p>
                )}
                {editAttachment && (
                  <p className="text-xs text-green-600">
                    New file selected: {editAttachment.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/previous-outstanding')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="min-w-[120px]"
              >
                {updateMutation.isPending ? (
                  "Updating..."
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}