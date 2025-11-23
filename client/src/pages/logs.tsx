import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TransactionType, type TransactionLog } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Define interface for the transaction log with details typed
interface EnhancedTransactionLog extends TransactionLog {
  details: Record<string, any>;
}
import DatePicker from "react-datepicker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import "react-datepicker/dist/react-datepicker.css";

// Helper function to format dates from ISO string to readable format
const formatDate = (isoString: string) => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString();
};

export default function TransactionLogs() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filterByType, setFilterByType] = useState("");
  
  // Fetch all transaction logs
  const { data: logs, isLoading } = useQuery<EnhancedTransactionLog[]>({
    queryKey: ['/api/transaction-logs'],
    // Only enable this query for admins
    enabled: user?.role === 'admin',
  });
  
  // Apply filters
  const filteredLogs = logs?.filter(log => {
    // Search filter (case insensitive)
    const searchMatches = !searchQuery || 
      log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.username?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date range filter
    let dateMatches = true;
    if (dateRange[0] || dateRange[1]) {
      const logDate = new Date(log.date);
      
      if (dateRange[0]) {
        // Start date is set, check if log date is on or after it
        const startDate = new Date(dateRange[0]);
        startDate.setHours(0, 0, 0, 0);
        if (logDate < startDate) {
          dateMatches = false;
        }
      }
      
      if (dateRange[1]) {
        // End date is set, check if log date is on or before it
        const endDate = new Date(dateRange[1]);
        // Set to end of day to include the full day
        endDate.setHours(23, 59, 59, 999);
        if (logDate > endDate) {
          dateMatches = false;
        }
      }
    }
    
    // Transaction type filter
    const typeMatches = !filterByType || filterByType === 'all' || log.transactionType === filterByType;
    
    return searchMatches && dateMatches && typeMatches;
  }) || [];
  
  // Sort logs by timestamp (most recent first)
  const sortedLogs = [...filteredLogs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Calculate total balance
  const totalCredits = logs?.reduce((sum, log) => 
    log.transactionType === TransactionType.CREDIT ? sum + log.amount : sum, 0) || 0;
    
  const totalDebits = logs?.reduce((sum, log) => 
    log.transactionType === TransactionType.DEBIT ? sum + log.amount : sum, 0) || 0;
    
  // Calculate updates (might be positive or negative)
  const totalUpdates = logs?.reduce((sum, log) => 
    (log.transactionType === TransactionType.UPDATE_PAYMENT || 
     log.transactionType === TransactionType.UPDATE_ENTRY) 
      ? sum + log.amount : sum, 0) || 0;
    
  const balance = totalCredits - totalDebits + totalUpdates;

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading transaction logs...</div>;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex-grow flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-xl font-medium mb-2">Access Denied</h1>
          <p className="text-neutral-500">You don't have permission to view transaction logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium">Transaction Logs</h1>
        <p className="text-sm text-neutral-500">Track all debit and credit activities</p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-neutral-500 mb-1">Total Credits</h3>
            <div className="text-2xl font-bold text-green-500">₹{totalCredits.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-neutral-500 mb-1">Total Debits</h3>
            <div className="text-2xl font-bold text-red-500">₹{totalDebits.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-neutral-500 mb-1">Current Balance</h3>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ₹{balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <Label htmlFor="search" className="mb-1 block">Search</Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-icons text-neutral-500 text-lg">search</span>
              </span>
              <Input 
                id="search"
                placeholder="Search by description or user" 
                className="pl-10 pr-4 py-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Date Range Filter */}
          <div>
            <Label htmlFor="dateFilter" className="mb-1 block">Date Range</Label>
            <div className="datepicker-container w-full">
              <DatePicker
                selectsRange={true}
                startDate={dateRange[0]}
                endDate={dateRange[1]}
                onChange={(update) => {
                  setDateRange(update);
                }}
                isClearable={true}
                placeholderText="Select date range"
                className="w-full border rounded-md p-2 text-sm"
                dateFormat="MMM d, yyyy"
                showMonthYearPicker={false}
                calendarStartDay={1}
                fixedHeight
                calendarClassName="custom-datepicker"
                monthsShown={2}
                onCalendarOpen={() => {
                  // This forces the second month to be next month
                  setTimeout(() => {
                    const calendars = document.querySelectorAll('.react-datepicker__month-container');
                    if (calendars.length > 1) {
                      const secondCalendar = calendars[1];
                      const monthHeader = secondCalendar.querySelector('.react-datepicker__current-month');
                      if (monthHeader) {
                        // Get current date and create next month
                        const currentDate = new Date();
                        const nextMonth = new Date(currentDate);
                        nextMonth.setMonth(currentDate.getMonth() + 1);
                        // Set text to "June 2025"
                        monthHeader.textContent = nextMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                      }
                    }
                  }, 0);
                }}
                renderMonthContent={(month, shortMonth) => <div>{shortMonth}</div>}
                renderCustomHeader={({
                  date,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
                }) => (
                  <div className="flex items-center justify-between px-2 py-2">
                    <button
                      onClick={decreaseMonth}
                      disabled={prevMonthButtonDisabled}
                      type="button"
                      className="p-1 rounded-full hover:bg-neutral-100"
                    >
                      <span className="material-icons">chevron_left</span>
                    </button>
                    <div className="text-lg font-medium">
                      {date.toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      type="button"
                      className="p-1 rounded-full hover:bg-neutral-100"
                    >
                      <span className="material-icons">chevron_right</span>
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
          
          {/* Transaction Type Filter */}
          <div>
            <Label htmlFor="typeFilter" className="mb-1 block">Transaction Type</Label>
            <Select
              value={filterByType}
              onValueChange={setFilterByType}
            >
              <SelectTrigger id="typeFilter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value={TransactionType.CREDIT}>Credit</SelectItem>
                <SelectItem value={TransactionType.DEBIT}>Debit</SelectItem>
                <SelectItem value={TransactionType.UPDATE_PAYMENT}>Payment Update</SelectItem>
                <SelectItem value={TransactionType.UPDATE_ENTRY}>Entry Update</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Transaction logs table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                  No transaction logs found
                </TableCell>
              </TableRow>
            ) : (
              sortedLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-neutral-50">
                  <TableCell>{formatDate(log.date)}</TableCell>
                  <TableCell>{log.username}</TableCell>
                  <TableCell>
                    <Badge className={
                      log.transactionType === TransactionType.CREDIT ? "bg-green-500 text-white" : 
                      log.transactionType === TransactionType.DEBIT ? "bg-red-500 text-white" :
                      log.transactionType === TransactionType.UPDATE_PAYMENT ? "bg-blue-500 text-white" :
                      "bg-amber-500 text-white"
                    }>
                      {log.transactionType.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-medium ${
                    log.transactionType === TransactionType.CREDIT ? 'text-green-500' : 
                    log.transactionType === TransactionType.DEBIT ? 'text-red-500' :
                    log.transactionType === TransactionType.UPDATE_PAYMENT ? 'text-blue-500' :
                    'text-amber-500'
                  }`}>
                    ₹{log.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transaction Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Transaction Type</h3>
                            <p className="font-medium">{log.transactionType}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Amount</h3>
                            <p className={`font-medium ${log.transactionType === TransactionType.CREDIT ? 'text-green-500' : 'text-red-500'}`}>
                              ₹{log.amount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Description</h3>
                            <p className="font-medium">{log.description}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">User</h3>
                            <p className="font-medium">{log.username}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Date</h3>
                            <p className="font-medium">{formatDate(log.date)}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Timestamp</h3>
                            <p className="font-medium">{new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-neutral-500">Entry ID</h3>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto"
                              onClick={() => {
                                setLocation(`/entries/${log.entryId}`);
                              }}
                            >
                              View Entry #{log.entryId}
                            </Button>
                          </div>
                          <div>
                              <h3 className="text-sm font-medium text-neutral-500">Additional Details</h3>
                              <pre className="text-xs bg-neutral-50 p-2 rounded mt-1 overflow-auto max-h-40">
                                {log.details ? JSON.stringify(log.details, null, 2) : "No additional details"}
                              </pre>
                            </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}