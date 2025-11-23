import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  name: string;
  mobile?: string;
  address?: string;
}

interface UserSelectProps {
  value?: number;
  onValueChange: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UserSelect({ value, onValueChange, placeholder = "Select user", disabled = false, className }: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const selectedUser = users?.find(user => user.id === value);

  const formatUserDisplay = (user: User) => {
    const parts = [user.name];
    if (user.mobile) parts.push(user.mobile);
    if (user.address) parts.push(user.address);
    return parts.join(' - ');
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchTerm) return users;

    const searchLower = searchTerm.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(searchLower) ||
      (user.mobile && user.mobile.toLowerCase().includes(searchLower)) ||
      (user.address && user.address.toLowerCase().includes(searchLower))
    );
  }, [users, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled || isLoading}
        >
          {selectedUser ? formatUserDisplay(selectedUser) : (isLoading ? "Loading users..." : placeholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <div className="p-2">
          <Input
            placeholder="Search users by name, mobile, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="max-h-[200px] overflow-auto">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className={cn(
                  "flex items-center px-2 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  value === user.id && "bg-accent text-accent-foreground"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("User clicked:", user.id, user.name);
                  // Always call with the user ID
                  onValueChange(user.id);
                  setOpen(false);
                  setSearchTerm("");
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === user.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.mobile && `📱 ${user.mobile}`}
                    {user.mobile && user.address && ' • '}
                    {user.address && `🏠 ${user.address}`}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              {isLoading ? "Loading users..." : searchTerm ? "No users found matching search" : "No users available"}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}