import {
  users, entries, transactionLogs, previousOutstandingRecords,
  type User, type InsertUser,
  type Entry, type InsertEntry,
  type PaymentRecord, type UserRoleType, type PaymentStatusType,
  PaymentStatus, UserRole, TransactionType, type TransactionTypeValue,
  type TransactionLog, type InsertTransactionLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, SQL, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;

  // Entry management
  getEntries(): Promise<Entry[]>;
  getEntry(id: number): Promise<Entry | undefined>;
  getUserEntries(userId: number): Promise<Entry[]>;
  getEntriesByUserId(userId: number): Promise<Entry[]>;
  createEntry(entry: InsertEntry, createdByUserId: number): Promise<Entry>;
  updateEntry(id: number, updates: Partial<Entry>, updatedByUserId: number): Promise<Entry | undefined>;
  deleteEntry(id: number, deletedByUserId: number): Promise<boolean>;

  // Advance payment management
  getAdvancePayments(): Promise<any[]>;
  getAdvancePaymentsByUserId(userId: number): Promise<any[]>;
  calculateRemainingAdvancePayment(userId: number): Promise<number>;

  // Dravya entry management
  getDravyaEntries(): Promise<any[]>;
  getDravyaEntriesByUserId(userId: number): Promise<any[]>;

  // Payment management
  recordPayment(entryId: number, payment: PaymentRecord, recordedByUserId: number): Promise<Entry | undefined>;
  deletePayment(entryId: number, paymentIndex: number, deletedByUserId: number): Promise<Entry | undefined>;

  // Transaction logging
  getTransactionLogs(): Promise<TransactionLog[]>;
  getEntryTransactionLogs(entryId: number): Promise<TransactionLog[]>;
  createTransactionLog(log: InsertTransactionLog): Promise<TransactionLog>;
  getNextSerialNumber(): Promise<number>;
}

// Function to get next available number in boli payment ranges (1-200, 301-500, 701-900, etc.)
function getNextBoliNumber(existingNumbers: Set<number>): number {
  // Boli payment ranges: 1-200, 301-500, 601-800, 901-1100, 1201-1400, etc.
  // Pattern: start at 1, then skip 200s series (301, 601, 901, 1201...)
  const boliRanges = [
    { start: 1, end: 200 },
    { start: 301, end: 500 },
    { start: 601, end: 800 },
    { start: 901, end: 1100 },
    { start: 1201, end: 1400 },
    { start: 1501, end: 1700 },
    { start: 1801, end: 2000 }
  ];

  for (const range of boliRanges) {
    for (let num = range.start; num <= range.end; num++) {
      if (!existingNumbers.has(num)) {
        return num;
      }
    }
  }

  // If all predefined ranges are full, continue the pattern
  let rangeStart = 2101;
  while (true) {
    for (let num = rangeStart; num <= rangeStart + 199; num++) {
      if (!existingNumbers.has(num)) {
        return num;
      }
    }
    rangeStart += 300; // Move to next boli range (skip 200s series)
  }
}

