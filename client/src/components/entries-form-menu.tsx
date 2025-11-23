import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function EntriesFormMenu() {
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

  const isFormsActive = location === '/entry/new' || location === '/dravya-entry-form' || location === '/expense-entry-form' || location === '/advance-payment-form' || location === '/previous-outstanding/new';

  // Only show this menu for operators and admins
  if (user?.role !== 'operator' && user?.role !== 'admin') {
    return null;
  }

  const menuItems = [
    {
      path: '/entry/new',
      icon: 'add_circle',
      label: 'New Boli Entry',
      description: 'Create new boli entry'
    },
    {
      path: '/dravya-entry-form',
      icon: 'add_circle',
      label: 'New Dravya Entry',
      description: 'Create new dravya entry'
    },
    ...(user?.role === 'operator' ? [{
      path: '/expense-entry-form',
      icon: 'receipt_long',
      label: 'New Expense Entry',
      description: 'Create new expense entry'
    }] : []),
    ...((user?.role === 'admin' || user?.role === 'operator') ? [{
      path: '/advance-payment-form',
      icon: 'account_balance_wallet',
      label: 'Add Advance Payment',
      description: 'Record new advance payment'
    }] : []),
    ...((user?.role === 'admin' || user?.role === 'operator') ? [{
      path: '/previous-outstanding/new',
      icon: 'history',
      label: 'Previous Outstanding',
      description: 'Record past outstanding amounts with proof'
    }] : [])
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex flex-col items-center py-2 px-4 ${
          isFormsActive ? 'text-primary' : 'text-neutral-500'
        }`}
      >
        <span className="material-icons text-primary">add_circle</span>
        <span className="text-xs">Add Entry</span>
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
                Create New Entry
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
                  <span className="material-icons text-lg text-primary">{item.icon}</span>
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