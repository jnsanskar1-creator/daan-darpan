import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { DravyaHindiReceipt } from "@/components/dravya-hindi-receipt";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportDravyaEntries } from "@/lib/excel-export";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export default function DravyaEntries() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [occasionFilter, setOccasionFilter] = useState("all-occasions");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { data: dravyaEntries, isLoading, error } = useQuery<any[]>({
    queryKey: ['/api/dravya-entries'],
  });

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-500">
          <p>Error loading dravya entries: {error.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Get unique occasions from dravya entries
  const uniqueOccasions = Array.from(new Set((dravyaEntries || []).map(entry => entry.occasion).filter(Boolean)));

  // Apply filters
  const filteredEntries = useMemo(() => {
    return (dravyaEntries || []).filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user_mobile?.includes(searchTerm);
      
      const matchesOccasion = !occasionFilter || occasionFilter === "all-occasions" || 
        entry.occasion?.toLowerCase().includes(occasionFilter.toLowerCase());
      
      const entryDate = new Date(entry.entry_date);
      const matchesDateRange = (!startDate || entryDate >= startDate) && 
                              (!endDate || entryDate <= endDate);
      
      return matchesSearch && matchesOccasion && matchesDateRange;
    });
  }, [dravyaEntries, searchTerm, occasionFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearchTerm("");
    setOccasionFilter("all-occasions");
    setStartDate(null);
    setEndDate(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Dravya Entries</h1>
        <div className="flex gap-2">
          <Button 
            onClick={() => exportDravyaEntries(filteredEntries)}
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            📊 Export
          </Button>
          {(user?.role === 'operator' || user?.role === 'admin') && (
            <Button onClick={() => setLocation('/dravya-entry-form')}>
              Add Dravya Entry
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Search by name, description, or mobile"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Occasion</label>
              <Select value={occasionFilter || undefined} onValueChange={setOccasionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All occasions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-occasions">All occasions</SelectItem>
                  {uniqueOccasions.map((occasion) => (
                    <SelectItem key={occasion} value={occasion}>
                      {occasion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Actions</label>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 border border-input rounded-md"
                placeholderText="Select start date"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 border border-input rounded-md"
                placeholderText="Select end date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredEntries.length} of {(dravyaEntries || []).length} dravya entries
        </p>
      </div>

      {/* Entries Table/Cards */}
      {isMobile ? (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{entry.user_name}</h3>
                    <p className="text-sm text-muted-foreground">{entry.user_mobile}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div><strong>Description:</strong> {entry.description || 'N/A'}</div>
                  {entry.occasion && <div><strong>Occasion:</strong> {entry.occasion}</div>}
                  <div><strong>Date:</strong> {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : 'N/A'}</div>
                  <div><strong>Created by:</strong> {entry.created_by || 'system'}</div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <DravyaHindiReceipt 
                    entry={{
                      id: entry.id,
                      userId: entry.user_id,
                      userName: entry.user_name,
                      description: entry.description,
                      quantity: entry.quantity || 1,
                      createdAt: entry.entry_date,
                      userAddress: entry.user_address,
                      userMobile: entry.user_mobile
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Occasion</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.user_name}</TableCell>
                    <TableCell>{entry.user_mobile || 'N/A'}</TableCell>
                    <TableCell>{entry.description || 'N/A'}</TableCell>
                    <TableCell>{entry.occasion || 'N/A'}</TableCell>
                    <TableCell>{entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>{entry.created_by || 'system'}</TableCell>
                    <TableCell>
                      <DravyaHindiReceipt 
                        entry={{
                          id: entry.id,
                          userId: entry.user_id,
                          userName: entry.user_name,
                          description: entry.description,
                          quantity: entry.quantity || 1,
                          createdAt: entry.entry_date,
                          userAddress: entry.user_address,
                          userMobile: entry.user_mobile
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filteredEntries.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground">No dravya entries found.</p>
          {(user?.role === 'operator' || user?.role === 'admin') && (
            <Button onClick={() => setLocation('/dravya-entry-form')} className="mt-4">
              Add First Dravya Entry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}