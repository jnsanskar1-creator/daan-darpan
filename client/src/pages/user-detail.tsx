import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Wallet, Receipt, DollarSign, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { HindiReceipt } from "@/components/hindi-receipt";
import { PreviousOutstandingSection } from "@/components/previous-outstanding-section";
import type { User as UserType, Entry, AdvancePayment, DravyaEntry, PaymentRecord } from "@shared/schema";

export default function UserDetail() {
  const [, params] = useRoute("/users/:id");
  const [, myAccountParams] = useRoute("/my-account");
  const { user: currentUser } = useAuth();
  
  // If accessing /my-account, use current user's ID
  const userId = myAccountParams ? currentUser?.id : (params?.id ? parseInt(params.id) : null);
  
  // State for receipt dialog
  const [selectedReceiptData, setSelectedReceiptData] = useState<{
    entry: Entry;
    payment: PaymentRecord;
    paymentIndex: number;
  } | null>(null);



  // Fetch user details
  const { data: user, isLoading: userLoading } = useQuery<UserType>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  // Fetch user's boli entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: [`/api/entries?userId=${userId}`],
    enabled: !!userId,
  });

  // Fetch user's advance payments
  const { data: advancePayments = [], isLoading: advanceLoading } = useQuery<AdvancePayment[]>({
    queryKey: [`/api/advance-payments?userId=${userId}`],
    enabled: !!userId,
    staleTime: 0, // Always refetch to show latest data
    gcTime: 0, // Don't cache
  });

  // Fetch user's dravya entries
  const { data: dravyaEntries = [], isLoading: dravyaLoading } = useQuery<DravyaEntry[]>({
    queryKey: [`/api/dravya-entries?userId=${userId}`],
    enabled: !!userId,
  });

  // Get advance payment balance from server calculation
  const { data: serverAdvanceBalance = 0 } = useQuery<number>({
    queryKey: [`/api/users/${userId}/advance-balance`],
    enabled: !!userId,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
  });

  // Use server-calculated balance as the source of truth
  const totalAdvancePayments = serverAdvanceBalance;

  // Fetch user's previous outstanding records
  const { data: previousOutstandingRecords = [] } = useQuery<any[]>({
    queryKey: [`/api/previous-outstanding?userId=${userId}`],
    enabled: !!userId,
    staleTime: 0, // Always refetch to show latest data
    gcTime: 0, // Don't cache
  });

  // Calculate totals for previous outstanding records
  const totalPreviousOutstanding = previousOutstandingRecords.reduce(
    (sum, record) => sum + (record.outstandingAmount || 0),
    0
  );
  
  const totalReceivedOutstanding = previousOutstandingRecords.reduce(
    (sum, record) => sum + (record.receivedAmount || 0),
    0
  );
  
  const totalPendingOutstanding = previousOutstandingRecords.reduce(
    (sum, record) => sum + (record.pendingAmount ?? 0),
    0
  );



  if (!userId) {
    return <div>Invalid user ID</div>;
  }

  if (userLoading) {
    return <div className="p-4">Loading user details...</div>;
  }

  if (!user) {
    return <div className="p-4">User not found</div>;
  }

  // Calculate summary statistics
  const totalBoliAmount = entries.reduce((sum, entry) => sum + entry.totalAmount, 0);
  const totalReceived = entries.reduce((sum, entry) => sum + entry.receivedAmount, 0);
  const totalPending = entries.reduce((sum, entry) => sum + entry.pendingAmount, 0);
  const totalDravyaEntries = dravyaEntries.length;

  // Get all payments from entries
  const allPayments = entries.flatMap(entry => {
    if (entry.payments && Array.isArray(entry.payments)) {
      return entry.payments.map(payment => ({
        ...payment,
        entryId: entry.id,
        entryDescription: entry.description,
        entryOccasion: entry.occasion,
        entryBoliDate: entry.auctionDate,
        userName: entry.userName,
      }));
    }
    return [];
  });

  // Get all payments from previous outstanding records
  const allOutstandingPayments = previousOutstandingRecords.flatMap(record => {
    if (record.payments && Array.isArray(record.payments)) {
      return record.payments.map((payment: any) => ({
        ...payment,
        recordId: record.id,
        recordDescription: record.description,
        recordNumber: record.recordNumber,
      }));
    }
    return [];
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'full': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'full': return 'Fully Paid';
      case 'partial': return 'Partially Paid';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {/* Hide "Back to Users" button for viewer role or when viewing own account */}
        {currentUser?.role !== 'viewer' && !myAccountParams && (
          <Link href="/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-muted-foreground">@{user.username}</p>
          {user.address && (
            <p className="text-sm text-muted-foreground">📍 {user.address}</p>
          )}
          {user.mobile && (
            <p className="text-sm text-muted-foreground">📱 {user.mobile}</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4 mb-6">
        {/* First Row - Outstanding Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="h-32">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 h-16">
              <CardTitle className="text-sm font-bold leading-tight">Total Outstanding (Till 31st Jul'25)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">₹{totalPreviousOutstanding.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="h-32">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 h-16">
              <CardTitle className="text-sm font-bold leading-tight">Received Amount against 31st Jul'25 Outstanding</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">₹{totalReceivedOutstanding.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalPreviousOutstanding > 0 ? Math.round((totalReceivedOutstanding / totalPreviousOutstanding) * 100) : 0}% collected
              </p>
            </CardContent>
          </Card>

          <Card className="h-32">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 h-16">
              <CardTitle className="text-sm font-bold leading-tight">Balance Outstanding (31st Jul'25)</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-red-600">₹{totalPendingOutstanding.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalPreviousOutstanding > 0 ? Math.round((totalPendingOutstanding / totalPreviousOutstanding) * 100) : 0}% remaining
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Second Row - Boli Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Total Boli Daan</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalBoliAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{entries.length} entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Received Amount</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{totalReceived.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalBoliAmount > 0 ? Math.round((totalReceived / totalBoliAmount) * 100) : 0}% collected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Pending Amount</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{totalPending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalBoliAmount > 0 ? Math.round((totalPending / totalBoliAmount) * 100) : 0}% pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Total Advance Payment Remaining</CardTitle>
              <Wallet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₹{totalAdvancePayments.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {totalAdvancePayments > 0 ? "remaining balance" : "no balance remaining"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Sections */}
      <Tabs defaultValue="boli-entries" className="w-full">
        <TabsList className="w-full flex flex-col sm:grid sm:grid-cols-4 gap-1 h-auto">
          <TabsTrigger value="boli-entries" className="w-full justify-start text-sm px-3 py-2 sm:px-4">
            Boli Entries Status
          </TabsTrigger>
          <TabsTrigger value="payments" className="w-full justify-start text-sm px-3 py-2 sm:px-4">
            Payments & Receipts
          </TabsTrigger>
          <TabsTrigger value="dravya" className="w-full justify-start text-sm px-3 py-2 sm:px-4">
            Dravya Daan
          </TabsTrigger>
          <TabsTrigger value="previous-outstanding" className="w-full justify-start text-sm px-3 py-2 sm:px-4">
            Previous Outstanding
          </TabsTrigger>
        </TabsList>

        {/* Boli Entries Tab */}
        <TabsContent value="boli-entries">
          <Card>
            <CardHeader>
              <CardTitle>Boli Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div>Loading entries...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No boli entries found for this user.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-base">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-base font-semibold">Boli Date</TableHead>
                        <TableHead className="text-base font-semibold">Description</TableHead>
                        <TableHead className="text-base font-semibold">Amount</TableHead>
                        <TableHead className="text-base font-semibold">Status</TableHead>
                        <TableHead className="text-base font-semibold">Occasion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-base font-medium">{formatDate(entry.auctionDate)}</TableCell>
                          <TableCell className="text-base font-medium">{entry.description}</TableCell>
                          <TableCell className="text-base">₹{entry.totalAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-base">
                            <Badge className={`${getStatusColor(entry.status)} text-sm`}>
                              {getStatusText(entry.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-base">{entry.occasion}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments & Receipts Tab */}
        <TabsContent value="payments">
          <div className="space-y-6">
            {/* Boli Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Boli Entry Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {allPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments found for this user.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt No.</TableHead>
                          <TableHead>Entry Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allPayments.map((payment, index) => (
                          <TableRow key={`${payment.entryId}-${index}`}>
                            <TableCell className="font-medium">{payment.receiptNo}</TableCell>
                            <TableCell>{payment.entryDescription}</TableCell>
                            <TableCell>₹{payment.amount.toLocaleString()}</TableCell>
                            <TableCell>{payment.mode}</TableCell>
                            <TableCell>{formatDate(payment.date)}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Find the entry that contains this payment
                                  const entry = entries.find(e => e.id === payment.entryId);
                                  if (entry) {
                                    setSelectedReceiptData({
                                      entry,
                                      payment,
                                      paymentIndex: index
                                    });
                                  }
                                }}
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Receipt
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Previous Outstanding Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Previous Outstanding Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {allOutstandingPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No outstanding payments found for this user.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt No.</TableHead>
                          <TableHead>Record Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allOutstandingPayments.map((payment, index) => (
                          <TableRow key={`${payment.recordId}-${index}`}>
                            <TableCell className="font-medium">
                              {payment.receiptNo || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {payment.recordDescription || 'Previous Outstanding'}
                              {payment.recordNumber && (
                                <div className="text-xs text-muted-foreground">
                                  Record #{payment.recordNumber}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>₹{payment.amount.toLocaleString()}</TableCell>
                            <TableCell>{payment.mode}</TableCell>
                            <TableCell>{formatDate(payment.date)}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                title="Receipt functionality coming soon"
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Receipt
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Advance Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Advance Payments</CardTitle>
              </CardHeader>
              <CardContent>
                {advanceLoading ? (
                  <div>Loading advance payments...</div>
                ) : advancePayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No advance payments found for this user.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt No.</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payment Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {advancePayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.receiptNo}</TableCell>
                            <TableCell>₹{payment.amount.toLocaleString()}</TableCell>
                            <TableCell>{payment.paymentMode}</TableCell>
                            <TableCell>{formatDate(payment.date)}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                title="Receipt functionality coming soon"
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Receipt
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dravya Daan Tab */}
        <TabsContent value="dravya">
          <Card>
            <CardHeader>
              <CardTitle>Dravya Daan Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {dravyaLoading ? (
                <div>Loading dravya entries...</div>
              ) : dravyaEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No dravya daan entries found for this user.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Occasion</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Created By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dravyaEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.description}</TableCell>
                          <TableCell>{entry.occasion}</TableCell>
                          <TableCell>{formatDate(entry.entryDate)}</TableCell>
                          <TableCell>{entry.createdBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Previous Outstanding Tab */}
        <TabsContent value="previous-outstanding">
          <Card>
            <CardHeader>
              <CardTitle>Previous Outstanding Records</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historical outstanding amounts from old system
              </p>
            </CardHeader>
            <CardContent>
              <PreviousOutstandingSection userId={userId!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receipt Dialog */}
      {selectedReceiptData && (
        <HindiReceipt
          entry={selectedReceiptData.entry}
          payment={selectedReceiptData.payment}
          paymentIndex={selectedReceiptData.paymentIndex}
          isOpen={!!selectedReceiptData}
          onClose={() => setSelectedReceiptData(null)}
        />
      )}
    </div>
  );
}