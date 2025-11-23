import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Menu, 
  Home, 
  Users, 
  FileText, 
  Plus, 
  CreditCard, 
  BarChart3, 
  Settings,
  UserCircle,
  Receipt,
  DollarSign,
  BookOpen,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import daanDarpanLogo from "@assets/daan_darpan_new_logo.png";

interface User {
  role: string;
  name?: string;
  username: string;
}

export function SidebarNavigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false
  });

  const isViewer = user?.role === 'viewer';

  const toggleMenu = (menuKey: string) => {
    setOpenMenus(prev => 
      prev.includes(menuKey) 
        ? prev.filter(key => key !== menuKey)
        : [...prev, menuKey]
    );
  };
  
  const menuGroups = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: Home,
      href: "/dashboard",
      show: user?.role === 'admin' || user?.role === 'operator',
      isMainItem: true
    },
    {
      key: "account",
      label: "My Account", 
      icon: UserCircle,
      show: true,
      items: [
        {
          label: "My Account",
          href: "/my-account",
          show: true
        }
      ]
    },
    {
      key: "users",
      label: "Users",
      icon: Users,
      show: user?.role === 'admin' || user?.role === 'operator',
      items: [
        {
          label: "All Users",
          href: "/users",
          show: user?.role === 'admin' || user?.role === 'operator'
        }
      ]
    },
    {
      key: "entries",
      label: "Boli Entries",
      icon: FileText,
      show: user?.role === 'admin' || user?.role === 'operator',
      items: [
        {
          label: "View Boli Entries",
          href: "/entries",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "Add New Boli Entry",
          href: "/entry/new",
          show: user?.role === 'admin' || user?.role === 'operator'
        }
      ]
    },
    {
      key: "dravya",
      label: "Dravya",
      icon: BookOpen,
      show: user?.role === 'admin' || user?.role === 'operator',
      items: [
        {
          label: "Dravya Entries",
          href: "/dravya-entries",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "New Dravya Entry",
          href: "/dravya-entry-form",
          show: user?.role === 'admin' || user?.role === 'operator'
        }
      ]
    },
    {
      key: "expenses",
      label: "Expenses",
      icon: Receipt,
      show: user?.role === 'admin' || user?.role === 'operator',
      items: [
        {
          label: "Expense Entries",
          href: "/expense-entries",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "New Expense",
          href: "/expense-entry-form",
          show: user?.role === 'admin' || user?.role === 'operator'
        }
      ]
    },
    {
      key: "payments",
      label: "Payments",
      icon: DollarSign,
      show: user?.role === 'admin' || user?.role === 'operator',
      items: [
        {
          label: "All Boli Payments",
          href: "/payments",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "All Advance Payments",
          href: "/advance-payments",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "New Advance Payment",
          href: "/advance-payment-form",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "Previous Outstanding",
          href: "/previous-outstanding",
          show: user?.role === 'admin' || user?.role === 'operator'
        },
        {
          label: "All Previous Outstanding Payments",
          href: "/previous-outstanding-payments",
          show: user?.role === 'admin' || user?.role === 'operator'
        }
      ]
    },
    {
      key: "logs",
      label: "Logs",
      icon: BarChart3,
      href: "/logs",
      show: user?.role === 'admin',
      isMainItem: true
    },
    {
      key: "settings",
      label: user?.role === 'viewer' ? "My Profile" : "Settings",
      icon: Settings,
      href: "/settings",
      show: true,
      isMainItem: true
    }
  ];

  const filteredMenuGroups = menuGroups.filter(group => group.show);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <img 
            src={daanDarpanLogo} 
            alt="Daan-Darpan Logo" 
            className="w-10 h-8 object-contain"
          />
          <div>
            <h2 className="font-semibold text-sm">दान-दर्पण</h2>
            <p className="text-xs text-muted-foreground">
              {user?.name || user?.username}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto p-4">
        <nav className="space-y-2">
          {filteredMenuGroups.map((group) => {
            const Icon = group.icon;
            const isMenuOpen = openMenus.includes(group.key);
            
            // For main items without sub-menus
            if (group.isMainItem) {
              const isActive = location === group.href;
              return (
                <Link key={group.key} href={group.href!}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon size={18} />
                    {group.label}
                  </Button>
                </Link>
              );
            }

            // For menu groups with sub-items
            return (
              <Collapsible key={group.key} open={isMenuOpen} onOpenChange={() => toggleMenu(group.key)}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      {group.label}
                    </div>
                    {isMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-1">
                  {group.items?.filter(item => item.show).map((item) => {
                    const isActive = location === item.href || 
                      (item.href === "/my-account" && location.includes("/users/"));
                    
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          className="w-full justify-start gap-3 ml-6 text-sm"
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <Button 
        variant="outline" 
        size="icon"
        className="fixed top-4 left-4 z-50 bg-white shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <Menu size={20} />
      </Button>
      
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white w-72 h-full shadow-lg">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}