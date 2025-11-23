import { queryClient } from "./queryClient";

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  mobile?: string;
  address?: string;
};

export async function logout() {
  try {
    const BASE_URL = 'https://daan-darpan-backend.onrender.com';
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    // Immediately clear the user from cache to trigger UI update
    queryClient.setQueryData(['/api/auth/user'], null);
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

    // We don't force reload here anymore, letting the UI handle the redirect
    // window.location.href = "/";
    return true;
  } catch (error) {
    console.error("Logout failed:", error);
    return false;
  }
}
