import { pgTable, text, serial, integer, boolean, timestamp, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define role type
export const UserRole = {
  ADMIN: "admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Define payment status type
export const PaymentStatus = {
  PENDING: "pending",
  PARTIAL: "partial",
  FULL: "full",
} as const;

export type PaymentStatusType = typeof PaymentStatus[keyof typeof PaymentStatus];

// Define entry status type (for soft delete)
export const EntryStatus = {
  ACTIVE: "active",
  DELETED: "deleted",
} as const;

export type EntryStatusType = typeof EntryStatus[keyof typeof EntryStatus];

// Define payment mode type
export const PaymentMode = {
  CASH: "cash",
  UPI: "upi",
  CHEQUE: "cheque",
  NETBANKING: "netbanking",
  ADVANCE_PAYMENT: "advance_payment",
} as const;

export type PaymentModeType = typeof PaymentMode[keyof typeof PaymentMode];

// Define transaction type for logging
export const TransactionType = {
  CREDIT: "credit", // Adding new entry or deleting payment
  DEBIT: "debit",   // Recording payment or deleting entry
  UPDATE_PAYMENT: "update_payment", // Updating an existing payment
  UPDATE_ENTRY: "update_entry",     // Updating an existing entry
} as const;

export type TransactionTypeValue = typeof TransactionType[keyof typeof TransactionType];

// Define entry types
export const EntryType = {
  AUCTION: "auction",
  DRAVYA: "dravya",
} as const;

export type EntryTypeValue = typeof EntryType[keyof typeof EntryType];

// Define UOM (Unit of Measurement) types for Dravya entries
export const UnitOfMeasurement = {
  GRAM: "gram",
  KG: "kg",
  NO_UNIT: "no_unit",
} as const;

export type UnitOfMeasurementType = typeof UnitOfMeasurement[keyof typeof UnitOfMeasurement];

// Define payment record type
export type PaymentRecord = {
  id?: string; // Unique ID for each payment record (for editing)
  date: string;
  amount: number;
  mode: PaymentModeType;
  fileUrl?: string; // For storing the path to uploaded files
  receiptNo?: string; // Receipt number for tracking payments
  updatedBy?: string; // Username of the person who recorded this payment
  status?: 'active' | 'deleted'; // Status for soft delete
};

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  serialNumber: integer("serial_number").notNull().default(1),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull().default(""),
  address: text("address").notNull().default(""),
  role: text("role").$type<UserRoleType>().notNull().default(UserRole.VIEWER),
  status: text("status").notNull().default("active"),
}, (table) => ({
  // Add indexes for performance
  usernameIdx: index("users_username_idx").on(table.username),
  roleIdx: index("users_role_idx").on(table.role),
}));

// Account entries table - only for boli entries
export const entries = pgTable("entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userMobile: text("user_mobile"),
  userAddress: text("user_address"),
  description: text("description").notNull(),
  amount: integer("amount").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  totalAmount: integer("total_amount").notNull(),
  occasion: text("occasion").notNull(),
  bediNumber: text("bedi_number").notNull().default("1"), // बेदी क्रमांक (user-entered)
  serialNumber: integer("serial_number").notNull(), // Auto-generated sequential number
  auctionDate: text("auction_date").notNull(), // Note: Column name stays same for DB compatibility
  status: text("status").$type<PaymentStatusType>().notNull().default(PaymentStatus.PENDING),
  entryStatus: text("entry_status").$type<EntryStatusType>().notNull().default("active"), // For soft delete
  pendingAmount: integer("pending_amount").notNull(),
  receivedAmount: integer("received_amount").notNull().default(0),
  payments: json("payments").$type<PaymentRecord[]>().notNull().default([]),
  receiptNumbers: text("receipt_numbers").notNull().default(""), // Comma-separated active receipt numbers
  deletedReceiptNumbers: text("deleted_receipt_numbers").notNull().default(""), // Comma-separated deleted receipt numbers
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  createdAt: text("created_at").default(new Date().toISOString()),
  createdBy: text("created_by").notNull().default("system"),
}, (table) => ({
  // Add indexes for performance
  userIdIdx: index("entries_user_id_idx").on(table.userId),
  statusIdx: index("entries_status_idx").on(table.status),
  entryStatusIdx: index("entries_entry_status_idx").on(table.entryStatus),
  auctionDateIdx: index("entries_auction_date_idx").on(table.auctionDate),
}));

