# 🗄️ Database Restoration Steps for दान-दर्पण

## Package: `daan-darpan-local-v1.1.tar.gz`

This updated package includes comprehensive database backup and restore functionality.

## Step-by-Step Restoration Process

### Step 1: Extract and Setup Application

```bash
# Create directory and extract package
mkdir -p ~/Desktop/daan-darpan-local
cd ~/Desktop/daan-darpan-local
tar -xzf ~/Downloads/daan-darpan-local-v1.1.tar.gz

# Run initial setup
chmod +x setup.sh scripts/*.sh
./setup.sh
```

### Step 2: Configure PostgreSQL Database

```bash
# Setup PostgreSQL database and user
sudo -u postgres psql -f setup_database.sql

# Verify database creation
sudo -u postgres psql -c "\l" | grep daan_darpan
```

### Step 3: Configure Environment

```bash
# Edit environment variables
nano .env

# Ensure these settings match your PostgreSQL:
# DATABASE_URL=postgresql://daan_user:daan_password@localhost:5432/daan_darpan
# PGHOST=localhost
# PGPORT=5432
# PGUSER=daan_user
# PGPASSWORD=daan_password
# PGDATABASE=daan_darpan
```

### Step 4: Choose Database Setup Method

#### Method A: Fresh Installation with Sample Data

```bash
# Install dependencies
npm install

# Create database schema
npm run db:push

# Create sample data for testing
npm run sample-data
```

**Sample Data Includes:**
- 5 users with different roles (admin, operator, viewer, sample members)
- Financial records: boli entries, payments, expenses, advance payments
- Corpus setting: ₹139,084
- Complete transaction history

**Login Credentials (Password: admin123):**
- `admin` - Full administrative access
- `operator1` - Operator role access  
- `viewer1` - Read-only access
- `ramesh_ji` - Sample temple member
- `sunita_devi` - Sample temple member

#### Method B: Restore from Production Backup

```bash
# Install dependencies
npm install

# Place your backup file
mkdir -p database-backups
cp /path/to/your/production-backup.sql.gz database-backups/

# Restore database (this will create schema automatically)
npm run restore database-backups/your-backup.sql.gz

# Or restore latest backup
npm run restore latest
```

### Step 5: Start Application

```bash
# Development mode (recommended for testing)
npm run dev

# Production mode
npm run build
npm start
```

### Step 6: Access Application

Open your browser and navigate to:
- **Local Network:** http://223.190.85.106:5000
- **Localhost:** http://localhost:5000

## Database Backup Operations

### Create Backup

```bash
# Create new backup
npm run backup

# Backup files stored in database-backups/ directory
# Format: daan_darpan_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Restore Backup

```bash
# Restore specific backup
npm run restore database-backups/daan_darpan_backup_20250817_120000.sql.gz

# Restore latest backup
npm run restore latest
```

## Backup File Structure

```
database-backups/
├── daan_darpan_backup_20250817_120000.sql.gz  # Timestamped backup
├── daan_darpan_backup_20250817_140000.sql.gz  # Another backup
├── latest_backup.sql.gz                       # Symlink to latest
└── restoration-logs/                          # Restore operation logs
```

## What's Included in Backups

### Core Data Tables
- **users** - All user accounts and authentication
- **boli_entries** - Auction/bid entries with payment tracking
- **boli_payments** - Individual payment records with receipts
- **advance_payments** - Prepaid amounts from users
- **expense_entries** - Temple expenses with documentation
- **dravya_entries** - Spiritual donations (separate system)
- **previous_outstanding_records** - Historical debt tracking

### Configuration & System
- **corpus_settings** - Temple capital/corpus amount
- **receipt_counter** - Auto-incrementing receipt numbers (SPDJMSJ format)
- **transaction_logs** - Complete audit trail for all operations

### Application Features Preserved
- Role-based access control (Admin, Operator, Viewer)
- Hindi receipt generation with proper formatting
- Payment tracking (pending, partial, full)
- Advance payment integration
- Comprehensive dashboard calculations
- Complete transaction history

## Verification Steps

After restoration, verify the application:

1. **Login Test**: Try logging in with admin credentials
2. **Dashboard Check**: Verify financial calculations are correct
3. **Data Integrity**: Check sample entries are visible
4. **Receipt Generation**: Test Hindi receipt creation
5. **Role Access**: Verify different user roles work properly

## Troubleshooting Common Issues

### 1. Database Connection Error
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify database exists
sudo -u postgres psql -l | grep daan_darpan

# Check credentials in .env
cat .env | grep DATABASE_URL
```

### 2. Backup/Restore Fails
```bash
# Check file permissions
ls -la scripts/
chmod +x scripts/*.sh

# Verify backup file exists
ls -la database-backups/

# Check PostgreSQL user permissions
sudo -u postgres psql -c "\du"
```

### 3. Application Won't Start
```bash
# Check if port 5000 is free
sudo netstat -tlnp | grep :5000

# Kill existing processes
pkill -f "tsx server/index.ts"
pkill -f "node dist/index.js"

# Check for Node.js errors
npm run dev
```

### 4. Missing Sample Data
```bash
# Recreate sample data
npm run sample-data

# Or restore from backup
npm run restore latest
```

## Production Deployment Checklist

- [ ] Extract package to production server
- [ ] Configure PostgreSQL with proper credentials
- [ ] Update .env with production settings
- [ ] Restore production backup or create sample data
- [ ] Test all user roles and functionality
- [ ] Set up automated daily backups
- [ ] Configure firewall for port 5000
- [ ] Set up process monitoring (PM2 recommended)
- [ ] Backup uploads/ directory separately
- [ ] Document admin credentials securely

## Automated Backup Setup

For production, set up automated daily backups:

```bash
# Add to crontab (run daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * cd /path/to/daan-darpan-local && npm run backup

# Weekly cleanup (keep only 30 days of backups)
0 3 * * 0 find /path/to/daan-darpan-local/database-backups -name "*.gz" -mtime +30 -delete
```

---

**Updated Package:** `daan-darpan-local-v1.1.tar.gz`  
**Release Date:** August 17, 2025  
**Features:** Complete backup/restore system, sample data generation, production-ready deployment