// Function to generate sequential SPDJMSJ receipt numbers for boli payments using block allocation
export async function generateBoliReceiptNumber(paymentDate: string): Promise<string> {
  try {
    const year = paymentDate.split('-')[0]; // Extract year from YYYY-MM-DD

    // Get all existing SPDJMSJ serial numbers from entries
    const existingNumbers = new Set<number>();

    // Get boli payment numbers from entries
    const allEntries = await db.select().from(entries);

    for (const entry of allEntries) {
      if (!entry.payments || !Array.isArray(entry.payments)) continue;

      for (const payment of entry.payments) {
        if (!payment.receiptNo) continue;

        const match = payment.receiptNo.match(/SPDJMSJ-(\d{4})-(\d{5})/);
        if (match && match[1] === year) {
          const foundNumber = parseInt(match[2], 10);
          if (!isNaN(foundNumber)) {
            existingNumbers.add(foundNumber);
          }
        }
      }
    }

    // Get outstanding payment numbers
    const poRecords = await db.select()
      .from(previousOutstandingRecords)
      .orderBy(desc(previousOutstandingRecords.id))
      .limit(200);

    for (const record of poRecords) {
      if (!record.payments || !Array.isArray(record.payments)) continue;

      for (const payment of record.payments) {
        if (!payment.receiptNo) continue;

        const match = payment.receiptNo.match(/SPDJMSJ-(\d{4})-(\d{5})/);
        if (match && match[1] === year) {
          const foundNumber = parseInt(match[2], 10);
          if (!isNaN(foundNumber)) {
            existingNumbers.add(foundNumber);
          }
        }
      }
    }

    // Get next available number in boli ranges
    const nextNumber = getNextBoliNumber(existingNumbers);

    // Format with 5 digits (00001, 00002, etc.)
    const formattedNumber = nextNumber.toString().padStart(5, '0');
    return `SPDJMSJ-${year}-${formattedNumber}`;
  } catch (error) {
    console.error("Error generating boli receipt number:", error);
    // Fallback to a timestamp-based format if there's an error
    const timestamp = new Date().getTime();
    return `SPDJMSJ-${paymentDate.split('-')[0]}-${timestamp.toString().slice(-5)}`;
  }
}

// Function to get next available number in outstanding payment ranges (201-300, 501-600, 801-900, 1101-1200, etc.)
function getNextOutstandingNumber(existingNumbers: Set<number>): number {
  // Outstanding payment ranges: 201-300, 501-600, 801-900, 1101-1200, etc.
  // Pattern: start at 201, then add 300 each time (201→501→801→1101...)
  const outstandingRanges = [
    { start: 201, end: 300 },
    { start: 501, end: 600 },
    { start: 801, end: 900 },
    { start: 1101, end: 1200 },
    { start: 1401, end: 1500 },
    { start: 1701, end: 1800 },
    { start: 2001, end: 2100 }
  ];

  for (const range of outstandingRanges) {
    for (let num = range.start; num <= range.end; num++) {
      if (!existingNumbers.has(num)) {
        return num;
      }
    }
  }

  // If all predefined ranges are full, continue the pattern
  let rangeStart = 2301;
  while (true) {
    for (let num = rangeStart; num <= rangeStart + 99; num++) {
      if (!existingNumbers.has(num)) {
        return num;
      }
    }
    rangeStart += 300; // Move to next outstanding range (add 300)
  }
}

// Function to generate sequential receipt numbers for previous outstanding payments using block allocation
export async function generatePreviousOutstandingReceiptNumber(paymentDate: string): Promise<string> {
  try {
    const year = paymentDate.split('-')[0]; // Extract year from YYYY-MM-DD

    // Get all existing SPDJMSJ serial numbers
    const existingNumbers = new Set<number>();

    // Get boli payment numbers from entries
    const allEntries = await db.select().from(entries);

    for (const entry of allEntries) {
      if (!entry.payments || !Array.isArray(entry.payments)) continue;

      for (const payment of entry.payments) {
        if (!payment.receiptNo) continue;

        const match = payment.receiptNo.match(/SPDJMSJ-(\d{4})-(\d{5})/);
        if (match && match[1] === year) {
          const foundNumber = parseInt(match[2], 10);
          if (!isNaN(foundNumber)) {
            existingNumbers.add(foundNumber);
          }
        }
      }
    }

    // Get outstanding payment numbers
    const poRecords = await db.select()
      .from(previousOutstandingRecords)
      .orderBy(desc(previousOutstandingRecords.id))
      .limit(200);

    for (const record of poRecords) {
      if (!record.payments || !Array.isArray(record.payments)) continue;

      for (const payment of record.payments) {
        if (!payment.receiptNo) continue;

        const match = payment.receiptNo.match(/SPDJMSJ-(\d{4})-(\d{5})/);
        if (match && match[1] === year) {
          const foundNumber = parseInt(match[2], 10);
          if (!isNaN(foundNumber)) {
            existingNumbers.add(foundNumber);
          }
        }
      }
    }

    // Get next available number in outstanding ranges
    const nextNumber = getNextOutstandingNumber(existingNumbers);

    // Format with 5 digits (00001, 00002, etc.)
    const formattedNumber = nextNumber.toString().padStart(5, '0');
    return `SPDJMSJ-${year}-${formattedNumber}`;
  } catch (error) {
    console.error("Error generating previous outstanding receipt number:", error);
    // Fallback to a timestamp-based format if there's an error
    const timestamp = new Date().getTime();
    return `SPDJMSJ-${paymentDate.split('-')[0]}-${timestamp.toString().slice(-5)}`;
  }
}

