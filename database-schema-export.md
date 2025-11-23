# Shivnagar Jain Temple Account Ledger Database Schema Export

**Generated on:** July 27, 2025  
**Database:** PostgreSQL  
**ORM:** Drizzle ORM  

## Overview

This database supports a mobile-first spiritual donation management platform with three user roles (admin, operator, viewer) and three main functional areas:

1. **Auction Entries** - Main ledger entries with payment tracking
2. **Dravya Entries** - Spiritual donations (completely isolated)
3. **Expense Entries** - Operator expense management (completely isolated)

## Database Tables

### 1. users
**Purpose:** User authentication and role management

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | AUTO_INCREMENT | Primary key |
| username | text | NO | - | Unique username for login |
| password | text | NO | - | Plain text password |
| name | text | NO | - | Full display name |
| email | text | NO | - | Email address |
| mobile | text | NO | '' | Mobile number |
| address | text | NO | '' | Physical address |
| role | text | NO | 'viewer' | User role: admin, operator, viewer |
| status | text | NO | 'active' | Account status: active, inactive |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (username)

### 2. entries (Boli Entries)
**Purpose:** Main boli ledger entries with payment tracking

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | AUTO_INCREMENT | Primary key |
| user_id | integer | NO | - | Reference to users.id |
| user_name | text | NO | - | Cached user name |
| user_mobile | text | YES | - | Cached user mobile |
| user_address | text | YES | - | Cached user address |
| description | text | NO | - | Entry description |
| amount | integer | NO | 0 | Base amount in paisa |
| quantity | integer | NO | 1 | Quantity multiplier |
| total_amount | integer | NO | - | Calculated total (amount × quantity) |
| occasion | text | NO | - | Event/occasion name |
| auction_date | text | NO | - | Date of boli (YYYY-MM-DD) - Column name kept for DB compatibility |
| status | text | NO | 'pending' | Payment status: pending, partial, full |
| pending_amount | integer | NO | - | Remaining amount to be paid |
| received_amount | integer | NO | 0 | Total amount received |
| payments | json | NO | '[]' | Array of PaymentRecord objects |
| updated_at | text | NO | ISO timestamp | Last update timestamp |
| created_by | text | NO | 'system' | Username who created entry |

**Payment Record JSON Structure:**
```json
{
  "date": "YYYY-MM-DD",
  "amount": 123400,
  "mode": "cash|upi|cheque|netbanking",
  "fileUrl": "/uploads/file.jpg",
  "receiptNo": "RCP2025001",
  "updatedBy": "username"
}
```

### 3. dravya_entries (Spiritual Donations)
**Purpose:** Spiritual donations - completely isolated from main application

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | AUTO_INCREMENT | Primary key |
| user_id | integer | NO | - | Reference to users.id |
| user_name | text | NO | - | Cached user name |
| user_mobile | text | YES | - | Cached user mobile |
| user_address | text | YES | - | Cached user address |
| description | text | NO | - | Donation description |
| occasion | text | NO | '' | Event/occasion name |
| entry_date | text | NO | - | Date of donation (YYYY-MM-DD) |
| created_by | text | NO | 'system' | Username who created entry |
| updated_at | text | NO | ISO timestamp | Last update timestamp |

**Note:** No payment tracking or amount fields - purely spiritual donations

### 4. expense_entries (Operator Expenses)
**Purpose:** Expense management for operators - completely isolated

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | AUTO_INCREMENT | Primary key |
| description | text | NO | - | Line item description |
| amount | integer | NO | - | Amount in paisa |
| quantity | integer | NO | - | Quantity |
| reason | text | NO | - | Reason for expense |
| expense_date | text | NO | - | Date of expense (YYYY-MM-DD) |
| payment_mode | text | NO | - | cash, upi, cheque, netbanking |
| attachment_url | text | YES | - | Receipt/proof file path |
| approved_by | text | NO | - | Approver name |
| created_by | text | NO | - | Operator who created |
| updated_at | text | NO | ISO timestamp | Last update timestamp |

