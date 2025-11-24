import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, Database, Settings as SettingsIcon, Upload } from "lucide-react";

// Profile update schema
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  mobile: z.string().min(10, "Mobile number should be at least 10 digits").optional(),
  address: z.string().optional()
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// Corpus settings schema
const corpusSchema = z.object({
  corpusValue: z.number().min(0, "Corpus value must be positive"),
  baseDate: z.string().min(1, "Base date is required")
});

type CorpusFormValues = z.infer<typeof corpusSchema>;

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch corpus settings (admin only)
  const { data: corpusSettings } = useQuery({
    queryKey: ['/api/corpus-settings'],
    enabled: user?.role === 'admin',
    retry: false
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      mobile: user?.mobile || "",
      address: user?.address || ""
    }
  });

  const corpusForm = useForm<CorpusFormValues>({
    resolver: zodResolver(corpusSchema),
    defaultValues: {
      corpusValue: 0,
      baseDate: "2025-07-31"
    }
  });

  // Update corpus form when settings data loads
  useEffect(() => {
    if (corpusSettings && typeof corpusSettings === 'object' && 'corpusValue' in corpusSettings) {
      corpusForm.reset({
        corpusValue: corpusSettings.corpusValue as number,
        baseDate: corpusSettings.baseDate as string
      });
    }
  }, [corpusSettings, corpusForm]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const response = await apiRequest("PATCH", "/api/auth/profile", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Your profile has been updated successfully",
      });

      // Refresh user data in auth context
      refreshUser();

      // Invalidate cached data that might reference this user
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });

      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update profile: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Profile update handler
  const onUpdateProfile = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  // Corpus settings mutation
  const updateCorpusMutation = useMutation({
    mutationFn: async (data: CorpusFormValues) => {
      const response = await apiRequest("POST", "/api/corpus-settings", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Corpus settings updated successfully",
      });

      // Invalidate dashboard data to refresh overall summary
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/corpus-settings'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update corpus settings: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Corpus update handler
  const onUpdateCorpus = (data: CorpusFormValues) => {
    updateCorpusMutation.mutate(data);
  };

  // Database backup mutation
  const backupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/database/backup");
      return response.json();
    },
    onSuccess: (data) => {
      // Automatically download the backup file
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || 'database-backup.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Success",
        description: data.message || "Database backup created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create database backup: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleBackup = () => {
    backupMutation.mutate();
  };

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
      setLocation("/");
    } else {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "An error occurred during logout",
      });
    }
  };

  // Database restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      // Use full backend URL in production, relative path in development
      const baseUrl = import.meta.env.MODE === 'production'
        ? 'https://daan-darpan-backend.onrender.com'
        : '';

      const response = await fetch(`${baseUrl}/api/database/restore`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Important for cookies
      });

      if (!response.ok) {
        let errorMessage = 'Restore failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (e) {
          // If JSON parsing fails, try to get text
          const text = await response.text();
          errorMessage = text || `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Restore Successful",
        description: `Restored: ${Object.entries(data.stats).map(([k, v]: any) => `${k}: ${v.inserted}`).join(', ')}`,
      });
      // Invalidate all queries
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast({
        title: "Restore Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleRestoreClick = () => {
    document.getElementById('restore-file-input')?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (confirm("WARNING: This will WIPE ALL existing data and replace it with the backup file. This action cannot be undone. Continue?")) {
        restoreMutation.mutate(file);
      }
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </div>
            {!isEditing && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Your email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Your mobile number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Your address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Name</h3>
                  <p className="text-base">{user?.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Username</h3>
                  <p className="text-base">{user?.username}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Email</h3>
                  <p className="text-base">{user?.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Role</h3>
                  <p className="text-base capitalize">{user?.role}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Mobile</h3>
                  <p className="text-base">{user?.mobile || "-"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Account Status</h3>
                  <div className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${user?.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    <span className="capitalize">{user?.status || 'Active'}</span>
                  </div>
                </div>
              </div>

              {user?.address && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-neutral-500">Address</h3>
                  <p className="text-base">{user.address}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Corpus Settings Section - Only visible to admins */}
      {user?.role === 'admin' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Corpus Settings
            </CardTitle>
            <CardDescription>
              Configure the corpus value as on 31st July 2025 for overall summary calculations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...corpusForm}>
              <form onSubmit={corpusForm.handleSubmit(onUpdateCorpus)} className="space-y-4">
                <FormField
                  control={corpusForm.control}
                  name="corpusValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Corpus as on 31st Jul'25 (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter corpus value in rupees"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={corpusForm.control}
                  name="baseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>About Corpus Settings:</strong>
                  </p>
                  <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                    <li>This value represents the total corpus amount as on the specified base date</li>
                    <li>Used in Overall Summary calculation: Corpus + Total Received + Advance Payments - Total Expenses = Cash in Bank</li>
                    <li>Overall Summary is displayed at the top of the Dashboard and works independent of date filters</li>
                    <li>Only admins can modify this setting</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={updateCorpusMutation.isPending}
                  className="w-full"
                >
                  {updateCorpusMutation.isPending ? "Updating..." : "Update Corpus Settings"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Database Backup Section - Only visible to operators and admins */}
      {(user?.role === 'operator' || user?.role === 'admin') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Management
            </CardTitle>
            <CardDescription>
              Backup and restore database data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Database Management Features:</strong>
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>Backup:</strong> Exports all data to Excel and emails it to operators.</li>
                  <li><strong>Restore:</strong> Import data from an Excel backup file.</li>
                  <li>Restore will <strong>merge</strong> data: New records are added, existing IDs are skipped.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={handleBackup}
                  disabled={backupMutation.isPending}
                  className="w-full"
                  variant="outline"
                >
                  {backupMutation.isPending ? (
                    <>
                      <Database className="mr-2 h-4 w-4 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Backup
                    </>
                  )}
                </Button>

                <div className="w-full">
                  <input
                    type="file"
                    id="restore-file-input"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    onClick={handleRestoreClick}
                    disabled={restoreMutation.isPending}
                    className="w-full"
                    variant="default"
                  >
                    {restoreMutation.isPending ? (
                      <>
                        <Database className="mr-2 h-4 w-4 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Restore from Excel
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}