// Function to generate serial numbers for outstanding records (PO-2025-001, PO-2025-002, etc.)
export async function generateOutstandingRecordSerialNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear();

    // Get existing outstanding record serial numbers for this year
    const records = await db.select()
      .from(previousOutstandingRecords)
      .orderBy(desc(previousOutstandingRecords.id))
      .limit(100);

    let maxSequenceNumber = 0;

    for (const record of records) {
      if (!record.serialNumber) continue;

      const match = record.serialNumber.match(/PO-(\d{4})-(\d{3})/);
      if (match && match[1] === year.toString()) {
        const foundNumber = parseInt(match[2], 10);
        if (!isNaN(foundNumber) && foundNumber > maxSequenceNumber) {
          maxSequenceNumber = foundNumber;
        }
      }
    }

    // Next sequence number
    const nextSequenceNumber = maxSequenceNumber + 1;

    // Format with 3 digits (001, 002, etc.)
    const formattedNumber = nextSequenceNumber.toString().padStart(3, '0');
    return `PO-${year}-${formattedNumber}`;
  } catch (error) {
    console.error("Error generating outstanding record serial number:", error);
    // Fallback to a timestamp-based format if there's an error
    const timestamp = new Date().getTime();
    return `PO-${new Date().getFullYear()}-${timestamp.toString().slice(-3)}`;
  }
}

export class DatabaseStorage implements IStorage {
  async getTransactionLogs(): Promise<TransactionLog[]> {
    try {
      return await db.select().from(transactionLogs).orderBy(desc(transactionLogs.id));
    } catch (error) {
      console.error("Error fetching transaction logs:", error);
      return []; // Return empty array instead of failing
    }
  }

  async getEntryTransactionLogs(entryId: number): Promise<TransactionLog[]> {
    try {
      return await db
        .select()
        .from(transactionLogs)
        .where(eq(transactionLogs.entryId, entryId))
        .orderBy(desc(transactionLogs.id));
    } catch (error) {
      console.error(`Error fetching transaction logs for entry ${entryId}:`, error);
      return []; // Return empty array instead of failing
    }
  }

  async createTransactionLog(log: InsertTransactionLog): Promise<TransactionLog> {
    try {
      // Ensure we have a valid transaction type
      const transactionType = log.transactionType || TransactionType.UPDATE_ENTRY;

      const [result] = await db.insert(transactionLogs).values({
        entryId: log.entryId || 0,
        userId: log.userId || 0,
        username: log.username || 'system',
        description: log.description || 'Transaction record',
        amount: log.amount || 0,
        transactionType: transactionType as TransactionTypeValue,
        details: log.details || {},
        date: new Date().toISOString().split('T')[0]
      }).returning();

      return result;
    } catch (error) {
      console.error("Error creating transaction log:", error);
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return []; // Return empty array instead of failing
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error(`Error fetching user by username ${username}:`, error);
      return undefined;
    }
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
      return user;
    } catch (error) {
      console.error(`Error fetching user by mobile ${mobile}:`, error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Ensure default values
      const userRole: UserRoleType = insertUser.role as UserRoleType || UserRole.VIEWER;

      // Get the next serial number based on existing users
      const allUsers = await db.select().from(users);
      const nextSerialNumber = allUsers.length + 1;

      const [newUser] = await db.insert(users).values({
        ...insertUser,
        role: userRole,
        serialNumber: nextSerialNumber
      }).returning();

      return newUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();

      return updatedUser;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      return undefined;
    }
  }

