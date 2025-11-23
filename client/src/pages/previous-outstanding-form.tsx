import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserSelect } from "@/components/user-select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import type { User } from "@shared/schema";
import { UserRole } from "@shared/schema";

// Form validation schema
const previousOutstandingSchema = z.object({
  userId: z.coerce.number().positive("Please select a user"),
  userName: z.string().min(1, "User name is required"),
  userMobile: z.string().optional(),
  userAddress: z.string().optional(),
  outstandingAmount: z.number().positive("Outstanding amount must be positive"),
  description: z.string().min(1, "Description is required").default("31.07.2025 तक कुल शेष राशि"),
});

type FormValues = z.infer<typeof previousOutstandingSchema>;

export default function PreviousOutstandingForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Redirect viewers away from this page
  if (user && user.role === UserRole.VIEWER) {
    setLocation('/dashboard');
    return null;
  }

  // Fetch users for dropdown
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users']
  });

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(previousOutstandingSchema),
    defaultValues: {
      userId: 0, // Changed from "0" to 0 - must be a number
      userName: "",
      userMobile: "",
      userAddress: "",
      outstandingAmount: 0,
      description: "31.07.2025 तक कुल शेष राशि",
    },
    mode: "onChange", // Enable real-time validation
  });

  // Watch values for automatic updates
  const watchUserId = form.watch("userId");

  // Update user details when userId changes
  const selectedUser = users?.find(user => user.id === watchUserId);
  useEffect(() => {
    if (selectedUser) {
      console.log("Selected user:", selectedUser);
      form.setValue("userName", selectedUser.name);
      form.setValue("userMobile", selectedUser.mobile || "");
      form.setValue("userAddress", selectedUser.address || "");
      console.log("Form values after user selection:", form.getValues());
    } else if (watchUserId === 0) {
      // Reset user fields when no user is selected
      form.setValue("userName", "");
      form.setValue("userMobile", "");
      form.setValue("userAddress", "");
    }
  }, [selectedUser, form, watchUserId]);


  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const formData = new FormData();
      formData.append('userId', data.userId.toString());
      formData.append('userName', data.userName);
      formData.append('userMobile', data.userMobile || '');
      formData.append('userAddress', data.userAddress || '');
      formData.append('outstandingAmount', data.outstandingAmount.toString()); // Keep in rupees
      formData.append('description', data.description);
      formData.append('createdBy', user?.username || 'system');

      // Add attachment file if selected
      if (attachmentFile) {
        formData.append('attachmentFile', attachmentFile);
      }

      // Use direct fetch instead of apiRequest for FormData
      const response = await fetch('/api/previous-outstanding', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create previous outstanding record');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Previous outstanding record created successfully",
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/previous-outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });

      setLocation('/previous-outstanding');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create record: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: FormValues) => {
    console.log("Form data being submitted:", data);

    // Validate required fields on client side
    if (!data.userId || data.userId === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a user",
        variant: "destructive"
      });
      return;
    }

    if (!data.userName) {
      toast({
        title: "Validation Error",
        description: "User name is required",
        variant: "destructive"
      });
      return;
    }

    if (!data.outstandingAmount || data.outstandingAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Outstanding amount must be greater than 0",
        variant: "destructive"
      });
      return;
    }

    createMutation.mutate(data);
  };

  if (user?.role === 'viewer') {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Only operators and administrators can create previous outstanding records.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/previous-outstanding')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Outstanding Records
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Previous Outstanding Record</CardTitle>
          <p className="text-sm text-muted-foreground">
            Record previous outstanding amounts for users migrating from old system
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* User Selection */}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select User *</FormLabel>
                    <FormControl>
                      <UserSelect
                        value={field.value}
                        onValueChange={(value) => {
                          console.log("Form onValueChange called with:", value, typeof value);
                          const numValue = value ? Number(value) : 0;
                          console.log("Setting field to:", numValue);
                          field.onChange(numValue);
                          console.log("Field value after onChange:", field.value);
                        }}
                        placeholder="Search and select user"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Display selected user info */}
              {selectedUser && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-medium text-blue-800">Selected User:</p>
                  <p className="text-sm text-blue-700">{selectedUser.name}</p>
                  {selectedUser.mobile && <p className="text-xs text-blue-600">Mobile: {selectedUser.mobile}</p>}
                  {selectedUser.address && <p className="text-xs text-blue-600">Address: {selectedUser.address}</p>}
                </div>
              )}

              {/* Hidden fields for user details */}
              <input type="hidden" {...form.register("userName")} />
              <input type="hidden" {...form.register("userMobile")} />
              <input type="hidden" {...form.register("userAddress")} />

              {/* Outstanding Amount */}
              <FormField
                control={form.control}
                name="outstandingAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous Outstanding Amount (₹) *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter amount in rupees"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, ''); // Only allow digits
                          field.onChange(parseInt(value) || 0);
                        }}
                        value={field.value === 0 ? '' : field.value.toString()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="31.07.2025 तक कुल शेष राशि"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Attachment Upload */}
              <div className="space-y-2">
                <Label htmlFor="attachment">Upload Attachment (Optional)</Label>
                <Input
                  id="attachment"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Upload proof documents, receipts, or related files (Images or PDF)
                </p>
                {attachmentFile && (
                  <p className="text-xs text-green-600">
                    Selected: {attachmentFile.name}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/entries')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending ? "Creating..." : "Create Record"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}