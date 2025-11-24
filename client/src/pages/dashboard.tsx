import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PaymentStatus, type Entry } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DailyEarningsCalendar from "@/components/daily-earnings-calendar";
import DailyPaymentsCalendar from "@/components/daily-payments-calendar";

type DashboardData = {
  summary: {
    totalAmount: number;
    receivedAmount: number;
    pendingAmount: number;
    pendingEntries: number;
    partialEntries: number;
    completedEntries: number;
    totalAdvancePayments?: number;
  };
  overallSummary: {
    corpusValue: number;
    totalReceived: number;
    totalAdvancePayments: number;
    totalExpenses: number;
    totalReceivedOutstanding: number;
    cashInBank: number;
  };
  recentActivity: Entry[];
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-destructive';
    case 'partial': return 'bg-orange-500';
    case 'full': return 'bg-green-500';
    default: return 'bg-neutral-500';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'Payment Pending';
    case 'partial': return 'Partially Paid';
    case 'full': return 'Fully Paid';
    default: return 'Unknown';
  }
};

const getActivityIcon = (status: string) => {
  switch (status) {
    case 'pending': return 'pending';
    case 'partial': return 'sync';
    case 'full': return 'check_circle';
    default: return 'info';
  }
};

export default function Dashboard() {
  const { user } = useAuth();

  // Block access for viewer role
  if (user?.role === 'viewer') {
    return (
      <div className="p-4 text-center">
        <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Dashboard is not available for your role.</p>
      </div>
    );
  }
  const [, setLocation] = useLocation();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), 0, 1)); // Start of current year
  const [endDate, setEndDate] = useState<Date | null>(new Date()); // Today

  // Build query parameters for date range
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate.toISOString().split('T')[0]);
  if (endDate) queryParams.append('endDate', endDate.toISOString().split('T')[0]);

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      const baseUrl = import.meta.env.MODE === 'production'
        ? 'https://daan-darpan-backend.onrender.com'
        : '';
      return fetch(`${baseUrl}/api/dashboard?${queryParams.toString()}`, {
        credentials: 'include'
      }).then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      });
    },
    // Increase refetch intervals for fresher data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000 // Consider data stale after 30 seconds
  });

  // Dashboard only shows boli entries - dravya entries are completely separate
  const { data: entries } = useQuery<Entry[]>({
    queryKey: ['/api/entries'],
  });

  // Fetch expense entries for total expenses calculation (only for admin/operator)
  const { data: expenseEntries } = useQuery<any[]>({
    queryKey: ['/api/expense-entries', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => {
      const expenseParams = new URLSearchParams();
      if (startDate) expenseParams.append('startDate', startDate.toISOString().split('T')[0]);
      if (endDate) expenseParams.append('endDate', endDate.toISOString().split('T')[0]);
      return fetch(`/api/expense-entries?${expenseParams.toString()}`).then(res => res.json());
    },
    enabled: user?.role === 'admin' || user?.role === 'operator', // Only fetch for admin/operator
    retry: false, // Don't retry on 403 errors
  });

  // Calculate total expenses from expense entries within date range (only for admin/operator)
  const totalExpenses = (user?.role === 'admin' || user?.role === 'operator')
    ? (Array.isArray(expenseEntries) ? expenseEntries.reduce((sum, expense) => {
      const expenseDate = new Date(expense.expense_date);
      const isInRange = (!startDate || expenseDate >= startDate) && (!endDate || expenseDate <= endDate);
      return isInRange ? sum + expense.amount : sum;
    }, 0) : 0)
    : 0; // Viewers always get 0 for expenses

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="p-4 text-destructive">Error loading dashboard: {error.message}</div>;
  }

  const { summary, overallSummary, recentActivity } = data || {
    summary: {
      totalAmount: 0,
      receivedAmount: 0,
      pendingAmount: 0,
      pendingEntries: 0,
      partialEntries: 0,
      completedEntries: 0
    },
    overallSummary: {
      corpusValue: 0,
      totalReceived: 0,
      totalAdvancePayments: 0,
      totalExpenses: 0,
      totalReceivedOutstanding: 0,
      cashInBank: 0
    },
    recentActivity: []
  };

  return (
    <div className="flex-grow p-4">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-medium">Dashboard</h1>
          <div className="text-sm bg-primary text-white px-3 py-1 rounded-full hidden sm:block">
            {user?.role === 'admin' ? 'Admin View' : 'User View'}
          </div>
        </div>

        {/* Mobile-first date filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              dateFormat="yyyy-MM-dd"
              className="w-full sm:w-auto px-3 py-2 border border-neutral-300 rounded-md text-sm"
              placeholderText="Start date"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              dateFormat="yyyy-MM-dd"
              className="w-full sm:w-auto px-3 py-2 border border-neutral-300 rounded-md text-sm"
              placeholderText="End date"
            />
          </div>
          <Button
            onClick={() => {
              setStartDate(new Date(new Date().getFullYear(), 0, 1));
              setEndDate(new Date());
            }}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Overall Summary - Independent of filters */}
      {overallSummary && (
        <>
          <h2 className="text-lg font-medium mb-3">Overall Summary</h2>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-11 gap-4 lg:gap-2 items-center">
              <div className="text-center">
                <p className="text-sm text-neutral-600">Total Corpus as on 31st Jul'25</p>
                <p className="text-xl font-semibold text-blue-600">₹{(overallSummary?.corpusValue || 0).toLocaleString()}</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">+</p>
              </div>

              <div className="text-center">
                <p className="text-sm text-neutral-600">Total Received</p>
                <p className="text-xl font-semibold text-green-600">₹{(overallSummary?.totalReceived || 0).toLocaleString()}</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">+</p>
              </div>

              <div className="text-center">
                <p className="text-sm text-neutral-600">Total Advance Payments</p>
                <p className="text-xl font-semibold text-orange-600">₹{(overallSummary?.totalAdvancePayments || 0).toLocaleString()}</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">+</p>
              </div>

              <div className="text-center">
                <p className="text-sm text-neutral-600">Total Received Outstanding</p>
                <p className="text-xl font-semibold text-purple-600">₹{(overallSummary.totalReceivedOutstanding || 0).toLocaleString()}</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">-</p>
              </div>

              <div className="text-center">
                <p className="text-sm text-neutral-600">Total Expenses</p>
                <p className="text-xl font-semibold text-red-600">₹{(overallSummary?.totalExpenses || 0).toLocaleString()}</p>
              </div>

              <div className="text-center">
                <p className="text-2xl font-bold text-blue-700">=</p>
              </div>

              <div className="text-center bg-white rounded-lg p-3 border-2 border-blue-300 min-w-[140px]">
                <p className="text-sm text-neutral-600">Cash in Bank</p>
                <p className="text-xl font-bold text-blue-700">₹{(overallSummary?.cashInBank || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Boli Entry Receivables Summary - Filtered by date range */}
      <h2 className="text-lg font-medium mb-3">Boli Entry Receivables Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {/* Total Earnings */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs text-neutral-500">Total Earnings</p>
          <p className="text-base sm:text-lg font-medium">₹{summary?.totalAmount?.toLocaleString() || '0'}</p>
        </div>

        {/* Received Amount */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs text-neutral-500">Received</p>
          <p className="text-base sm:text-lg font-medium text-green-500">₹{summary?.receivedAmount?.toLocaleString() || '0'}</p>
        </div>

        {/* Pending Amount */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs text-neutral-500">Pending</p>
          <p className="text-base sm:text-lg font-medium text-destructive">₹{summary?.pendingAmount?.toLocaleString() || '0'}</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <p className="text-xs text-neutral-500">Total Expenses</p>
          <p className="text-base sm:text-lg font-medium text-red-500">₹{(totalExpenses || 0).toLocaleString()}</p>
        </div>

        {/* Total Advance Payments - Only show for admin/operator */}
        {(user?.role === 'admin' || user?.role === 'operator') && (
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs text-neutral-500">Total Advance Payments</p>
            <p className="text-base sm:text-lg font-medium text-orange-600">₹{(summary?.totalAdvancePayments || 0).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <h2 className="text-lg font-medium mb-3">Payment Status</h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        {/* Pending Entries */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center">
            <span className="material-icons text-destructive text-lg sm:text-xl">pending</span>
            <span className="text-base sm:text-lg font-medium">{summary?.pendingEntries || 0}</span>
          </div>
          <p className="text-xs text-neutral-500 mt-2">Pending</p>
        </div>

        {/* Partial Entries */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center">
            <span className="material-icons text-orange-500 text-lg sm:text-xl">sync</span>
            <span className="text-base sm:text-lg font-medium">{summary?.partialEntries || 0}</span>
          </div>
          <p className="text-xs text-neutral-500 mt-2">Partial</p>
        </div>

        {/* Completed Entries */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center">
            <span className="material-icons text-green-500 text-lg sm:text-xl">check_circle</span>
            <span className="text-base sm:text-lg font-medium">{summary?.completedEntries || 0}</span>
          </div>
          <p className="text-xs text-neutral-500 mt-2">Completed</p>
        </div>
      </div>

      {/* Daily Earnings Calendar */}
      <div className="mt-6">
        <DailyEarningsCalendar />
      </div>

      {/* Daily Payments Calendar */}
      <div className="mt-6">
        <DailyPaymentsCalendar />
      </div>

      {/* Recent Activity */}
      <div className="mt-6">
        <h2 className="text-lg font-medium mb-3">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div>
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No recent activity</div>
            ) : (
              recentActivity.map(entry => (
                <div key={entry.id} className="flex items-center p-3 border-b border-neutral-200">
                  <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center mr-3">
                    <span className="material-icons text-neutral-500">{getActivityIcon(entry.status)}</span>
                  </div>
                  <div className="flex-grow">
                    <div className="font-medium">{entry.description}</div>
                    <div className="text-sm text-neutral-500">
                      {entry.userName} - {new Date(entry.auctionDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className={`px-2 py-1 rounded-full text-white text-xs font-medium ${getStatusClass(entry.status)}`}>
                      {getStatusText(entry.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          {recentActivity && recentActivity.length > 0 && (
            <div className="p-3 text-center">
              <button onClick={() => setLocation('/entries')} className="text-primary font-medium text-sm">View All Activities</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