  async getEntries(includeDeleted: boolean = false): Promise<Entry[]> {
    try {
      let query = db.select({
        entry: entries,
        user: users
      })
        .from(entries)
        .leftJoin(users, eq(entries.userId, users.id));

      // Filter by entry_status unless includeDeleted is true
      if (!includeDeleted) {
        query = query.where(eq(entries.entryStatus, 'active')) as any;
      }

      const entriesData = await query.orderBy(entries.id);

      // Merge user information from users table to entries and parse payments
      return entriesData.map(item => {
        let parsedPayments = [];
        try {
          // Parse payments from JSON string to array
          const paymentsStr = item.entry.payments as any;
          parsedPayments = typeof paymentsStr === 'string'
            ? JSON.parse(paymentsStr || '[]')
            : (paymentsStr || []);
        } catch (e) {
          console.error(`Failed to parse payments for entry ${item.entry.id}:`, e);
          parsedPayments = [];
        }

        return {
          ...item.entry,
          payments: parsedPayments,
          userName: item.user?.name || item.entry.userName,
          userMobile: item.user?.mobile || item.entry.userMobile,
          userAddress: item.user?.address || item.entry.userAddress
        };
      });
    } catch (error) {
      console.error("Error fetching entries:", error);
      return []; // Return empty array instead of failing
    }
  }

  async getEntry(id: number): Promise<Entry | undefined> {
    try {
      const entryData = await db.select({
        entry: entries,
        user: users
      })
        .from(entries)
        .leftJoin(users, eq(entries.userId, users.id))
        .where(eq(entries.id, id));

      if (entryData.length === 0) return undefined;

      // Parse payments from JSON string
      let parsedPayments = [];
      try {
        const paymentsStr = entryData[0].entry.payments as any;
        parsedPayments = typeof paymentsStr === 'string'
          ? JSON.parse(paymentsStr || '[]')
          : (paymentsStr || []);
      } catch (e) {
        console.error(`Failed to parse payments for entry ${entryData[0].entry.id}:`, e);
        parsedPayments = [];
      }

      // Merge user information from users table to entry
      return {
        ...entryData[0].entry,
        payments: parsedPayments,
        userName: entryData[0].user?.name || entryData[0].entry.userName,
        userMobile: entryData[0].user?.mobile || entryData[0].entry.userMobile,
        userAddress: entryData[0].user?.address || entryData[0].entry.userAddress
      };
    } catch (error) {
      console.error(`Error fetching entry ${id}:`, error);
      return undefined;
    }
  }

  async getUserEntries(userId: number, includeDeleted: boolean = false): Promise<Entry[]> {
    try {
      let query = db.select({
        entry: entries,
        user: users
      })
        .from(entries)
        .leftJoin(users, eq(entries.userId, users.id));

      // Build where conditions
      const conditions = [eq(entries.userId, userId)];
      if (!includeDeleted) {
        conditions.push(eq(entries.entryStatus, 'active'));
      }

      const entriesData = await query.where(and(...conditions));

      // Merge user information from users table to entries
      return entriesData.map(item => ({
        ...item.entry,
        userName: item.user?.name || item.entry.userName,
        userMobile: item.user?.mobile || item.entry.userMobile,
        userAddress: item.user?.address || item.entry.userAddress
      }));
    } catch (error) {
      console.error(`Error fetching entries for user ${userId}:`, error);
      return []; // Return empty array instead of failing
    }
  }

