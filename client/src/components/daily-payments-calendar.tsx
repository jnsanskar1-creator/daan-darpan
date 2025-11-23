import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DailyPaymentsData = {
  [date: string]: number;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number) => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

const getDaysInMonth = (month: number, year: number) => {
  if (month === 1 && isLeapYear(year)) return 29; // February in leap year
  return DAYS_IN_MONTH[month];
};

const formatAmount = (amount: number) => {
  // Amount is already in rupees, no need to divide by 100
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  } else {
    return amount.toString();
  }
};

export default function DailyPaymentsCalendar() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Generate year options (current year and 5 years back/forward)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = currentYear - 5; year <= currentYear + 5; year++) {
    yearOptions.push(year);
  }
  
  // Fetch daily payments data
  const { data: dailyPayments, isLoading } = useQuery<DailyPaymentsData>({
    queryKey: ['/api/daily-payments', selectedYear],
    queryFn: () => fetch(`/api/daily-payments?year=${selectedYear}`).then(res => res.json()),
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Payments Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">Loading payments data...</div>
        </CardContent>
      </Card>
    );
  }
  
  // Calculate monthly totals
  const monthlyTotals = Array(12).fill(0);
  if (dailyPayments) {
    Object.entries(dailyPayments).forEach(([dateStr, amount]) => {
      const date = new Date(dateStr);
      const month = date.getMonth();
      monthlyTotals[month] += amount;
    });
  }
  
  // Generate calendar grid
  const generateCalendar = () => {
    const calendar = [];
    
    for (let month = 0; month < 12; month++) {
      const row = [];
      const daysInMonth = getDaysInMonth(month, selectedYear);
      
      // Month name
      row.push(
        <div key={`month-${month}`} className="font-medium text-sm bg-blue-600 text-white p-2 text-center">
          {MONTHS[month]}
        </div>
      );
      
      // Days in month
      for (let day = 1; day <= 31; day++) {
        if (day <= daysInMonth) {
          const dateKey = `${selectedYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const amount = dailyPayments?.[dateKey] || 0;
          
          row.push(
            <div 
              key={`${month}-${day}`} 
              className={`p-1 text-xs text-center border border-neutral-200 min-h-[24px] flex items-center justify-center ${
                amount > 0 
                  ? 'bg-blue-100 text-blue-800 font-medium' 
                  : 'bg-neutral-50 text-neutral-400'
              }`}
              title={amount > 0 ? `₹${amount.toLocaleString()}` : 'No payments'}
            >
              {amount > 0 ? formatAmount(amount) : ''}
            </div>
          );
        } else {
          // Empty cell for days that don't exist in this month
          row.push(
            <div key={`${month}-${day}-empty`} className="p-1 text-xs bg-neutral-100 border border-neutral-200 min-h-[24px]">
            </div>
          );
        }
      }
      
      // Monthly total
      row.push(
        <div key={`total-${month}`} className="font-medium text-sm bg-orange-100 text-orange-800 p-1 text-center min-h-[24px] flex items-center justify-center">
          ₹{monthlyTotals[month].toLocaleString()}
        </div>
      );
      
      calendar.push(
        <div key={month} className="grid gap-0" style={{ gridTemplateColumns: 'repeat(33, minmax(0, 1fr))' }}>
          {row}
        </div>
      );
    }
    
    return calendar;
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Daily Payments Calendar</CardTitle>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Header row with day numbers */}
        <div className="mb-2 grid gap-0" style={{ gridTemplateColumns: 'repeat(33, minmax(0, 1fr))' }}>
          <div className="font-medium text-sm p-2 text-center bg-neutral-100">Month</div>
          {Array.from({ length: 31 }, (_, i) => (
            <div key={i + 1} className="font-medium text-xs p-1 text-center bg-neutral-100 border border-neutral-200">
              {i + 1}
            </div>
          ))}
          <div className="font-medium text-sm p-2 text-center bg-neutral-100">Total</div>
        </div>
        
        {/* Calendar grid */}
        <div className="space-y-0">
          {generateCalendar()}
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200"></div>
            <span>Payments received</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-neutral-50 border border-neutral-200"></div>
            <span>No payments</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}