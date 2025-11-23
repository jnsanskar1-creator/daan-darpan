# 🏛️ दान-दर्पण Local Installation Package

## Package Contents
**File:** `daan-darpan-local-v1.0.tar.gz`
**Size:** Complete application with all dependencies
**Target:** Ubuntu/Debian Linux systems

## Prerequisites Installation

### 1. Install Node.js (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PostgreSQL (v14+)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Install Git
```bash
sudo apt install git
```

## Installation Steps

### 1. Extract Package
```bash
# Create directory and extract
mkdir -p ~/Desktop/daan-darpan-local
cd ~/Desktop/daan-darpan-local
tar -xzf ~/Downloads/daan-darpan-local-v1.0.tar.gz
```

### 2. Run Setup Script
```bash
# Make setup script executable and run
chmod +x setup.sh
./setup.sh
```

### 3. Configure Database
```bash
# Setup PostgreSQL database
sudo -u postgres psql -f setup_database.sql

# Edit environment variables
nano .env
# Update DATABASE_URL, PGUSER, PGPASSWORD as needed
```

### 4. Initialize Database Schema
```bash
# Install dependencies and setup database
npm install
npm run db:push
```

### 5. Start Application
```bash
# Development mode (recommended for testing)
npm run dev

# Production mode
npm run build
npm start
```

## Access Points

- **Local Network:** http://223.190.85.106:5000
- **Localhost:** http://localhost:5000

## Default Credentials

- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Important:** Change the default password immediately after first login

## Key Features Included

✅ **Complete Authentication System**
- Role-based access (Admin, Operator, Viewer)
- Session management

✅ **Financial Management**
- Boli entries with payment tracking
- Dravya entries for spiritual donations
- Expense management with receipts
- Advance payments system
- Previous outstanding records

✅ **Reporting & Analytics**
- Dashboard with real-time calculations
- Daily earnings and payment calendars
- Comprehensive financial summaries
- Hindi receipt generation

✅ **User Management**
- Bulk user upload via Excel/CSV
- Role-based navigation and access control

## File Structure
```
daan-darpan-local/
├── client/              # React frontend
├── server/              # Express.js backend
├── shared/              # Shared TypeScript types
├── uploads/             # File uploads directory
├── .env.example         # Environment template
├── setup.sh             # Automated setup script
└── README.md           # Detailed documentation
```

## Support & Maintenance

1. **Regular Backups:** Backup PostgreSQL database weekly
2. **Updates:** Keep Node.js and PostgreSQL updated
3. **Security:** Use strong passwords and enable firewall
4. **Monitoring:** Check application logs regularly

## Troubleshooting

**Common Issues:**

1. **Port 5000 in use:**
   ```bash
   sudo lsof -t -i:5000 | xargs kill -9
   ```

2. **Database connection error:**
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check credentials in `.env` file

3. **Permission issues:**
   ```bash
   sudo chown -R $(whoami) ~/Desktop/daan-darpan-local
   ```

## System Requirements

- **OS:** Ubuntu 20.04+ or Debian 11+
- **RAM:** Minimum 2GB, Recommended 4GB
- **Storage:** 500MB for application + database size
- **Network:** Local network access for multi-user setup

---

**Developed for:** श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति शिवनगर, जबलपुर  
**Version:** 1.0  
**Package Date:** August 17, 2025