import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import mandirLogo from "@assets/new logo mandir color_1754807711657.jpg";
import daanDarpanLogo from "@assets/temple_logo_1755868550530.jpeg";

const loginFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });
  
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginFormValues) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error) => {
      toast({
        title: "Authentication Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive"
      });
      setIsSubmitting(false);
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });
  
  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Welcome Section */}
      <div className="flex-1 bg-gradient-to-br from-primary to-primary/80 text-white p-6 lg:p-12 flex flex-col justify-between hidden lg:flex">
        <div>
          {/* Logo Section */}
          <div className="flex items-center gap-3 mb-12">
            <img 
              src={mandirLogo} 
              alt="श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति" 
              className="w-12 h-12 rounded-full"
            />
            <span className="text-lg font-bold">श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति शिवनगर, जबलपुर</span>
          </div>
          
          {/* Welcome Content */}
          <div className="space-y-8">
            <h1 className="text-4xl font-bold">दान-दर्पण में आपका स्वागत है</h1>
            <p className="text-xl text-white/90 leading-relaxed">
              आध्यात्मिक संस्थानों और मंदिर प्रशासन के लिए डिज़ाइन किया गया व्यापक दान प्रबंधन सिस्टम।
            </p>
            
            {/* Feature List */}
            <ul className="space-y-4 text-white/90">
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span>बोली प्रविष्टि और भुगतान प्रबंधन</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span>हिंदी रसीद जेनरेशन</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                <span>भूमिका-आधारित पहुँच नियंत्रण</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-white/70 text-sm">
          © 2025 श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति शिवनगर, जबलपुर. All rights reserved.
        </div>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-md">
          {/* Header with Logo */}
          <div className="text-center mb-8">
            {/* Mobile header with दान-दर्पण logo */}
            <div className="flex justify-center items-center gap-4 mb-4 lg:hidden">
              <img 
                src={daanDarpanLogo} 
                alt="दान-दर्पण Logo" 
                className="w-16 h-16"
              />
            </div>
            
            {/* Desktop header with app logo only */}
            <div className="hidden lg:flex justify-center mb-4">
              <img 
                src={daanDarpanLogo} 
                alt="दान-दर्पण Logo" 
                className="w-16 h-16"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
            <p className="text-gray-600">Enter your credentials to access your account</p>
          </div>
          
          {/* Login Card */}
          <Card className="shadow-lg border-0">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Welcome Back</h3>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">Username</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter username" 
                            className="h-12 border-gray-300 focus:border-primary"
                            {...field} 
                          />
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
                        <FormLabel className="text-gray-700">Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            placeholder="Enter password" 
                            className="h-12 border-gray-300 focus:border-primary"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