  async getNextSerialNumber(): Promise<number> {
    try {
      // Logic: Get the maximum existing serial_number and add 1
      // This ensures we always increment from the last used number

      const result = await db.execute(sql`
        SELECT MAX(serial_number) as max_val 
        FROM entries
      `);

      const maxVal = Number(result[0]?.max_val || 0);

      console.log(`Max existing Serial Number: ${maxVal}, Next Serial Number: ${maxVal + 1}`);
      return maxVal + 1;

    } catch (error) {
      console.error("Error getting next serial number:", error);
      // Fallback to a safe large number if query fails
      return 99999;
    }
  }

  async createEntry(insertEntry: InsertEntry, createdByUserId?: number): Promise<Entry> {
    try {
      console.log("Creating entry with data:", insertEntry);

      const quantity = insertEntry.quantity || 1;
      const totalAmount = insertEntry.amount * quantity;

      // Get the current user data to ensure we have the latest information
      const userResult = await db.select().from(users).where(eq(users.id, insertEntry.userId));
      const user = userResult.length > 0 ? userResult[0] : null;

      console.log("User found for entry:", user);

      // Generate next sequential serial number 
      const nextSerialNumber = await this.getNextSerialNumber();
      console.log(`Using serial number: ${nextSerialNumber}`);

      // Use Drizzle ORM for better error handling and auto-ID generation
      const [newEntry] = await db.insert(entries).values({
        userId: insertEntry.userId,
        userName: user?.name || insertEntry.userName || 'Unknown User',
        userMobile: user?.mobile || '',
        userAddress: user?.address || '',
        description: insertEntry.description || '',
        amount: insertEntry.amount,
        quantity: quantity,
        totalAmount: totalAmount,
        occasion: insertEntry.occasion || '',
        bediNumber: insertEntry.bediNumber || '1', // User-entered value
        serialNumber: nextSerialNumber, // Auto-generated value
        auctionDate: insertEntry.auctionDate || new Date().toISOString().split('T')[0],
        pendingAmount: totalAmount,
        receivedAmount: 0,
        status: PaymentStatus.PENDING,
        payments: [],
        createdBy: createdByUserId ? 'operator' : 'system',
        updatedAt: new Date().toISOString(), // Dynamic timestamp
      }).returning();

      console.log("Entry creation result:", newEntry);

      // Log this entry creation as a CREDIT transaction if we have the creator's ID
      if (createdByUserId && newEntry) {
        // Get the user who created the entry
        const creatorResult = await db.select().from(users).where(eq(users.id, createdByUserId));
        const creator = creatorResult.length > 0 ? creatorResult[0] : null;

        if (creator) {
          try {
            await this.createTransactionLog({
              entryId: newEntry.id,
              userId: createdByUserId,
              username: creator.username,
              description: `Created new entry: "${newEntry.description}"`,
              amount: newEntry.totalAmount,
              transactionType: TransactionType.CREDIT,
              details: newEntry
            });
          } catch (logError) {
            console.error("Error logging transaction:", logError);
            // Continue anyway so entry creation succeeds
          }
        }
      }

      // Return the entry directly since Drizzle ORM returns camelCase properties
      return newEntry;
    } catch (error) {
      console.error("Error in createEntry:", error);
      throw error;
    }
  }

