import { createContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthUser } from "@/lib/auth";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  refreshUser: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  error: null,
  refreshUser: () => {}
});

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error, refetch } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (res.status === 401) {
        return null; // Not authenticated
      }
      
      if (!res.ok) {
        throw new Error(`Failed to fetch user: ${res.status}`);
      }
      
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 2 * 60 * 1000
  });
  
  // Function to force refresh user data
  const refreshUser = () => {
    refetch();
  };

  return (
    <AuthContext.Provider value={{ 
      user: data || null, 
      isLoading, 
      error: error as Error,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}
