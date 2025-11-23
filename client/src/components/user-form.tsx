import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { UserRole } from "@shared/schema";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export function UserFormFields({ 
  form, 
  isNewUser = false, 
  isSubmitting = false 
}: { 
  form: UseFormReturn<any>;
  isNewUser?: boolean;
  isSubmitting?: boolean;
}) {
  const [mobileCheckResult, setMobileCheckResult] = useState<{ exists: boolean; user?: any } | null>(null);
  const [isCheckingMobile, setIsCheckingMobile] = useState(false);
  
  // Watch mobile field changes
  const mobileValue = form.watch("mobile");
  
  // Check for duplicate mobile when mobile changes and is for new user
  useEffect(() => {
    if (!isNewUser || !mobileValue || mobileValue.length < 10) {
      setMobileCheckResult(null);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      if (mobileValue.length >= 10) {
        setIsCheckingMobile(true);
        try {
          const response = await apiRequest('POST', '/api/users/check-mobile', {
            mobile: mobileValue
          });
          const result = await response.json();
          setMobileCheckResult(result);
          
          // Set form error if mobile exists
          if (result.exists) {
            form.setError('mobile', {
              message: `Mobile number belongs to: ${result.user.name} (${result.user.username})`
            });
          } else {
            form.clearErrors('mobile');
          }
        } catch (error) {
          console.error('Error checking mobile:', error);
        } finally {
          setIsCheckingMobile(false);
        }
      }
    }, 500); // Debounce for 500ms
    
    return () => clearTimeout(timeoutId);
  }, [mobileValue, isNewUser, form]);
  return (
    <>
      <FormField
        control={form.control}
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
      
      {isNewUser && (
        <>
          <FormField
            control={form.control}
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
            control={form.control}
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
        </>
      )}
      
      <FormField
        control={form.control}
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
        control={form.control}
        name="mobile"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mobile Number</FormLabel>
            <FormControl>
              <div className="relative">
                <Input 
                  type="tel" 
                  placeholder="Mobile Number" 
                  {...field}
                  className={mobileCheckResult?.exists ? "border-red-500" : ""}
                />
                {isCheckingMobile && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
            {mobileCheckResult?.exists && (
              <div className="text-sm text-red-600 mt-1">
                ⚠️ Mobile number belongs to: <strong>{mobileCheckResult.user.name}</strong> ({mobileCheckResult.user.username})
              </div>
            )}
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
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
        control={form.control}
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
                <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                <SelectItem value={UserRole.OPERATOR}>Operator</SelectItem>
                <SelectItem value={UserRole.VIEWER}>Viewer</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
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
        disabled={isSubmitting || (isNewUser && mobileCheckResult?.exists)}
      >
        {isSubmitting 
          ? (isNewUser ? "Creating..." : "Updating...") 
          : (isNewUser ? "Create User" : "Update User")
        }
      </Button>
    </>
  );
}