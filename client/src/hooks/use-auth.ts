import { useContext } from "react";
import { AuthContext } from "@/lib/context/auth-context";
import { logout } from "@/lib/auth";

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return {
    ...context,
    logout,
  };
}
