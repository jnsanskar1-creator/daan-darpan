# Localhost Setup Guide - Shivnagar Jain Temple Account Ledger

This guide provides step-by-step instructions to run the Account Ledger Management System on your local machine.

## Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js** (version 18 or higher)
   ```bash
   # Check if Node.js is installed
   node --version
   npm --version
   ```

2. **PostgreSQL** (version 12 or higher)
   ```bash
   # Check if PostgreSQL is installed
   psql --version
   ```

3. **Git** (for cloning the repository)
   ```bash
   git --version
   ```

## Step 1: Clone and Setup Project

```bash
# 1. Clone the repository (if not already done)
git clone <your-repository-url>
cd <project-directory>

# 2. Install dependencies
npm install
```

## Step 2: Database Setup

### Option A: Local PostgreSQL Database

```bash
# 1. Start PostgreSQL service (varies by OS)
# On macOS with Homebrew:
brew services start postgresql

# On Ubuntu/Debian:
sudo systemctl start postgresql

# On Windows (if installed as service):
net start postgresql-x64-<version>

# 2. Create database and user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE temple_ledger;
CREATE USER temple_admin WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE temple_ledger TO temple_admin;
\q
```

### Option B: Use Neon Database (Recommended)

1. Go to [Neon Database](https://neon.tech)
2. Create a free account
3. Create a new database project
4. Copy the connection string

## Step 3: Environment Configuration

```bash
# 1. Create environment file
cp .env.example .env

# 2. Edit .env file with your database credentials
nano .env
```

Add the following to your `.env` file:

```env
# Database Configuration
DATABASE_URL=postgresql://temple_admin:your_secure_password@localhost:5432/temple_ledger

# Or for Neon Database:
# DATABASE_URL=postgresql://username:password@host.neon.tech/dbname?sslmode=require

# Session Configuration
SESSION_SECRET=your_very_secure_random_string_here

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Step 4: Database Schema Setup

### Option A: Import from Existing Database (Recommended)

```bash
# 1. Export schema and data from your existing database
# Replace with your production/existing database URL
pg_dump "postgresql://username:password@host:port/dbname" --schema-only > schema.sql
pg_dump "postgresql://username:password@host:port/dbname" --data-only > data.sql

# 2. Import schema to local database
psql -d temple_ledger -U temple_admin -f schema.sql

# 3. Import data to local database
psql -d temple_ledger -U temple_admin -f data.sql

# 4. Verify import was successful
npm run db:studio
```

### Option B: Create Fresh Schema (Only if no existing data)

```bash
# 1. Push database schema (creates all tables)
npm run db:push

# 2. Verify tables were created
npm run db:studio
# This opens Drizzle Studio in your browser to view the database
```

## Step 5: Database Migration Methods

### Method 1: Full Database Clone (Complete Migration)

```bash
# 1. Create complete dump from existing database
pg_dump "postgresql://existing_user:password@existing_host:port/existing_db" > complete_backup.sql

# 2. Restore to local database
psql -d temple_ledger -U temple_admin -f complete_backup.sql

# 3. Verify migration
psql -d temple_ledger -U temple_admin -c "SELECT COUNT(*) FROM users;"
psql -d temple_ledger -U temple_admin -c "SELECT COUNT(*) FROM entries;"
```

### Method 2: Schema + Selective Data Migration

```bash
# 1. Export only schema structure
pg_dump "postgresql://existing_user:password@existing_host:port/existing_db" --schema-only > schema_only.sql

# 2. Export specific tables data
pg_dump "postgresql://existing_user:password@existing_host:port/existing_db" --data-only --table=users > users_data.sql
pg_dump "postgresql://existing_user:password@existing_host:port/existing_db" --data-only --table=entries > entries_data.sql

# 3. Import schema first
psql -d temple_ledger -U temple_admin -f schema_only.sql

# 4. Import data selectively
psql -d temple_ledger -U temple_admin -f users_data.sql
psql -d temple_ledger -U temple_admin -f entries_data.sql
```

### Method 3: Using Drizzle Migration (If no existing data to preserve)

```bash
# 1. Generate migration from current schema
npm run db:generate

# 2. Apply migration to local database
npm run db:migrate

# 3. Create initial admin user (only if no existing users)
psql -d temple_ledger -U temple_admin -c "
INSERT INTO users (username, password, name, email, mobile, address, role, status) 
VALUES ('admin', 'admin123', 'Administrator', 'admin@temple.org', '9999999999', 'Temple Address', 'admin', 'active')
ON CONFLICT (username) DO NOTHING;
"
```

## Step 6: Start the Application

```bash
# Start the development server
npm run dev
```

This command will:
- Start the Express.js backend server on port 5000
- Start the Vite frontend development server
- Enable hot reloading for both frontend and backend

## Step 7: Access the Application

1. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

2. **Login with admin credentials:**
   - Username: `admin`
   - Password: `admin123`

## Step 8: Verify Setup

Once logged in, verify the following features work:

1. **Dashboard** - View summary statistics
2. **User Management** - Create new users
3. **Entry Management** - Create auction entries
4. **Payment Recording** - Record payments against entries
5. **Dravya Entries** - Create spiritual donations
6. **Expense Entries** - Record expenses (operator role)

## Database Migration Verification

After importing your existing database, verify the migration:

```bash
# 1. Check all tables exist
psql -d temple_ledger -U temple_admin -c "\dt"

# 2. Verify row counts match
psql -d temple_ledger -U temple_admin -c "
SELECT 
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 
  'entries' as table_name, COUNT(*) as row_count FROM entries
UNION ALL
SELECT 
  'dravya_entries' as table_name, COUNT(*) as row_count FROM dravya_entries
UNION ALL
SELECT 
  'expense_entries' as table_name, COUNT(*) as row_count FROM expense_entries
UNION ALL
SELECT 
  'transaction_logs' as table_name, COUNT(*) as row_count FROM transaction_logs;
"

# 3. Test a sample query
psql -d temple_ledger -U temple_admin -c "SELECT username, name, role FROM users LIMIT 5;"
```

## Remote Database Connection (Alternative)

Instead of local database, you can connect directly to your existing database:

```bash
# In your .env file, use your existing database URL:
DATABASE_URL=postgresql://your_existing_user:password@your_host:port/your_database

# Then start the application normally:
npm run dev
```

**Note:** This connects directly to your production/existing database, so be careful with modifications.

## Common Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
ps aux | grep postgres

# Test database connection
psql -d temple_ledger -U temple_admin -c "SELECT 1;"
```

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

### Node.js Version Issues

```bash
# Install Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 18
nvm install 18
nvm use 18
```

### Dependencies Issues

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
npm run db:push      # Apply schema changes
npm run db:studio    # Open database browser
npm run db:generate  # Generate migrations

# Type checking
npm run type-check
```

## File Upload Configuration

Ensure the uploads directory exists and has proper permissions:

```bash
# Create uploads directory
mkdir -p uploads

# Set permissions (Unix/Linux/macOS)
chmod 755 uploads
```

## Production Deployment Notes

For production deployment:

1. **Environment Variables:**
   - Use strong SESSION_SECRET
   - Use production database URL
   - Set NODE_ENV=production

2. **Security:**
   - Enable HTTPS
   - Configure proper CORS settings
   - Use environment variables for sensitive data

3. **Database:**
   - Use connection pooling
   - Regular backups
   - Monitor performance

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure database is accessible
4. Check file permissions for uploads directory

---

**System Requirements:**
- Node.js 18+
- PostgreSQL 12+
- 2GB RAM minimum
- 1GB disk space

**Browser Compatibility:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

*Last Updated: July 27, 2025*