  async updateEntry(id: number, updates: Partial<Entry>, updatedByUserId: number): Promise<Entry | undefined> {
    try {
      // Get the original entry first
      const [originalEntry] = await db.select().from(entries).where(eq(entries.id, id));
      if (!originalEntry) return undefined;

      // Get the user who is updating this entry
      const [updater] = await db.select().from(users).where(eq(users.id, updatedByUserId));
      if (!updater) return undefined;

      // If userId is being changed, fetch the new user's data
      let newUserName = updates.userName || originalEntry.userName;
      let newUserMobile = updates.userMobile || originalEntry.userMobile;
      let newUserAddress = updates.userAddress || originalEntry.userAddress;

      if (updates.userId && updates.userId !== originalEntry.userId) {
        const [newUser] = await db.select().from(users).where(eq(users.id, updates.userId));
        if (newUser) {
          newUserName = newUser.name;
          newUserMobile = newUser.mobile || '';
          newUserAddress = newUser.address || '';
          console.log(`User change detected: ${originalEntry.userName} -> ${newUser.name}`);
        }
      }

      // Use provided totalAmount directly, or calculate from amount/quantity if not provided
      const newAmount = updates.amount !== undefined ? updates.amount : originalEntry.amount;
      const newQuantity = updates.quantity !== undefined ? updates.quantity : originalEntry.quantity;
      const newTotal = updates.totalAmount !== undefined ? updates.totalAmount : (newAmount * newQuantity);
      const newPendingAmount = newTotal - originalEntry.receivedAmount;

      // Update the entry with all fields including user data
      const [updatedEntry] = await db
        .update(entries)
        .set({
          userId: updates.userId || originalEntry.userId,
          userName: newUserName,
          userMobile: newUserMobile,
          userAddress: newUserAddress,
          description: updates.description || originalEntry.description,
          amount: newAmount,
          quantity: newQuantity,
          totalAmount: newTotal,
          pendingAmount: newPendingAmount,
          occasion: updates.occasion || originalEntry.occasion,
          bediNumber: updates.bediNumber || originalEntry.bediNumber,
          auctionDate: updates.auctionDate || originalEntry.auctionDate,
          updatedAt: new Date().toISOString()
        })
        .where(eq(entries.id, id))
        .returning();

      if (!updatedEntry) {
        console.error(`No entry returned after update for ID: ${id}`);
        return undefined;
      }

      console.log(`Successfully updated entry ${id}:`, {
        id: updatedEntry.id,
        userName: updatedEntry.userName,
        description: updatedEntry.description,
        totalAmount: updatedEntry.totalAmount,
        quantity: updatedEntry.quantity,
        occasion: updatedEntry.occasion,
        auctionDate: updatedEntry.auctionDate,
        updatedBy: updater.username,
        updatedAt: updatedEntry.updatedAt
      });

      // Return the updated entry with proper field mapping to match frontend expectations
      return {
        ...updatedEntry,
        userId: updatedEntry.userId,
        userName: updatedEntry.userName,
        userMobile: updatedEntry.userMobile,
        userAddress: updatedEntry.userAddress,
        totalAmount: updatedEntry.totalAmount,
        pendingAmount: updatedEntry.pendingAmount,
        receivedAmount: updatedEntry.receivedAmount,
        auctionDate: updatedEntry.auctionDate,
        updatedAt: updatedEntry.updatedAt,
        createdBy: updatedEntry.createdBy
      };
    } catch (error) {
      console.error(`Error updating entry ${id}:`, error);
      return undefined;
    }
  }

  async deleteEntry(id: number, deletedByUserId: number): Promise<boolean> {
    try {
      // Get the entry first to log the deletion
      const [entry] = await db.select().from(entries).where(eq(entries.id, id));
      if (!entry) return false;

      // Get the user who is deleting this entry
      const [deleter] = await db.select().from(users).where(eq(users.id, deletedByUserId));
      if (!deleter) return false;

      // Log this as a DEBIT transaction (canceling the original CREDIT)
      await this.createTransactionLog({
        entryId: entry.id,
        userId: deletedByUserId,
        username: deleter.username,
        description: `Deleted entry #${entry.id}`,
        amount: entry.totalAmount,
        transactionType: TransactionType.DEBIT,
        details: entry
      });

      // Delete the entry
      await db
        .delete(entries)
        .where(eq(entries.id, id));

      return true;
    } catch (error) {
      console.error(`Error deleting entry ${id}:`, error);
      return false;
    }
  }

