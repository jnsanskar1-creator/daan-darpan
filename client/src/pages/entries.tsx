import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { type Entry, PaymentStatus, EntryType, PaymentRecord, recordPaymentSchema } from "@shared/schema";
import { HindiReceipt } from "@/components/hindi-receipt";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportBoliEntries } from "@/lib/excel-export";
// Create a simplified media query hook inline since the import is failing
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

const getStatusClass = (status: string) => {
  switch (status) {
    case PaymentStatus.PENDING: return 'bg-destructive';
    case PaymentStatus.PARTIAL: return 'bg-orange-500';
    case PaymentStatus.FULL: return 'bg-green-500';
    default: return 'bg-neutral-500';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case PaymentStatus.PENDING: return 'Payment Pending';
    case PaymentStatus.PARTIAL: return 'Partially Paid';
    case PaymentStatus.FULL: return 'Fully Paid';
    default: return 'Unknown';
  }
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Function to send WhatsApp reminder
const sendWhatsAppReminder = (entry: Entry) => {
  // Clean phone number (remove spaces, dashes, parentheses)
  const cleanNumber = entry.userMobile?.replace(/[\s\-\(\)]/g, '');

  if (!cleanNumber) {
    alert('No phone number available for this user');
    return;
  }

  // Format phone number for WhatsApp (ensure it starts with country code)
  let formattedNumber = cleanNumber;
  if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
    formattedNumber = '91' + formattedNumber; // Add India country code
  }

  // Create reminder message with simple text markers
  const message =
    `शिवनगर जैन मंदिर के अग्रणी सदस्य आपको सौम्य याद दिलाने हेतु संदेश प्रेषित है:\n\n` +
    `📝 विवरण: ${entry.description}\n` +
    `🗓️ बोली दिनांक: ${formatDate(entry.auctionDate)}\n` +
    `💰 कुल राशि: ₹${entry.totalAmount.toLocaleString()}\n` +
    `✅ प्राप्त: ₹${entry.receivedAmount.toLocaleString()}\n` +
    `⏳ शेष: ₹${entry.pendingAmount.toLocaleString()}\n\n` +
    `कृपया मंदिर व्यवस्था हेतु संकल्पित राशि जमा कर पुण्य लाभ संचित करें।\n\n` +
    `आपके सहयोग के लिए धन्यवाद! 🙏`;

  // Create WhatsApp URL using different encoding approach
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;

  // Open WhatsApp in new tab/window
  window.open(whatsappUrl, '_blank');
};

// Function to handle bulk WhatsApp reminders
const sendBulkWhatsAppReminders = (entries: Entry[], selectedIds: number[]) => {
  const selectedEntries = entries.filter(entry => selectedIds.includes(entry.id));
  const validEntries = selectedEntries.filter(entry => entry.userMobile && entry.pendingAmount > 0);

  if (validEntries.length === 0) {
    alert('No valid entries selected for WhatsApp reminders. Entries must have mobile numbers and pending amounts.');
    return;
  }

  // Send reminders with a small delay between each
  validEntries.forEach((entry, index) => {
    setTimeout(() => {
      sendWhatsAppReminder(entry);
    }, index * 500); // 500ms delay between each message
  });

  alert(`WhatsApp reminders will be sent to ${validEntries.length} recipients.`);
};

