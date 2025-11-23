import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EntryType, UnitOfMeasurement, PaymentStatus, type User } from "@shared/schema";
import { UserSelect } from "@/components/user-select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function DravyaEntryForm() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [userName, setUserName] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [description, setDescription] = useState("");
  // Removed amount, quantity, and unitOfMeasurement - not needed for dravya entries
  const [occasion, setOccasion] = useState("");
  const [boliDate, setBoliDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch users for selection
  const { data: users, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // No need for quantity/UOM logic in dravya entries

  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/dravya-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create dravya entry');
      }
      
      return response.json();
    },
    onSuccess: async (createdEntry) => {
      // Dravya entries are spiritual donations - successfully created
      toast({
        title: "Success",
        description: `Dravya entry created successfully for ${createdEntry.user_name || 'the selected user'}.`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/dravya-entries'] });
      
      // Clear form
      setSelectedUserId(0);
      setUserName("");
      setUserMobile("");
      setUserAddress("");
      setDescription("");
      setOccasion("");
      setBoliDate(new Date().toISOString().split('T')[0]);
      
      // Navigate to list
      setTimeout(() => setLocation('/dravya-entries'), 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create dravya entry",
        variant: "destructive",
      });
    },
  });

  const handleUserChange = (userId: string) => {
    const selectedUser = users?.find(u => u.id === parseInt(userId));
    if (selectedUser) {
      setSelectedUserId(selectedUser.id);
      setUserName(selectedUser.name);
      setUserMobile(selectedUser.mobile || "");
      setUserAddress(selectedUser.address || "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (selectedUserId <= 0) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }
    
    if (!description.trim()) {
      toast({
        title: "Error", 
        description: "Please provide a description",
        variant: "destructive",
      });
      return;
    }

    // Simplified payload for dravya entries - only essential fields
    const payload = {
      userId: selectedUserId,
      userName,
      userMobile,
      userAddress,
      description: description.trim(),
      occasion: occasion.trim(),
      entryDate: boliDate,
      createdBy: user?.username || "system",
    };

    createEntryMutation.mutate(payload);
  };

  if (usersError) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              <p>Error loading users. Please refresh the page and try again.</p>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user?.role !== 'operator' && user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Only operators and admins can create Dravya entries.
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
          onClick={() => setLocation('/dravya-entries')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dravya Entries
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Dravya Entry
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Dravya entries are spiritual donations that don't require quantity or amount tracking.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="user">Name of User *</Label>
              <UserSelect
                value={selectedUserId > 0 ? selectedUserId : undefined}
                onValueChange={(userId) => {
                  if (userId) {
                    const selectedUser = users?.find(u => u.id === userId);
                    if (selectedUser) {
                      setSelectedUserId(selectedUser.id);
                      setUserName(selectedUser.name);
                      setUserMobile(selectedUser.mobile || "");
                      setUserAddress(selectedUser.address || "");
                    }
                  } else {
                    setSelectedUserId(0);
                    setUserName("");
                    setUserMobile("");
                    setUserAddress("");
                  }
                }}
                placeholder="Search and select user"
                className="w-full"
              />
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

            {/* Quantity and UOM removed - not needed for dravya entries */}

            {/* Occasion */}
            <div className="space-y-2">
              <Label htmlFor="occasion">Occasion</Label>
              <Input 
                id="occasion"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Enter occasion (optional)"
              />
            </div>

            {/* Date of Entry */}
            <div className="space-y-2">
              <Label htmlFor="date">Date of Entry *</Label>
              <Input 
                id="date"
                type="date" 
                value={boliDate}
                onChange={(e) => setBoliDate(e.target.value)}
              />
            </div>

            {/* Amount removed - not needed for dravya entries */}

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/dravya-entries')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createEntryMutation.isPending}
                className="flex-1"
              >
                {createEntryMutation.isPending ? "Creating..." : "Create Dravya Entry"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}