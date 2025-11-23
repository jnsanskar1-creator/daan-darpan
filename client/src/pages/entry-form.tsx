import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { type User, UserRole } from "@shared/schema";
import { UserSelect } from "@/components/user-select";

const formSchema = z.object({
  userId: z.coerce.number().positive("Please select a user"),
  userName: z.string(),
  description: z.string().min(3, "Description must be at least 3 characters"),
  amount: z.coerce.number().positive("Amount must be positive"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  totalAmount: z.coerce.number().positive("Total amount must be positive"),
  occasion: z.string().min(2, "Occasion must be at least 2 characters"),
  bediNumber: z.string().min(1, "Please select a बेदी क्रमांक"),
  auctionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
});

type FormValues = z.infer<typeof formSchema>;

// Default dropdown options for description
const defaultDescriptionOptions = [
  "अभिषेक",
  "शांतिधारा", 
  "अष्ट प्रातिहार्य",
  "आरती",
  "महाआरती",
  "भक्तामर पाठ",
  "शास्त्र दान",
  "पाद प्रक्षालन",
  "द्रव्य भंडार राशि",
  "ध्वजारोहण",
  "धर्मशाला",
  "भंडार गृह",
  "गुप्तदान",
  "गुल्लक दान",
  "निर्माण(मंदिर)",
  "निर्माण(धर्मशाला)",
  "पाठशाला",
  "लाडू",
  "शांतिधारा (विशेष)",
  "भवन क्रय",
  "शादी",
  "चातुर्मास कलश"
];

// Default dropdown options for occasions
const defaultOccasionOptions = [
  "पर्यूषण पर्व",
  "मुकुट सप्तमी",
  "चौमासा स्थापना"
];

// Default dropdown options for बेदी क्रमांक
const defaultBediOptions = [
  "1",
  "2", 
  "3"
];

// Helper functions for localStorage
const getStoredOptions = (key: string, defaultOptions: string[]) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsedOptions = JSON.parse(stored);
      // Merge with default options to ensure we always have the base options
      const uniqueOptions = Array.from(new Set([...defaultOptions, ...parsedOptions]));
      return uniqueOptions;
    }
  } catch (error) {
    console.warn(`Error loading ${key} from localStorage:`, error);
  }
  return defaultOptions;
};

const saveOptionsToStorage = (key: string, options: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(options));
  } catch (error) {
    console.warn(`Error saving ${key} to localStorage:`, error);
  }
};

