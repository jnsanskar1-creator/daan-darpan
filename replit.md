# दान-दर्पण (Daan-Darpan) - Account Ledger Management System

## Overview
This project is a full-stack web application designed for comprehensive account ledger management. It provides user authentication, robust entry management (specifically for "boli" entries, a form of ledger entry), payment tracking, and detailed transaction logging. The system supports role-based access control, offering administrative, operational, and viewing permissions. The core vision is to streamline financial record-keeping for specific types of transactions, ensuring accountability and easy access to historical data.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, built using Vite.
- **UI/UX**: Utilizes Radix UI primitives and custom shadcn/ui components, styled with Tailwind CSS following a mobile-first approach.
- **State Management**: TanStack Query for server state.
- **Form Handling**: React Hook Form with Zod validation.
- **Routing**: Wouter for client-side navigation.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL, integrated via Drizzle ORM for type-safe operations.
- **Authentication**: Session-based using Passport.js (local strategy) and express-session, with role-based access control.
- **API Design**: RESTful with consistent error handling.

### Key Features
- **Authentication & Authorization**: Session-based, role-based (admin, operator, viewer) access control with protected routes.
- **Boli Entry Management**: Full CRUD operations for ledger entries, including payment status tracking (pending, partial, full) and file upload for payment records.
- **Dravya Entry System**: Completely isolated module for spiritual donations, with its own database table and API endpoints, excluding payment tracking or dashboard integration.
- **Payment System**: Records partial and full payments for boli entries, supports multiple payment modes, generates receipt numbers, and tracks payment history.
- **Transaction Logging**: Comprehensive audit trail for boli entry and payment modifications, with user attribution.
- **Advance Payment Integration**: System for tracking and automatically applying advance payments to boli entries, with manual processing options.
- **Expense Management**: Dedicated module for operators to track expenses, including file uploads for receipts.
- **Reporting & Dashboards**: Includes daily earnings/payments calendars, user-specific detail dashboards, and comprehensive financial summaries.
- **Communication**: WhatsApp reminder integration for pending boli payments and email-based database backup distribution.
- **User Management**: Operators have restricted access to manage other operators and viewers, including bulk user upload via Excel/CSV. Each user is assigned a sequential serial number based on creation order. System handles duplicate usernames by adding numeric suffixes (e.g., username1, username2) during bulk imports.
- **Role-based Navigation**: Viewer role has completely simplified navigation with only "My Account" and "My Profile" (renamed from Settings). Viewers are blocked from dashboard access both in frontend and backend API. Admin users have access to all operator functionalities plus admin-exclusive features.
- **Terminology**: "Auction" terminology has been globally replaced with "Boli".

### Core Architectural Decisions
- **Monorepo Structure**: Shared TypeScript types between frontend and backend.
- **Type Safety**: End-to-end type safety using TypeScript and Drizzle ORM.
- **Session-based Auth**: Chosen for enhanced security and session management.
- **Component-based UI**: Reusable UI components for a consistent design system.
- **Mobile-first Design**: Ensures responsiveness and optimal mobile experience.
- **Audit Trail**: Detailed transaction logging for compliance.
- **Data Isolation**: Dravya entries are completely separate to prevent interference with main application logic.
- **Admin Privilege Inheritance**: Admin users can access all operator functionalities plus admin-exclusive features (logs, user management, corpus settings). Backend uses `isAdminOrOperator` middleware to ensure proper access control.

## External Dependencies

### Core
- **@neondatabase/serverless**: PostgreSQL serverless connection.
- **drizzle-orm**: Type-safe database operations.
- **express**: Web framework.
- **passport**: Authentication middleware.
- **@tanstack/react-query**: Server state management.
- **@radix-ui/***: UI component primitives.
- **react-hook-form**: Form state management.
- **zod**: Schema validation.
- **SendGrid/Nodemailer**: For email distribution (database backups).

### Development Tools
- **drizzle-kit**: Database migrations.
- **tsx**: TypeScript execution.
- **esbuild**: Production bundling.
- **tailwindcss**: CSS framework.