  async deletePayment(entryId: number, paymentIndex: number, deletedByUserId: number): Promise<Entry | undefined> {
    try {
      // Get the entry to modify its payments
      const entryResult = await db.select({
        entry: entries,
        user: users
      })
        .from(entries)
        .leftJoin(users, eq(entries.userId, users.id))
        .where(eq(entries.id, entryId));

      if (entryResult.length === 0) return undefined;

      const entry = entryResult[0].entry;
      const user = entryResult[0].user;

      if (!entry.payments || paymentIndex >= entry.payments.length) {
        return undefined;
      }

      // Get payment to be deleted
      const paymentToDelete = entry.payments[paymentIndex];

      // Delete the payment by removing it from the array
      const updatedPayments = [...entry.payments];
      updatedPayments.splice(paymentIndex, 1);

      // Recalculate received and pending amounts
      const newReceivedAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newPendingAmount = entry.totalAmount - newReceivedAmount;

      // Determine new payment status
      let newStatus: PaymentStatusType;
      if (newReceivedAmount === 0) {
        newStatus = PaymentStatus.PENDING;
      } else if (newReceivedAmount < entry.totalAmount) {
        newStatus = PaymentStatus.PARTIAL;
      } else {
        newStatus = PaymentStatus.FULL;
      }

      const oldStatus: PaymentStatusType = entry.status as PaymentStatusType;

      // Update the entry with new payments and amounts
      const [updateResult] = await db
        .update(entries)
        .set({
          payments: updatedPayments,
          receivedAmount: newReceivedAmount,
          pendingAmount: newPendingAmount,
          status: newStatus
        })
        .where(eq(entries.id, entryId))
        .returning();

      if (!updateResult) return undefined;

      // Log deletion as a CREDIT transaction (canceling the original DEBIT)
      await this.createTransactionLog({
        entryId: entryId,
        userId: deletedByUserId,
        username: user?.username || "system",
        description: `Deleted payment record of ₹${paymentToDelete.amount} from entry #${entryId}`,
        amount: paymentToDelete.amount,
        transactionType: TransactionType.CREDIT,
        details: paymentToDelete
      });

      // Also log status change if it happened
      if (oldStatus !== newStatus) {
        await this.createTransactionLog({
          entryId: entryId,
          userId: deletedByUserId,
          username: user?.username || "system",
          description: `Payment status changed from ${oldStatus} to ${newStatus}`,
          amount: 0,
          transactionType: TransactionType.UPDATE_PAYMENT,
          details: {
            oldStatus,
            newStatus
          }
        });
      }

      return updateResult;
    } catch (error) {
      console.error(`Error deleting payment for entry ${entryId}:`, error);
      return undefined;
    }
  }

  async recordPayment(entryId: number, payment: PaymentRecord, recordedByUserId: number): Promise<Entry | undefined> {
    try {
      // Get the entry to modify
      const entryResult = await db.select({
        entry: entries,
        user: users
      })
        .from(entries)
        .leftJoin(users, eq(entries.userId, users.id))
        .where(eq(entries.id, entryId));

      if (entryResult.length === 0) return undefined;

      const entry = entryResult[0].entry;
      const user = entryResult[0].user;

      // Ensure payments array exists
      const currentPayments = entry.payments || [];

      // Add the new payment
      const updatedPayments = [...currentPayments, payment];

      // Calculate new received and pending amounts
      const newReceivedAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newPendingAmount = entry.totalAmount - newReceivedAmount;

      // Determine payment status
      const oldStatus: PaymentStatusType = entry.status as PaymentStatusType;
      let newStatus: PaymentStatusType = entry.status as PaymentStatusType;

      if (newReceivedAmount === 0) {
        newStatus = PaymentStatus.PENDING;
      } else if (newReceivedAmount < entry.totalAmount) {
        newStatus = PaymentStatus.PARTIAL;
      } else {
        newStatus = PaymentStatus.FULL;
      }

      // Update the entry with the new payment and amounts
      const [updateResult] = await db
        .update(entries)
        .set({
          payments: updatedPayments,
          receivedAmount: newReceivedAmount,
          pendingAmount: newPendingAmount,
          status: newStatus
        })
        .where(eq(entries.id, entryId))
        .returning();

      if (!updateResult) return undefined;

      // Get user who recorded the payment
      const recordingUser = await this.getUser(recordedByUserId);

      // Log the payment as a DEBIT transaction - Ensuring TransactionType is specified
      try {
        await this.createTransactionLog({
          entryId: entryId,
          userId: recordedByUserId,
          username: recordingUser?.username || "system",
          description: `Payment of ₹${payment.amount} recorded by ${recordingUser?.username || "system"}`,
          amount: payment.amount,
          transactionType: TransactionType.DEBIT, // Explicitly setting the transaction type
          details: {
            date: payment.date,
            paymentMode: payment.mode,
            receiptNo: payment.receiptNo
          }
        });
      } catch (logError) {
        console.error("Error creating transaction log:", logError);
        // Continue execution even if logging fails
      }

      // Log status change if status has changed
      if (oldStatus !== newStatus) {
        await this.createTransactionLog({
          entryId: entryId,
          userId: recordedByUserId,
          username: user?.username || "system",
          description: `Payment status changed from ${oldStatus} to ${newStatus}`,
          amount: 0,
          transactionType: TransactionType.UPDATE_PAYMENT,
          details: {
            oldStatus,
            newStatus,
            payment
          }
        });
      }

      return updateResult;
    } catch (error) {
      console.error(`Error recording payment for entry ${entryId}:`, error);
      return undefined;
    }
  }

