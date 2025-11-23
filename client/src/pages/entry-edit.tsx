import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { type Entry } from "@shared/schema";
import { UserSelect } from "@/components/user-select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Create edit schema that excludes auto-generated fields
const editEntrySchema = z.object({
  userId: z.coerce.number().positive("User is required"),
  userName: z.string().min(1, "User name is required"),
  userMobile: z.string().optional(),
  userAddress: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  totalAmount: z.coerce.number().positive("Total amount must be positive"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  occasion: z.string().min(1, "Occasion is required"),
  bediNumber: z.string().min(1, "बेदी क्रमांक is required"),
  auctionDate: z.string().min(1, "Auction date is required"),
});

type EditEntryValues = z.infer<typeof editEntrySchema>;

export default function EntryEdit() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [match, params] = useRoute("/entries/:id/edit");
  const entryId = match ? parseInt(params.id) : 0;
  
  // Fetch entry details for editing
  const { data: entry, isLoading } = useQuery<Entry>({
    queryKey: [`/api/entries/${entryId}`],
    enabled: entryId > 0,
  });

  // Fetch users for selection
  const { data: users } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const form = useForm<EditEntryValues>({
    resolver: zodResolver(editEntrySchema),
    defaultValues: {
      userId: 0,
      userName: "",
      userMobile: "",
      userAddress: "",
      description: "",
      amount: 0,
      totalAmount: 0,
      quantity: 1,
      occasion: "",
      bediNumber: "1",
      auctionDate: new Date().toISOString().split('T')[0],
    },
  });

  // Update form when entry data is loaded
  useEffect(() => {
    if (entry) {
      form.reset({
        userId: entry.userId,
        userName: entry.userName,
        userMobile: entry.userMobile || "",
        userAddress: entry.userAddress || "",
        description: entry.description,
        amount: entry.amount,
        totalAmount: entry.totalAmount, // Amount is already in rupees
        quantity: entry.quantity,
        occasion: entry.occasion,
        bediNumber: entry.bediNumber || "1",
        auctionDate: entry.auctionDate,
      });
    }
  }, [entry, form]);

  // Auto-calculate totalAmount when amount or quantity changes
  const watchAmount = form.watch("amount");
  const watchQuantity = form.watch("quantity");

  useEffect(() => {
    const amount = Number(watchAmount) || 0;
    const quantity = Number(watchQuantity) || 1;
    const total = amount * quantity;
    form.setValue("totalAmount", total);
  }, [watchAmount, watchQuantity, form]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EditEntryValues) => {
      const response = await apiRequest("PUT", `/api/entries/${entryId}`, data);
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Entry updated successfully",
      });
      
      // Force fresh data by clearing cache and refetching
      queryClient.removeQueries({ queryKey: ['/api/entries'] });
      queryClient.removeQueries({ queryKey: [`/api/entries/${entryId}`] });
      
      // Redirect immediately - the entries page will fetch fresh data
      setLocation('/entries');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditEntryValues) => {
    updateMutation.mutate(data);
  };

  // Handle user selection
  const handleUserSelect = (userId: number) => {
    const selectedUser = users?.find(u => u.id === userId);
    if (selectedUser) {
      form.setValue('userId', selectedUser.id);
      form.setValue('userName', selectedUser.name);
      form.setValue('userMobile', selectedUser.mobile || '');
      form.setValue('userAddress', selectedUser.address || '');
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'operator')) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-neutral-600">You don't have permission to edit entries.</p>
          <Button onClick={() => setLocation('/entries')} className="mt-4">
            Back to Entries
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading entry details...</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Entry Not Found</h1>
          <p className="text-neutral-600">The entry you're trying to edit doesn't exist.</p>
          <Button onClick={() => setLocation('/entries')} className="mt-4">
            Back to Entries
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation('/entries')}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <CardTitle>Edit Boli Entry</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* User Selection */}
                <div className="space-y-2">
                  <Label>Select User *</Label>
                  <UserSelect
                    value={form.watch('userId') > 0 ? form.watch('userId') : undefined}
                    onValueChange={(userId) => {
                      if (userId) {
                        handleUserSelect(userId);
                      }
                    }}
                    className="w-full"
                    disabled={user?.role !== 'admin'}
                  />
                  {user?.role !== 'admin' && (
                    <p className="text-xs text-orange-600">Only administrators can change the user selection</p>
                  )}
                  {form.watch('userId') > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">Selected User:</p>
                      <p className="text-sm text-blue-700">{form.watch('userName')}</p>
                      {form.watch('userMobile') && (
                        <p className="text-sm text-blue-600">Mobile: {form.watch('userMobile')}</p>
                      )}
                      {form.watch('userAddress') && (
                        <p className="text-sm text-blue-600">Address: {form.watch('userAddress')}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Hidden fields for user data */}
                <FormField
                  control={form.control}
                  name="userName"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="userMobile"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="userAddress"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter boli description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount field */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter amount per unit"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quantity */}
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Enter quantity"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Total Amount - Read-only calculated field */}
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount (₹) - Calculated</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          disabled
                          className="bg-neutral-100 text-neutral-700 font-semibold"
                        />
                      </FormControl>
                      <p className="text-xs text-neutral-500">
                        Auto-calculated: Amount × Quantity
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Occasion */}
                <FormField
                  control={form.control}
                  name="occasion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occasion *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter occasion"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* बेदी क्रमांक */}
                <FormField
                  control={form.control}
                  name="bediNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>बेदी क्रमांक *</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select बेदी क्रमांक" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date of Boli */}
                <FormField
                  control={form.control}
                  name="auctionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Boli *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          max={new Date().toISOString().split('T')[0]}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
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
                    className="flex-1"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Entry"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}