export default function EntryForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // State for dropdown options - initialized from localStorage
  const [descriptionOptions, setDescriptionOptions] = useState(() => 
    getStoredOptions('entry-form-descriptions', defaultDescriptionOptions)
  );
  const [occasionOptions, setOccasionOptions] = useState(() => 
    getStoredOptions('entry-form-occasions', defaultOccasionOptions)
  );
  const [bediOptions, setBediOptions] = useState(() => 
    getStoredOptions('entry-form-bedi-numbers', defaultBediOptions)
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isOccasionModalOpen, setIsOccasionModalOpen] = useState(false);
  const [isBediModalOpen, setIsBediModalOpen] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [newOccasion, setNewOccasion] = useState("");
  const [newBedi, setNewBedi] = useState("");
  
  // Redirect viewers away from this page, but allow operators and admins
  if (user && user.role === UserRole.VIEWER) {
    setLocation('/dashboard');
    return null;
  }

  // Fetch users for dropdown
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users']
  });
  
  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: 0,
      userName: "",
      description: "",
      amount: 0,
      quantity: 1,
      totalAmount: 0,
      occasion: "",
      bediNumber: "1",
      auctionDate: todayDate
    }
  });
  
  // Watch values for automatic calculations
  const watchUserId = form.watch("userId");
  const watchAmount = form.watch("amount");
  const watchQuantity = form.watch("quantity");
  
  // Update userName when userId changes
  const selectedUser = users?.find(user => user.id === watchUserId);
  if (selectedUser && form.getValues("userName") !== selectedUser.name) {
    form.setValue("userName", selectedUser.name);
  }
  
  // Update totalAmount when amount or quantity changes
  useEffect(() => {
    const calculatedTotal = watchAmount * watchQuantity;
    form.setValue("totalAmount", calculatedTotal);
  }, [watchAmount, watchQuantity, form]);
  
  const entryMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Create new entry (edit mode completely disabled)
      const response = await apiRequest("POST", "/api/entries", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Entry created successfully",
      });
      // Invalidate all related queries to ensure UI updates properly
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transaction-logs'] });
      setLocation('/entries');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create entry: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Function to add new option
  const handleAddOption = () => {
    if (newOption.trim() && !descriptionOptions.includes(newOption.trim())) {
      const updatedOptions = [...descriptionOptions, newOption.trim()];
      setDescriptionOptions(updatedOptions);
      saveOptionsToStorage('entry-form-descriptions', updatedOptions);
      form.setValue("description", newOption.trim());
      setNewOption("");
      setIsAddModalOpen(false);
      toast({
        title: "Success", 
        description: "New option added successfully"
      });
    }
  };

  // Function to add new occasion
  const handleAddOccasion = () => {
    if (newOccasion.trim() && !occasionOptions.includes(newOccasion.trim())) {
      const updatedOptions = [...occasionOptions, newOccasion.trim()];
      setOccasionOptions(updatedOptions);
      saveOptionsToStorage('entry-form-occasions', updatedOptions);
      form.setValue("occasion", newOccasion.trim());
      setNewOccasion("");
      setIsOccasionModalOpen(false);
      toast({
        title: "Success", 
        description: "New occasion added successfully"
      });
    }
  };

  // Function to add new bedi number
  const handleAddBedi = () => {
    if (newBedi.trim() && !bediOptions.includes(newBedi.trim())) {
      const updatedOptions = [...bediOptions, newBedi.trim()];
      setBediOptions(updatedOptions);
      saveOptionsToStorage('entry-form-bedi-numbers', updatedOptions);
      form.setValue("bediNumber", newBedi.trim());
      setNewBedi("");
      setIsBediModalOpen(false);
      toast({
        title: "Success", 
        description: "New बेदी क्रमांक added successfully"
      });
    }
  };

  const onSubmit = (data: FormValues) => {
    entryMutation.mutate(data);
  };

  return (
    <div className="flex-grow p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">New Entry</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setLocation('/previous-outstanding/new')}
            className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium"
          >
            📝 Past Records
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation('/entries')}
          >
            <span className="material-icons text-neutral-500">close</span>
          </Button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* User Name */}
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-neutral-700">Name of User</FormLabel>
                  <FormControl>
                    <UserSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Search and select user"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Hidden fields */}
            <input type="hidden" {...form.register("userName")} />
            <input type="hidden" {...form.register("totalAmount")} />
            
            {/* Line Item Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-neutral-700">Line Item Description</FormLabel>
                  <FormControl>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        if (value === "__add_more__") {
                          setIsAddModalOpen(true);
                        } else {
                          field.onChange(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select description" />
                      </SelectTrigger>
                      <SelectContent>
                        {descriptionOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                        <SelectItem value="__add_more__" className="text-blue-600 font-medium">
                          + Add More
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Add More Dialog */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Description Option</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Enter new description"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setNewOption("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddOption}>
                      Add Option
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Amount and Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-neutral-700">Amount (₹)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        min="0" 
                        step="1" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-neutral-700">Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="1" 
                        min="1" 
                        step="1" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Occasion - Updated to dropdown */}
            <FormField
              control={form.control}
              name="occasion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-neutral-700">विशेष अवसर</FormLabel>
                  <FormControl>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        if (value === "__add_more__") {
                          setIsOccasionModalOpen(true);
                        } else {
                          field.onChange(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select विशेष अवसर" />
                      </SelectTrigger>
                      <SelectContent>
                        {occasionOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                        <SelectItem value="__add_more__" className="text-blue-600 font-medium">
                          + Add More
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormLabel className="text-sm font-medium text-neutral-700">बेदी क्रमांक</FormLabel>
                  <FormControl>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        if (value === "__add_more__") {
                          setIsBediModalOpen(true);
                        } else {
                          field.onChange(value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select बेदी क्रमांक" />
                      </SelectTrigger>
                      <SelectContent>
                        {bediOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                        <SelectItem value="__add_more__" className="text-blue-600 font-medium">
                          + Add More
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Add Occasion Dialog */}
            <Dialog open={isOccasionModalOpen} onOpenChange={setIsOccasionModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New विशेष अवसर</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Enter new विशेष अवसर"
                    value={newOccasion}
                    onChange={(e) => setNewOccasion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOccasion();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsOccasionModalOpen(false);
                        setNewOccasion("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddOccasion}>
                      Add Option
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add बेदी क्रमांक Dialog */}
            <Dialog open={isBediModalOpen} onOpenChange={setIsBediModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New बेदी क्रमांक</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Enter new बेदी क्रमांक"
                    value={newBedi}
                    onChange={(e) => setNewBedi(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBedi();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsBediModalOpen(false);
                        setNewBedi("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddBedi}>
                      Add Option
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Date of Auction */}
            <FormField
              control={form.control}
              name="auctionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-neutral-700">Date of Boli</FormLabel>
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
            <Button 
              type="submit" 
              className="w-full bg-primary text-white py-3 rounded-md font-medium"
              disabled={entryMutation.isPending}
            >
              {entryMutation.isPending ? "Creating..." : "Create Entry"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