  // New methods for user detail functionality
  async getEntriesByUserId(userId: number): Promise<Entry[]> {
    return this.getUserEntries(userId);
  }

  async getAdvancePayments(): Promise<any[]> {
    try {
      // This is a placeholder - you'll need to implement based on your advance payments schema
      // For now, return empty array
      return [];
    } catch (error) {
      console.error("Error fetching advance payments:", error);
      return [];
    }
  }

  async getAdvancePaymentsByUserId(userId: number): Promise<any[]> {
    try {
      // This is a placeholder - you'll need to implement based on your advance payments schema
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Error fetching advance payments for user ${userId}:`, error);
      return [];
    }
  }

  async getDravyaEntries(): Promise<any[]> {
    try {
      // This is a placeholder - you'll need to implement based on your dravya entries schema
      // For now, return empty array
      return [];
    } catch (error) {
      console.error("Error fetching dravya entries:", error);
      return [];
    }
  }

  async getDravyaEntriesByUserId(userId: number): Promise<any[]> {
    try {
      // This is a placeholder - you'll need to implement based on your dravya entries schema
      // For now, return empty array
      return [];
    } catch (error) {
      console.error(`Error fetching dravya entries for user ${userId}:`, error);
      return [];
    }
  }

  async calculateRemainingAdvancePayment(userId: number): Promise<number> {
    try {
      const { query } = await import("./db");

      // Get total advance payments for the user
      const advanceResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as total_advance FROM advance_payments WHERE user_id = $1',
        [userId]
      );

      // Get total used advance payments (payments made using advance)
      const usedResult = await query(
        'SELECT COALESCE(SUM(amount), 0) as total_used FROM advance_payment_usage WHERE user_id = $1',
        [userId]
      );

      const totalAdvance = parseInt(advanceResult.rows[0]?.total_advance || '0');
      const totalUsed = parseInt(usedResult.rows[0]?.total_used || '0');

      console.log(`[DEBUG] User ${userId} - Total Advance: ${totalAdvance}, Total Used: ${totalUsed}`);

      const remainingBalance = totalAdvance - totalUsed;

      console.log(`[DEBUG] User ${userId} - Calculated Balance: ${remainingBalance}`);

      // Return 0 if balance would be negative (user can't have negative advance balance)
      const finalBalance = Math.max(0, remainingBalance);
      console.log(`[DEBUG] User ${userId} - Final Balance: ${finalBalance}`);

      return finalBalance;
    } catch (error) {
      console.error(`Error calculating advance payment for user ${userId}:`, error);
      return 0;
    }
  }
}

// Initialize the database and storage
async function initializeDatabase() {
  // Database initialization can happen here if needed
  console.log("Database initialized");
}

export const storage = new DatabaseStorage();