// Boli Payments table - stores individual payment records
export const boliPayments = pgTable("boli_payments", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => entries.id, { onDelete: 'cascade' }),
  entrySerialNumber: integer("entry_serial_number").notNull(),
  receiptNumber: text("receipt_number").notNull(),
  amount: integer("amount").notNull(),
  date: text("date").notNull(),
  mode: text("mode").notNull(),
  fileUrl: text("file_url").notNull().default(""),
  updatedBy: text("updated_by").notNull(),
  status: text("status").notNull().default("active"), // 'active' or 'deleted'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  entryIdIdx: index("boli_payments_entry_id_idx").on(table.entryId),
  statusIdx: index("boli_payments_status_idx").on(table.status),
}));


// Separate table for dravya entries - completely isolated
export const dravyaEntries = pgTable("dravya_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userMobile: text("user_mobile"),
  userAddress: text("user_address"),
  description: text("description").notNull(),
  occasion: text("occasion").notNull().default(""),
  entryDate: text("entry_date").notNull(),
  createdBy: text("created_by").notNull().default("system"),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// Expense entries table (completely separate from main entries and dravya entries)
export const expenseEntries = pgTable("expense_entries", {
  id: serial("id").primaryKey(),
  firmName: text("firm_name"), // Firm Name (optional)
  billNo: text("bill_no"), // Bill No (optional)
  billDate: text("bill_date"), // Bill Date (optional)
  description: text("description").notNull(), // Line Item Description
  amount: integer("amount").notNull(), // Amount in rupees (₹)
  quantity: integer("quantity"), // Quantity (optional)
  reason: text("reason"), // Reason for expense (optional)
  expenseDate: text("expense_date").notNull(), // Date of Expense
  paymentMode: text("payment_mode").notNull(), // Mode of Payment
  attachmentUrl: text("attachment_url"), // Attachment for expense receipt
  approvedBy: text("approved_by").notNull(), // Approved By
  paidBy: text("paid_by"), // Paid By (temporarily optional for migration)
  createdBy: text("created_by").notNull(), // Created by (operator)
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// Advance payments table (completely separate module)
export const advancePayments = pgTable("advance_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userMobile: text("user_mobile"),
  date: text("date").notNull(), // Date of advance payment
  amount: integer("amount").notNull(), // Amount in rupees (₹)
  paymentMode: text("payment_mode").notNull(), // cash, upi, cheque, netbanking
  attachmentUrl: text("attachment_url"), // Payment screenshot for non-cash
  receiptNo: text("receipt_no"), // Advance payment receipt number - AP-YYYY-XXXXX format
  createdBy: text("created_by").notNull(), // Created by
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// Transaction logs table for tracking all credit and debit activities
export const transactionLogs = pgTable("transaction_logs", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(), // Reference to the entry
  userId: integer("user_id").notNull(), // User who performed the action
  username: text("username").notNull(), // Username for display
  transactionType: text("transaction_type").$type<TransactionTypeValue>().notNull(), // CREDIT or DEBIT
  amount: integer("amount").notNull(), // Amount involved
  description: text("description").notNull(), // Description of the transaction
  date: text("date").notNull().default(new Date().toISOString().split('T')[0]), // Date of transaction
  details: json("details").notNull(), // Additional details like payment method, etc.
  timestamp: text("timestamp").notNull().default(new Date().toISOString()), // When this log was created
});

// Advance payment usage tracking table
export const advancePaymentUsage = pgTable("advance_payment_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User whose advance payment was used
  entryId: integer("entry_id").notNull(), // Entry against which advance payment was applied
  amount: integer("amount").notNull(), // Amount of advance payment used
  date: text("date").notNull(), // Date when advance payment was applied
  createdBy: text("created_by").notNull(), // Who processed this usage
  createdAt: text("created_at").notNull().default(new Date().toISOString()), // When this usage was recorded
});

// Previous outstanding records table - for migrating past account balances
export const previousOutstandingRecords = pgTable("previous_outstanding_records", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number"), // Serial number for this outstanding record (PO-2025-001, PO-2025-002, etc.)
  recordNumber: integer("record_number"), // Fixed record number for display (REC-1, REC-2, etc.)
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userMobile: text("user_mobile"),
  userAddress: text("user_address"),
  outstandingAmount: integer("outstanding_amount").notNull(), // Amount in rupees
  receivedAmount: integer("received_amount").notNull().default(0), // Amount received in rupees
  pendingAmount: integer("pending_amount").notNull().default(0), // Calculated pending amount in rupees
  status: text("status").$type<PaymentStatusType>().notNull().default(PaymentStatus.PENDING),
  payments: json("payments").$type<PaymentRecord[]>().notNull().default([]),
  description: text("description").notNull().default("31.07.2025 तक कुल शेष राशि"),
  attachmentUrl: text("attachment_url"), // Path to the uploaded proof file
  attachmentName: text("attachment_name"), // Original filename
  createdBy: text("created_by").notNull().default("system"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  serialNumber: true,
});

export const insertEntrySchema = createInsertSchema(entries).omit({
  id: true,
  status: true,
  pendingAmount: true,
  receivedAmount: true,
  payments: true,
  totalAmount: true, // Calculated on server
  serialNumber: true, // Auto-generated on server
}).extend({
  // Make amount optional for entries
  amount: z.number().nonnegative().optional().default(0),
  // Make quantity optional with default 1
  quantity: z.number().positive().optional().default(1),
  // Occasion is optional
  occasion: z.string().optional().default(""),
  // Bedi number is optional with default "1"
  bediNumber: z.string().optional().default("1"),
  // Ensure userId is a number
  userId: z.coerce.number().positive(),
});

export const insertDravyaEntrySchema = createInsertSchema(dravyaEntries).omit({
  id: true,
}).extend({
  // Occasion is optional for dravya entries
  occasion: z.string().optional().default(""),
});

export const insertExpenseEntrySchema = createInsertSchema(expenseEntries).omit({
  id: true,
  updatedAt: true,
}).extend({
  // All fields are mandatory for expense entries
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  quantity: z.number().positive("Quantity must be positive"),
  reason: z.string().min(1, "Reason is required"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  paymentMode: z.enum([PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CHEQUE, PaymentMode.NETBANKING]),
  attachmentUrl: z.string().optional(),
  approvedBy: z.string().min(1, "Approved by is required"),
  createdBy: z.string().min(1, "Created by is required"),
});

export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entries.$inferSelect;
export type InsertDravyaEntry = z.infer<typeof insertDravyaEntrySchema>;
export type DravyaEntry = typeof dravyaEntries.$inferSelect;
export type InsertExpenseEntry = z.infer<typeof insertExpenseEntrySchema>;
export type ExpenseEntry = typeof expenseEntries.$inferSelect;

export const insertAdvancePaymentSchema = createInsertSchema(advancePayments).omit({
  id: true,
  createdAt: true,
  receiptNo: true, // Receipt number is auto-generated
}).extend({
  userId: z.number().positive("User is required"),
  userName: z.string().min(1, "User name is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  amount: z.number().positive("Amount must be positive"),
  paymentMode: z.enum([PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CHEQUE, PaymentMode.NETBANKING]),
  attachmentUrl: z.string().optional(),
  createdBy: z.string().min(1, "Created by is required"),
});

export type InsertAdvancePayment = z.infer<typeof insertAdvancePaymentSchema>;
export type AdvancePayment = typeof advancePayments.$inferSelect;

// Previous outstanding record schema
export const insertPreviousOutstandingRecordSchema = createInsertSchema(previousOutstandingRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  receivedAmount: true,
  pendingAmount: true,
  status: true,
  payments: true,
}).extend({
  userId: z.number().positive("User is required"),
  userName: z.string().min(1, "User name is required"),
  outstandingAmount: z.number().positive("Outstanding amount must be positive"),
  description: z.string().optional().default("Previous Outstanding Amount"),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  createdBy: z.string().min(1, "Created by is required"),
});

export type InsertPreviousOutstandingRecord = z.infer<typeof insertPreviousOutstandingRecordSchema>;
export type PreviousOutstandingRecord = typeof previousOutstandingRecords.$inferSelect;

export const recordPaymentSchema = z.object({
  entryId: z.number(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" }),
  mode: z.enum([PaymentMode.CASH, PaymentMode.UPI, PaymentMode.CHEQUE, PaymentMode.NETBANKING, PaymentMode.ADVANCE_PAYMENT]),
  fileUrl: z.string().optional(),
  receiptNo: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Transaction log schema
export const insertTransactionLogSchema = createInsertSchema(transactionLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertTransactionLog = z.infer<typeof insertTransactionLogSchema>;
export type TransactionLog = typeof transactionLogs.$inferSelect;
export type RecordPayment = z.infer<typeof recordPaymentSchema>;

// Corpus settings table (for admin configuration)
export const corpusSettings = pgTable("corpus_settings", {
  id: serial("id").primaryKey(),
  corpusValue: integer("corpus_value").notNull().default(0), // Corpus value as of 31st July 2025 (in rupees)
  baseDate: text("base_date").notNull().default("2025-07-31"), // Base date for corpus calculation
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by").notNull(), // Username of admin who updated
});

// Corpus settings schema
export const insertCorpusSettingsSchema = createInsertSchema(corpusSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertCorpusSettings = z.infer<typeof insertCorpusSettingsSchema>;
export type CorpusSettings = typeof corpusSettings.$inferSelect;
