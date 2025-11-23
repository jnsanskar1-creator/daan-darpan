import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import EntriesListMenu from "./entries-list-menu";
import EntriesFormMenu from "./entries-form-menu";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isActive = (path: string) => {
    if (path === '/dashboard' && (location === '/' || location === '/dashboard')) {
      return true;
    }
    if (path === '/entries' && (location === '/entries' || location === '/dravya-entries')) {
      return true;
    }
    return location === path || location.startsWith(path);
  };
  
  const getItemClass = (path: string) => {
    return `bottom-nav-item flex flex-col items-center py-2 px-4 ${
      isActive(path) ? 'text-primary' : 'text-neutral-500'
    }`;
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-neutral-200 pb-safe">
      <div className="flex items-center relative">
        {/* Admin Navigation */}
        {user?.role === 'admin' ? (
          <div className="flex-1 grid grid-cols-6 w-full">
            {/* First column: Dashboard */}
            <div className="flex justify-center">
              <Link href="/dashboard">
                <a className={getItemClass('/dashboard')}>
                  <span className="material-icons">dashboard</span>
                  <span className="text-xs">Dashboard</span>
                </a>
              </Link>
            </div>
            
            {/* Second column: Entries List Menu */}
            <div className="flex justify-center">
              <EntriesListMenu />
            </div>
            
            {/* Third column: Payments */}
            <div className="flex justify-center">
              <Link href="/payments">
                <a className={getItemClass('/payments')}>
                  <span className="material-icons">payments</span>
                  <span className="text-xs">Payments</span>
                </a>
              </Link>
            </div>
            
            {/* Fourth column: Logs */}
            <div className="flex justify-center">
              <Link href="/logs">
                <a className={getItemClass('/logs')}>
                  <span className="material-icons">account_balance</span>
                  <span className="text-xs">Logs</span>
                </a>
              </Link>
            </div>
            
            {/* Fifth column: Users */}
            <div className="flex justify-center">
              <Link href="/users">
                <a className={getItemClass('/users')}>
                  <span className="material-icons">people</span>
                  <span className="text-xs">Users</span>
                </a>
              </Link>
            </div>
            
            {/* Sixth column: Settings */}
            <div className="flex justify-center">
              <Link href="/settings">
                <a className={getItemClass('/settings')}>
                  <span className="material-icons">settings</span>
                  <span className="text-xs">Settings</span>
                </a>
              </Link>
            </div>
          </div>
        ) : user?.role === 'operator' ? (
          /* Operator Navigation - Has dashboard, entries list, add entry functionality, users, and payments */
          <div className="flex-1 grid grid-cols-6 w-full">
            {/* First column: Dashboard */}
            <div className="flex justify-center">
              <Link href="/dashboard">
                <a className={getItemClass('/dashboard')}>
                  <span className="material-icons">dashboard</span>
                  <span className="text-xs">Dashboard</span>
                </a>
              </Link>
            </div>
            
            {/* Second column: Entries List Menu */}
            <div className="flex justify-center">
              <EntriesListMenu />
            </div>
            
            {/* Third column: Add Entry Form Menu */}
            <div className="flex justify-center">
              <EntriesFormMenu />
            </div>
            
            {/* Fourth column: Payments */}
            <div className="flex justify-center">
              <Link href="/payments">
                <a className={getItemClass('/payments')}>
                  <span className="material-icons">payments</span>
                  <span className="text-xs">Payments</span>
                </a>
              </Link>
            </div>
            
            {/* Fifth column: Users */}
            <div className="flex justify-center">
              <Link href="/users">
                <a className={getItemClass('/users')}>
                  <span className="material-icons">people</span>
                  <span className="text-xs">Users</span>
                </a>
              </Link>
            </div>
            
            {/* Sixth column: Settings */}
            <div className="flex justify-center">
              <Link href="/settings">
                <a className={getItemClass('/settings')}>
                  <span className="material-icons">settings</span>
                  <span className="text-xs">Settings</span>
                </a>
              </Link>
            </div>
          </div>
        ) : (
          /* Regular viewer - 2 columns with equal spacing */
          <div className="flex-1 grid grid-cols-2 w-full">
            {/* First column: My Account */}
            <div className="flex justify-center">
              <Link href="/my-account">
                <a className={getItemClass('/my-account')}>
                  <span className="material-icons">person</span>
                  <span className="text-xs">My Account</span>
                </a>
              </Link>
            </div>
            
            {/* Second column: My Profile (Settings for viewers) */}
            <div className="flex justify-center">
              <Link href="/settings">
                <a className={getItemClass('/settings')}>
                  <span className="material-icons">settings</span>
                  <span className="text-xs">My Profile</span>
                </a>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
