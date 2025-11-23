import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { type User, UserRole } from "@shared/schema";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import BulkUserUpload from "@/components/bulk-user-upload";
import { exportUsers } from "@/lib/excel-export";

// User form schema - dynamic based on user role
const createUserFormSchema = (currentUserRole: string) => z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Please enter a valid email"),
  mobile: z.string().min(10, "Mobile number should be at least 10 digits"),
  address: z.string().optional(),
  role: currentUserRole === 'admin' 
    ? z.enum(["admin", "operator", "viewer"])
    : z.enum(["operator", "viewer"]), // Operators can only create operator/viewer users
  status: z.enum(["active", "inactive"])
});

export default function Users() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Show loading while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Only allow access for admin and operator
  if (!user || (user.role !== 'admin' && user.role !== 'operator')) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-neutral-600">You don't have permission to access user management.</p>
        </div>
      </div>
    );
  }
  
  const userFormSchema = createUserFormSchema(user.role);
  type UserFormValues = z.infer<typeof userFormSchema>;
  
  // Form for new user
  const newUserForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      email: "",
      mobile: "",
      address: "",
      role: "viewer",
      status: "active"
    }
  });
  
  // Form for editing user
  const editUserForm = useForm<Partial<UserFormValues>>({
    resolver: zodResolver(userFormSchema.partial()),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      address: "",
      role: "viewer",
      status: "active"
    }
  });
  
  // Fetch users
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users']
  });

  // Filter users based on role and search term
  const users = useMemo(() => {
    if (!allUsers) return [];
    
    // All users are visible to both admin and operator roles
    // Edit permissions are controlled separately in the edit dialog
    let filteredUsers = allUsers;
    
    // Search filtering across all displayed user details
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredUsers = filteredUsers.filter(u => 
        u.name.toLowerCase().includes(searchLower) ||
        u.username.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        (u.mobile && u.mobile.toLowerCase().includes(searchLower)) ||
        (u.address && u.address.toLowerCase().includes(searchLower)) ||
        u.role.toLowerCase().includes(searchLower) ||
        u.status.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by serial number in ascending order
    return filteredUsers.sort((a, b) => a.serialNumber - b.serialNumber);
  }, [allUsers, user?.role, searchTerm]);
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      const response = await apiRequest("POST", "/api/users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setIsNewUserDialogOpen(false);
      newUserForm.reset();
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create user: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<UserFormValues> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setIsEditUserDialogOpen(false);
      editUserForm.reset();
      
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      
      // If the updated user is the current logged-in user, also refresh the auth user data
      if (user && selectedUser && user.id === selectedUser.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update user: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Submit handlers
  const onCreateUser = (data: UserFormValues) => {
    createUserMutation.mutate(data);
  };
  
  const onUpdateUser = (data: Partial<UserFormValues>) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({ id: selectedUser.id, data });
  };
  
  // Handle edit button click
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editUserForm.reset({
      name: user.name,
      email: user.email,
      mobile: user.mobile || "",
      address: user.address || "",
      role: user.role as "admin" | "operator" | "viewer",
      status: user.status as "active" | "inactive"
    });
    setIsEditUserDialogOpen(true);
  };

  if (usersLoading) {
    return <div className="flex justify-center p-8">Loading users...</div>;
  }

  return (
    <div className="flex-grow p-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">User Management</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => exportUsers(users || [])}
            variant="outline"
            size="sm"
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 flex items-center gap-2"
          >
            <span className="text-sm">📊</span>
            Export
          </Button>
          <Button 
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <span className="material-icons text-sm">upload_file</span>
            Bulk Upload
          </Button>
        </div>
      </div>
      
      {/* Bulk Upload Section */}
      {showBulkUpload && (
        <div className="mb-6">
          <BulkUserUpload />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-10 w-10 p-0" variant="default">
                <span className="material-icons">person_add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <Form {...newUserForm}>
              <form onSubmit={newUserForm.handleSubmit(onCreateUser)} className="space-y-4 py-4">
                <FormField
                  control={newUserForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Mobile Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {user.role === 'admin' && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={newUserForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="material-icons text-neutral-500 text-lg">search</span>
          </span>
          <Input 
            placeholder="Search users by name, username, email, mobile, address, role, or status" 
            className="w-full pl-10 pr-4 py-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <p className="text-sm text-neutral-600 mt-2">
            Found {users.length} user{users.length !== 1 ? 's' : ''} matching "{searchTerm}"
          </p>
        )}
      </div>
      
      {/* User List */}
      <div>
        {!users || users.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No users found</div>
        ) : (
          users.map(userItem => (
            <div 
              key={userItem.id} 
              className="bg-white rounded-lg shadow-md p-4 mb-4 flex justify-between items-center"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-mono">
                    #{userItem.serialNumber}
                  </span>
                  <Link href={`/users/${userItem.id}`}>
                    <h3 className="font-medium text-primary hover:underline cursor-pointer">{userItem.name}</h3>
                  </Link>
                </div>
                <p className="text-sm text-neutral-500">{userItem.email}</p>
                {userItem.mobile && <p className="text-sm text-neutral-500">📱 {userItem.mobile}</p>}
                {userItem.address && <p className="text-sm text-neutral-500">🏠 {userItem.address}</p>}
                <div className="flex items-center mt-1">
                  <span className={`text-xs ${userItem.role === UserRole.ADMIN ? 'bg-secondary' : 'bg-primary'} text-white px-2 py-0.5 rounded-full mr-2`}>
                    {userItem.role}
                  </span>
                  <span className={`text-xs ${userItem.status === 'active' ? 'bg-green-500' : 'bg-neutral-500'} text-white px-2 py-0.5 rounded-full`}>
                    {userItem.status}
                  </span>
                </div>
              </div>
              <div>
                <Button 
                  variant="ghost" 
                  className="text-primary p-2"
                  onClick={() => handleEditUser(userItem)}
                  disabled={user?.role === 'operator' && userItem.role === 'admin'}
                  title={user?.role === 'operator' && userItem.role === 'admin' ? 'Cannot edit admin users' : 'Edit user'}
                >
                  <span className="material-icons">edit</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <Form {...editUserForm}>
              <form onSubmit={editUserForm.handleSubmit(onUpdateUser)} className="space-y-4 py-4">
                <FormField
                  control={editUserForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editUserForm.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Mobile Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editUserForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {user.role === 'admin' && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editUserForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}