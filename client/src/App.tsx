import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import UserDetail from "@/pages/user-detail";
import Entries from "@/pages/entries";
import EntryForm from "@/pages/entry-form";
import EntryEdit from "@/pages/entry-edit";
import DravyaEntries from "@/pages/dravya-entries";
import DravyaEntryForm from "@/pages/dravya-entry-form";
import ExpenseEntries from "@/pages/expense-entries";
import ExpenseEntryForm from "@/pages/expense-entry-form";
import PreviousOutstandingForm from "@/pages/previous-outstanding-form";
import PreviousOutstanding from "@/pages/previous-outstanding";
import PreviousOutstandingDetails from "@/pages/previous-outstanding-details";
import PreviousOutstandingPayments from "@/pages/previous-outstanding-payments";
import EditPreviousOutstanding from "@/pages/edit-previous-outstanding";
import AdvancePayments from "@/pages/advance-payments";
import AdvancePaymentForm from "@/pages/advance-payment-form";
import PaymentDetails from "@/pages/payment-details";
import Payments from "@/pages/payments";
import TransactionLogs from "@/pages/logs";
import Settings from "@/pages/settings";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import CopyrightFooter from "@/components/copyright-footer";
import { AuthProvider } from "@/lib/context/auth-context";
import { useAuth } from "@/hooks/use-auth";
import LoginForm from "@/components/auth/login-form";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <LoginForm />;
  }

  // Component for root route that redirects based on user role
  function RootRedirect() {
    const [, setLocation] = useLocation();
    
    // Redirect viewers to their account page
    if (user?.role === 'viewer') {
      setLocation('/my-account');
      return null;
    }
    return <Dashboard />;
  }

  // Component for dashboard route that blocks viewers
  function DashboardRoute() {
    if (user?.role === 'viewer') {
      return <div className="p-4 text-center">Access denied. This page is not available for your role.</div>;
    }
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <SidebarNavigation />
      <div className="flex-grow pl-4 pt-16 pb-16">
        <PWAInstallPrompt />
        <Switch>
          <Route path="/" component={RootRedirect} />
          <Route path="/dashboard" component={DashboardRoute} />
          <Route path="/users" component={Users} />
          <Route path="/users/:id" component={UserDetail} />
          <Route path="/my-account" component={UserDetail} />
          <Route path="/entries" component={Entries} />
          <Route path="/entry/new" component={EntryForm} />
          <Route path="/entries/:id/edit" component={EntryEdit} />
          <Route path="/previous-outstanding" component={PreviousOutstanding} />
          <Route path="/previous-outstanding/new" component={PreviousOutstandingForm} />
          <Route path="/previous-outstanding/:id/edit" component={EditPreviousOutstanding} />
          <Route path="/previous-outstanding/:id/details" component={PreviousOutstandingDetails} />
          <Route path="/previous-outstanding-payments" component={PreviousOutstandingPayments} />
          <Route path="/dravya-entries" component={DravyaEntries} />
          <Route path="/dravya-entry-form" component={DravyaEntryForm} />
          <Route path="/expense-entries" component={ExpenseEntries} />
          <Route path="/expense-entry-form" component={ExpenseEntryForm} />
          <Route path="/expense-entry-form/:id" component={ExpenseEntryForm} />
          <Route path="/advance-payments" component={AdvancePayments} />
          <Route path="/advance-payment-form" component={AdvancePaymentForm} />
          {/* Edit entry functionality has been disabled */}
          <Route path="/entries/:id" component={PaymentDetails} />
          <Route path="/payment-details/:id" component={PaymentDetails} />
          <Route path="/payments" component={Payments} />
          <Route path="/logs" component={TransactionLogs} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <CopyrightFooter />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