export default function Entries() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("serial-desc");
  const [boliDateRange, setBoliDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [updatedAtRange, setUpdatedAtRange] = useState<[Date | null, Date | null]>([null, null]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [hindiReceiptState, setHindiReceiptState] = useState<{
    isOpen: boolean;
    entry: Entry | null;
    payment: PaymentRecord | null;
    paymentIndex: number;
  }>({
    isOpen: false,
    entry: null,
    payment: null,
    paymentIndex: -1
  });
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("active");

  const { data: entries, isLoading } = useQuery<Entry[]>({
    queryKey: ['/api/entries'],
    // Increase refetch intervals for fresher data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to ensure fresh updates
    gcTime: 0 // Don't cache old data in memory
  });

  // Query for deleted entries (admin only)
  const { data: deletedEntries, isLoading: isLoadingDeleted } = useQuery<any[]>({
    queryKey: ['/api/entries/deleted'],
    enabled: user?.role === 'admin' && activeTab === 'deleted',
    refetchOnMount: true,
    staleTime: 0
  });

  // Function to handle entry restoration (admin only)
  const handleRestoreEntry = async (entryId: number, description: string) => {
    // Double-check admin role before allowing restore
    if (user?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "Only administrators can restore deleted entries.",
        variant: "destructive"
      });
      return;
    }

    if (confirm(`Are you sure you want to restore entry "${description}"?`)) {
      try {
        await apiRequest('PUT', `/api/entries/${entryId}/restore`);
        toast({
          title: "Entry Restored",
          description: "The entry has been successfully restored."
        });
        queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/entries/deleted'] });
      } catch (error) {
        console.error("Error restoring entry:", error);
        toast({
          title: "Restore Failed",
          description: "There was a problem restoring the entry. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Function to handle entry deletion
  const handleDeleteEntry = async (entry: Entry) => {
    if (confirm(`Are you sure you want to delete entry "${entry.description}"? This action cannot be undone.`)) {
      try {
        await apiRequest('DELETE', `/api/entries/${entry.id}`);
        toast({
          title: "Entry Deleted",
          description: "The entry has been successfully deleted and logged as a transaction."
        });
        queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      } catch (error) {
        console.error("Error deleting entry:", error);
        toast({
          title: "Delete Failed",
          description: "There was a problem deleting the entry. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Filter only Boli entries (all entries in this system are boli entries)
  // Serial numbers come directly from the database and should never be recalculated
  const boliEntries = useMemo(() => {
    if (!entries) return [];

    // Return entries as-is - serialNumber comes from database and is permanent
    return entries;
  }, [entries]);

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    if (!boliEntries) return [];

    // First apply filters
    let filtered = boliEntries.filter(entry => {
      // Apply text search independently
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === "" ||
        entry.description.toLowerCase().includes(searchLower) ||
        entry.userName.toLowerCase().includes(searchLower) ||
        entry.occasion.toLowerCase().includes(searchLower) ||
        (entry.userMobile && entry.userMobile.toLowerCase().includes(searchLower)) ||
        (entry.userAddress && entry.userAddress.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // Apply status filter independently
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      if (!matchesStatus) return false;

      // Apply boli date range filter independently
      if (boliDateRange[0] || boliDateRange[1]) {
        const entryDate = new Date(entry.auctionDate);

        if (boliDateRange[0]) {
          // Start date is set, check if entry date is on or after it
          const startDate = new Date(boliDateRange[0]);
          startDate.setHours(0, 0, 0, 0);
          if (entryDate < startDate) {
            return false;
          }
        }

        if (boliDateRange[1]) {
          // End date is set, check if entry date is on or before it
          const endDate = new Date(boliDateRange[1]);
          // Set to end of day to include the full day
          endDate.setHours(23, 59, 59, 999);
          if (entryDate > endDate) {
            return false;
          }
        }
      }

      // Apply updated at range filter independently
      if (updatedAtRange[0] || updatedAtRange[1]) {
        // If entry doesn't have updatedAt, filter it out if filtering by updated date
        if (!entry.updatedAt) {
          return false;
        }

        const entryUpdateDate = new Date(entry.updatedAt);

        if (updatedAtRange[0]) {
          // Start date is set, check if entry date is on or after it
          const startDate = new Date(updatedAtRange[0]);
          startDate.setHours(0, 0, 0, 0);
          if (entryUpdateDate < startDate) {
            return false;
          }
        }

        if (updatedAtRange[1]) {
          // End date is set, check if entry date is on or before it
          const endDate = new Date(updatedAtRange[1]);
          // Set to end of day to include the full day
          endDate.setHours(23, 59, 59, 999);
          if (entryUpdateDate > endDate) {
            return false;
          }
        }
      }

      // If it passes all filters, include it
      return true;
    });

    // Then sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "serial-asc":
          return (a as any).serialNumber - (b as any).serialNumber;
        case "serial-desc":
          return (b as any).serialNumber - (a as any).serialNumber;
        case "date-asc":
          return new Date(a.auctionDate).getTime() - new Date(b.auctionDate).getTime();
        case "date-desc":
          return new Date(b.auctionDate).getTime() - new Date(a.auctionDate).getTime();
        case "amount-asc":
          return a.totalAmount - b.totalAmount;
        case "amount-desc":
          return b.totalAmount - a.totalAmount;
        case "name-asc":
          return a.userName.localeCompare(b.userName);
        case "name-desc":
          return b.userName.localeCompare(a.userName);
        default:
          return (b as any).serialNumber - (a as any).serialNumber; // Default to serial desc
      }
    });
  }, [entries, searchTerm, statusFilter, sortBy, boliDateRange, updatedAtRange]);

  const handleViewDetails = (entryId: number) => {
    setLocation(`/entries/${entryId}`);
  };

  // Bulk selection functions
  const handleSelectEntry = (entryId: number) => {
    setSelectedEntries(prev => {
      const newSelection = prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId];
      setShowBulkActions(newSelection.length > 0);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    const eligibleEntries = filteredAndSortedEntries.filter(entry => entry.userMobile && entry.pendingAmount > 0);
    const allEligibleIds = eligibleEntries.map(entry => entry.id);

    if (selectedEntries.length === allEligibleIds.length) {
      // Deselect all
      setSelectedEntries([]);
      setShowBulkActions(false);
    } else {
      // Select all eligible
      setSelectedEntries(allEligibleIds);
      setShowBulkActions(allEligibleIds.length > 0);
    }
  };

  const handleBulkWhatsAppReminder = () => {
    if (selectedEntries.length === 0) return;

    if (confirm(`Send WhatsApp reminders to ${selectedEntries.length} selected entries?`)) {
      sendBulkWhatsAppReminders(filteredAndSortedEntries, selectedEntries);
      setSelectedEntries([]);
      setShowBulkActions(false);
    }
  };

  // Reset search when navigating away
  useEffect(() => {
    return () => {
      setSearchTerm("");
      setStatusFilter("all");
      setSortBy("serial-desc");
    };
  }, []);

  // Mobile card view for each entry
  const EntryCard = ({ entry }: { entry: Entry }) => (
    <Card key={entry.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1">
            {/* Checkbox for bulk selection */}
            {entry.userMobile && entry.pendingAmount > 0 && (
              <input
                type="checkbox"
                checked={selectedEntries.includes(entry.id)}
                onChange={() => handleSelectEntry(entry.id)}
                className="mt-1 w-4 h-4 text-green-600 border-neutral-300 rounded focus:ring-green-500"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">#{(entry as any).serialNumber}</span>
                <h3 className="font-medium text-lg">{entry.description}</h3>
              </div>
              <p className="text-sm text-neutral-500">{entry.userName}</p>
              {entry.userMobile && (
                <p className="text-xs text-neutral-500">📱 {entry.userMobile}</p>
              )}
            </div>
          </div>
          <Badge className={getStatusClass(entry.status)}>
            {getStatusText(entry.status)}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 my-3 text-sm">
          <div>
            <p className="text-neutral-500">Amount:</p>
            <p>₹{(entry.amount || 0).toLocaleString()} × {entry.quantity || 0}</p>
          </div>
          <div>
            <p className="text-neutral-500">Total:</p>
            <p>₹{(entry.totalAmount || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-neutral-500">Occasion:</p>
            <p>{entry.occasion}</p>
          </div>
          <div>
            <p className="text-neutral-500">Boli Date:</p>
            <p>{formatDate(entry.auctionDate)}</p>
          </div>
        </div>
        {entry.userAddress && (
          <div className="text-xs text-neutral-600 mt-1 mb-2">
            <span className="text-neutral-500">📍 Address:</span> {entry.userAddress}
          </div>
        )}
        {entry.updatedAt && (
          <div className="text-xs text-neutral-600 mt-1">
            <span className="text-neutral-500">Updated:</span> {formatDate(entry.updatedAt)}
          </div>
        )}
        <div className="mt-4 pt-2 border-t border-neutral-200">
          <div className="flex justify-between text-sm mb-3">
            <div>
              <span className="text-neutral-500">Received:</span>
              <span className="text-green-500 font-medium ml-1">₹{(entry.receivedAmount || 0).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-neutral-500">Pending:</span>
              <span className="text-destructive font-medium ml-1">₹{(entry.pendingAmount || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Edit Button - visible to admin and operator */}
            {user && (user.role === 'admin' || user.role === 'operator') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/entries/${entry.id}/edit`)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                data-testid={`button-edit-${entry.id}`}
              >
                <span className="material-icons text-sm">edit</span>
                Edit
              </Button>
            )}

            {/* Delete Button - visible to admin only */}
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteEntry(entry)}
                className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                data-testid={`button-delete-${entry.id}`}
              >
                <span className="material-icons text-sm">delete</span>
                Delete
              </Button>
            )}

            {/* WhatsApp Button */}
            {entry.userMobile && entry.pendingAmount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 border-green-200 hover:bg-green-50 flex items-center gap-1"
                onClick={() => sendWhatsAppReminder(entry)}
                title="Send WhatsApp Reminder"
              >
                <span className="material-icons text-sm">chat</span>
                WhatsApp
              </Button>
            )}

            {/* View Details Button */}
            <Button
              variant="link"
              className="text-primary font-medium p-0 ml-auto"
              onClick={() => handleViewDetails(entry.id)}
            >
              View Details →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex-grow p-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full mb-6" />
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="mb-4">
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-grow p-4 pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Header with title and buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium">Boli Entries</h1>

            {/* Tabs list - show Deleted tab only for admin */}
            <TabsList>
              <TabsTrigger value="active" data-testid="tab-active-entries">
                Active
              </TabsTrigger>
              {user?.role === 'admin' && (
                <TabsTrigger value="deleted" data-testid="tab-deleted-entries">
                  Deleted
                </TabsTrigger>
              )}
            </TabsList>

            {/* Bulk actions buttons - only on active tab */}
            {activeTab === 'active' && showBulkActions && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">
                  {selectedEntries.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={handleBulkWhatsAppReminder}
                >
                  <span className="material-icons text-sm mr-1">chat</span>
                  Bulk WhatsApp
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center w-full sm:w-auto gap-2">
            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportBoliEntries(filteredAndSortedEntries)}
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 rounded-full shadow-sm flex gap-2 items-center"
            >
              <span className="text-sm">📊</span>
              <span>Export</span>
            </Button>

            {/* Past Records Button */}
            {user && (user.role === 'admin' || user.role === 'operator') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/previous-outstanding/new')}
                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 rounded-full shadow-sm flex gap-2 items-center"
              >
                <span className="text-sm">📝</span>
                <span>Past Records</span>
              </Button>
            )}

            {/* Mobile: Filter Dialog */}
            {isMobile ? (
              <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white shadow-sm flex gap-2 items-center"
                  >
                    <span className="material-icons text-neutral-500 text-sm">filter_list</span>
                    <span>Filter & Sort</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter & Sort Entries</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Boli Date Range</label>
                      <div className="datepicker-container w-full">
                        <DatePicker
                          selectsRange={true}
                          startDate={boliDateRange[0]}
                          endDate={boliDateRange[1]}
                          onChange={(update) => {
                            setBoliDateRange(update);
                          }}
                          isClearable={true}
                          placeholderText="Select date range"
                          className="w-full border rounded-md p-2 text-sm"
                          dateFormat="MMM d, yyyy"
                          calendarClassName="calendar-popup"
                          monthsShown={2}
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          renderMonthContent={(month, shortMonth) => (
                            <div>{shortMonth}</div>
                          )}
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

                    <div>
                      <label className="text-sm font-medium mb-2 block">Last Updated Range</label>
                      <div className="datepicker-container w-full">
                        <DatePicker
                          selectsRange={true}
                          startDate={updatedAtRange[0]}
                          endDate={updatedAtRange[1]}
                          onChange={(update) => {
                            setUpdatedAtRange(update);
                          }}
                          isClearable={true}
                          placeholderText="Select date range"
                          className="w-full border rounded-md p-2 text-sm"
                          dateFormat="MMM d, yyyy"
                          calendarClassName="calendar-popup"
                          monthsShown={2}
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
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

                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value={PaymentStatus.PENDING}>Payment Pending</SelectItem>
                          <SelectItem value={PaymentStatus.PARTIAL}>Partially Paid</SelectItem>
                          <SelectItem value={PaymentStatus.FULL}>Fully Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Sort By</label>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sort entries" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date-desc">Boli Date (Newest First)</SelectItem>
                          <SelectItem value="date-asc">Boli Date (Oldest First)</SelectItem>
                          <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                          <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                          <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                          <SelectItem value="name-desc">Name (Z to A)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              /* Desktop: Inline filters */
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-sm whitespace-nowrap mb-1 block">Boli Date Range</label>
                  <div className="datepicker-container w-full">
                    <DatePicker
                      selectsRange={true}
                      startDate={boliDateRange[0]}
                      endDate={boliDateRange[1]}
                      onChange={(update) => {
                        setBoliDateRange(update);
                      }}
                      isClearable={true}
                      placeholderText="Select date range"
                      className="w-full border rounded-md p-2 text-sm"
                      dateFormat="MMM d, yyyy"
                      monthsShown={2}
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
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

                <div>
                  <label className="text-sm whitespace-nowrap mb-1 block">Updated Date Range</label>
                  <div className="datepicker-container w-full">
                    <DatePicker
                      selectsRange={true}
                      startDate={updatedAtRange[0]}
                      endDate={updatedAtRange[1]}
                      onChange={(update) => {
                        setUpdatedAtRange(update);
                      }}
                      isClearable={true}
                      placeholderText="Select date range"
                      className="w-full border rounded-md p-2 text-sm"
                      dateFormat="MMM d, yyyy"
                      monthsShown={2}
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value={PaymentStatus.PENDING}>Payment Pending</SelectItem>
                    <SelectItem value={PaymentStatus.PARTIAL}>Partially Paid</SelectItem>
                    <SelectItem value={PaymentStatus.FULL}>Fully Paid</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serial-desc">Serial No. (Latest First)</SelectItem>
                    <SelectItem value="serial-asc">Serial No. (Oldest First)</SelectItem>
                    <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                    <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                    <SelectItem value="amount-desc">Amount (High to Low)</SelectItem>
                    <SelectItem value="amount-asc">Amount (Low to High)</SelectItem>
                    <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z to A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Active Entries Tab Content */}
        <TabsContent value="active" className="mt-0">

          {/* Search Bar and Select All */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-icons text-neutral-500 text-lg">search</span>
              </span>
              <Input
                type="text"
                placeholder="Search by name, description, or occasion"
                className="w-full pl-10 pr-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Select All button */}
            {filteredAndSortedEntries.filter(entry => entry.userMobile && entry.pendingAmount > 0).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="whitespace-nowrap"
              >
                {selectedEntries.length === filteredAndSortedEntries.filter(entry => entry.userMobile && entry.pendingAmount > 0).length
                  ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>

          {/* Empty state */}
          {(!filteredAndSortedEntries || filteredAndSortedEntries.length === 0) && (
            <div className="text-center py-12 text-neutral-500">
              <span className="material-icons text-5xl mb-2">search_off</span>
              <p className="text-lg font-medium">No entries found</p>
              <p className="text-sm">Try adjusting your search filters</p>
            </div>
          )}

          {/* Mobile view: Card layout */}
          {isMobile && filteredAndSortedEntries.length > 0 && (
            <div>
              {filteredAndSortedEntries.map(entry => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}

          {/* Desktop view: Table layout */}
          {!isMobile && filteredAndSortedEntries.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedEntries.length === filteredAndSortedEntries.filter(entry => entry.userMobile && entry.pendingAmount > 0).length && selectedEntries.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-green-600 border-neutral-300 rounded focus:ring-green-500"
                      />
                    </TableHead>
                    <TableHead className="w-16">Serial</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden lg:table-cell">Mobile</TableHead>
                    <TableHead className="hidden xl:table-cell">Address</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden md:table-cell">Occasion</TableHead>
                    <TableHead className="hidden sm:table-cell">बेदी क्रमांक</TableHead>
                    <TableHead className="hidden md:table-cell">Boli Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Updated At</TableHead>
                    <TableHead>Submitted DateTime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedEntries.map(entry => (
                    <TableRow key={entry.id} className="hover:bg-neutral-50">
                      <TableCell>
                        {entry.userMobile && entry.pendingAmount > 0 ? (
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(entry.id)}
                            onChange={() => handleSelectEntry(entry.id)}
                            className="w-4 h-4 text-green-600 border-neutral-300 rounded focus:ring-green-500"
                          />
                        ) : (
                          <span className="w-4 h-4 inline-block"></span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600">{entry.serialNumber}</TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>
                        <div className="font-medium">{entry.userName}</div>
                        <div className="text-xs text-neutral-500">{entry.userMobile || "-"}</div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{entry.userMobile || "-"}</TableCell>
                      <TableCell className="hidden xl:table-cell">{entry.userAddress || "-"}</TableCell>
                      <TableCell>
                        <div>₹{(entry.totalAmount || 0).toLocaleString()}</div>
                        <div className="text-xs text-neutral-500">
                          <span className="text-green-500">₹{(entry.receivedAmount || 0).toLocaleString()}</span>
                          {(entry.pendingAmount || 0) > 0 && (
                            <> / <span className="text-destructive">₹{(entry.pendingAmount || 0).toLocaleString()}</span></>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{entry.occasion}</TableCell>
                      <TableCell className="hidden sm:table-cell">{entry.bediNumber}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(entry.auctionDate)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{entry.updatedAt ? formatDate(entry.updatedAt) : "-"}</TableCell>
                      <TableCell className="text-sm text-neutral-600">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusClass(entry.status)}>
                          {getStatusText(entry.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center space-x-1">
                          {entry.userMobile && entry.pendingAmount > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => sendWhatsAppReminder(entry)}
                              title="Send WhatsApp Reminder"
                            >
                              <span className="material-icons text-sm mr-1">chat</span>
                              WhatsApp
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(entry.id)}
                          >
                            View
                          </Button>

                          {/* Edit controls for both operators and admins */}
                          {(user?.role === 'admin' || user?.role === 'operator') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/entries/${entry.id}/edit`)}
                              className="text-blue-600"
                            >
                              <span className="material-icons text-sm mr-1">edit</span>
                              Edit
                            </Button>
                          )}

                          {/* Admin-only controls for deleting entries */}
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => handleDeleteEntry(entry)}
                            >
                              <span className="material-icons text-sm">delete</span>
                              <span className="sr-only">Delete</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Deleted Entries Tab Content */}
        <TabsContent value="deleted" className="mt-0">
          <div className="mb-6">
            <p className="text-sm text-neutral-600">View and restore deleted boli entries.</p>
          </div>

          {isLoadingDeleted ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : (!deletedEntries || deletedEntries.length === 0) ? (
            <div className="text-center py-12 text-neutral-500">
              <span className="material-icons text-5xl mb-2">delete_outline</span>
              <p className="text-lg font-medium">No deleted entries</p>
              <p className="text-sm">All your deleted entries will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deletedEntries.map((entry: any) => (
                <Card key={entry.id} className="bg-neutral-50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{entry.description}</h3>
                        <p className="text-sm text-neutral-600">User: {entry.user_name}</p>
                        <p className="text-sm text-neutral-600">Amount: ₹{entry.total_amount?.toLocaleString()}</p>
                        <p className="text-sm text-neutral-600">Boli Date: {formatDate(entry.auction_date)}</p>
                        <p className="text-sm text-neutral-500">Deleted entry</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreEntry(entry.id, entry.description)}
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          data-testid={`button-restore-${entry.id}`}
                        >
                          <span className="material-icons text-sm mr-1">restore</span>
                          Restore
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