### 5. transaction_logs (Audit Trail)
**Purpose:** Comprehensive audit trail for all boli entry operations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NO | AUTO_INCREMENT | Primary key |
| entry_id | integer | NO | - | Reference to entries.id |
| user_id | integer | NO | - | User who performed action |
| username | text | NO | - | Username for display |
| transaction_type | text | NO | - | credit, debit, update_payment, update_entry |
| amount | integer | NO | - | Amount involved in transaction |
| description | text | NO | - | Human readable description |
| date | text | NO | Current date | Transaction date (YYYY-MM-DD) |
| details | json | NO | - | Additional metadata |
| timestamp | text | NO | ISO timestamp | When log was created |

## Enums and Constants

### User Roles
- `admin` - Full access, can manage users, view all data, delete entries
- `operator` - Can add entries, manage payments, limited user management
- `viewer` - Read-only access to personal data

### Payment Status
- `pending` - No payments made
- `partial` - Some payments made, amount remaining
- `full` - Fully paid

### Payment Modes
- `cash` - Cash payment
- `upi` - UPI payment
- `cheque` - Cheque payment
- `netbanking` - Net banking payment

### Transaction Types
- `credit` - Adding new entry or deleting payment (increases balance)
- `debit` - Recording payment or deleting entry (decreases balance)
- `update_payment` - Updating existing payment
- `update_entry` - Updating existing entry

## Key Relationships

1. **users → entries** (1:N) - One user can have multiple boli entries
2. **users → dravya_entries** (1:N) - One user can have multiple dravya donations
3. **entries → transaction_logs** (1:N) - Each entry can have multiple audit logs
4. **expense_entries** - Standalone, no foreign key relationships

## Data Isolation Strategy

The system uses complete data isolation for secondary modules:

1. **Dravya Entries**: Separate table, separate APIs (`/api/dravya-entries`), no payment tracking
2. **Expense Entries**: Separate table, separate APIs (`/api/expense-entries`), operator-only access
3. **Main Entries**: Only boli entries appear in dashboards and reports

## Technical Notes

### Amount Storage
- All monetary amounts stored as integers in paisa (₹1 = 100 paisa)
- Frontend displays amounts in rupees with proper formatting
- Calculations done in paisa to avoid floating point precision issues

### Date Format
- All dates stored as text in YYYY-MM-DD format
- Timestamps stored as ISO 8601 strings
- Frontend handles locale-specific display formatting

### File Uploads
- Files stored in `/uploads` directory
- Paths stored as relative URLs in database
- Support for JPG, PNG, PDF formats
- 10MB file size limit

### Session Management
- Express sessions with memory store
- Session-based authentication using Passport.js
- 24-hour session timeout

## API Endpoints Summary

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/users` - List users (admin/operator only)
- `POST /api/users` - Create user (admin/operator only)
- `POST /api/users/bulk-upload` - Bulk user creation via CSV
- `PATCH /api/users/:id` - Update user

### Auction Entries
- `GET /api/entries` - List entries
- `POST /api/entries` - Create entry (operator only)
- `PATCH /api/entries/:id` - Update entry (admin only)
- `DELETE /api/entries/:id` - Delete entry (admin only)
- `POST /api/entries/:id/payments` - Record payment
- `DELETE /api/entries/:entryId/payments/:paymentIndex` - Delete payment

### Dravya Entries (Isolated)
- `GET /api/dravya-entries` - List dravya entries
- `POST /api/dravya-entries` - Create dravya entry

### Expense Entries (Isolated)
- `GET /api/expense-entries` - List expense entries (operator only)
- `POST /api/expense-entries` - Create expense entry (operator only)

### Dashboard & Reports
- `GET /api/dashboard` - Dashboard summary
- `GET /api/daily-earnings` - Daily earnings calendar
- `GET /api/daily-payments` - Daily payments calendar
- `GET /api/transaction-logs` - Audit trail

## Security Features

1. **Role-based Access Control**: Strict permission checking on all endpoints
2. **Session-based Authentication**: Secure session management
3. **Data Isolation**: Complete separation of auction, dravya, and expense data
4. **Audit Trail**: Comprehensive logging of all operations
5. **File Upload Validation**: Strict file type and size restrictions

## Schema Version
**Current Version:** 1.0  
**Last Updated:** July 26, 2025  
**Compatibility:** PostgreSQL 12+, Drizzle ORM

---

*This schema supports the Shivnagar Jain Temple account ledger management system with mobile-first design and comprehensive financial tracking capabilities.*