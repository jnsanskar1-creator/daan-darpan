import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function EntriesListMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isEntriesActive = location === '/entries' || location === '/dravya-entries' || location === '/expense-entries' || location === '/advance-payments';

  const menuItems = [
    {
      path: '/entries',
      icon: 'gavel',
      label: 'Boli Entries',
      description: user?.role === 'viewer' ? 'View your boli entries' : 'Manage boli-related entries'
    },
    {
      path: '/dravya-entries',
      icon: 'inventory_2',
      label: 'Dravya Entries',
      description: user?.role === 'viewer' ? 'View your dravya entries' : 'Manage dravya-related entries'
    },
    ...(user?.role === 'operator' ? [{
      path: '/expense-entries',
      icon: 'receipt_long',
      label: 'Expense Entries',
      description: 'Manage company expense records'
    }] : []),
    ...((user?.role === 'admin' || user?.role === 'operator') ? [{
      path: '/advance-payments',
      icon: 'account_balance_wallet',
      label: 'Advance Payments',
      description: 'Manage advance payment records'
    }] : [])
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex flex-col items-center py-2 px-4 ${
          isEntriesActive ? 'text-primary' : 'text-neutral-500'
        }`}
      >
        <span className="material-icons">list_alt</span>
        <span className="text-xs">Entries</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-lg border border-neutral-200 z-50 min-w-64">
            <div className="p-2">
              <div className="text-sm font-medium text-neutral-700 px-3 py-2 border-b border-neutral-100">
                View Entries
              </div>
              
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    setLocation(item.path);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-md hover:bg-neutral-50 transition-colors ${
                    location === item.path ? 'bg-primary/10 text-primary' : 'text-neutral-700'
                  }`}
                >
                  <span className="material-icons text-lg">{item.icon}</span>
                  <div className="text-left">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-neutral-500">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}