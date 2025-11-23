# दान-दर्पण (Daan-Darpan) - Deployment Guide

## 🚀 Complete Installation Package for Local/Server Deployment

This package contains everything needed to run the Daan Darpan Temple Management System on your local machine or server.

## 📋 System Requirements

### Prerequisites
- **Node.js**: Version 18.0.0 or higher
- **PostgreSQL**: Version 12.0 or higher
- **Operating System**: Ubuntu 18+, CentOS 7+, macOS 10.15+, Windows 10+
- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: Minimum 1GB free space

### Hardware Recommendations
- **Local Use**: 2GB RAM, 10GB storage
- **Small Organization (1-50 users)**: 4GB RAM, 50GB storage
- **Medium Organization (50-200 users)**: 8GB RAM, 100GB storage

## 🛠️ Installation Instructions

### Step 1: Download and Extract
1. Download the `daan-darpan-deployment.zip` file
2. Extract to your desired location:
   ```bash
   unzip daan-darpan-deployment.zip
   cd daan-darpan
   ```

### Step 2: Run Installation Script
```bash
# Make scripts executable
chmod +x deploy/*.sh

# Run installation
./deploy/install.sh
```

The installation script will:
- ✅ Check Node.js version (installs if needed)
- ✅ Install PostgreSQL (if not present)
- ✅ Install npm dependencies
- ✅ Create environment configuration
- ✅ Set up directory structure

### Step 3: Configure Environment
Edit the `.env` file with your settings:
```bash
nano .env
```

**Required Settings:**
```env
# Database Configuration
DATABASE_URL=postgresql://daan_darpan_user:your_password@localhost:5432/daan_darpan

# Server Configuration
PORT=8484
HOST=0.0.0.0

# Security
SESSION_SECRET=your-unique-session-secret-key

# Email (Optional - for backups)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Step 4: Setup Database
```bash
./deploy/setup-database.sh
```

This will:
- ✅ Create PostgreSQL user and database
- ✅ Apply database schema
- ✅ Set up initial tables

### Step 5: Start Application
```bash
./deploy/start.sh
```

## 🌐 Server Configuration

### For Local Access Only
In `.env` file:
```env
HOST=127.0.0.1
PORT=8484
```
**Access URL**: `http://localhost:8484`

### For Network/Server Access
In `.env` file:
```env
HOST=0.0.0.0
PORT=8484
```
**Access URL**: `http://YOUR_SERVER_IP:8484`

### Custom Server IP Configuration
1. **Edit `.env` file**:
   ```env
   HOST=192.168.1.100  # Your specific server IP
   PORT=8484
   ```

2. **Configure Firewall** (if needed):
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 8484

   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-port=8484/tcp
   sudo firewall-cmd --reload
   ```

## 🔧 Manual Commands

### Start Application
```bash
npm run start
```

### Development Mode
```bash
npm run dev
```

### Build Application
```bash
npm run build
```

### Database Operations
```bash
# Push schema changes
npm run db:push

# Force push (if conflicts)
npm run db:push --force
```

## 📁 Directory Structure
```
daan-darpan/
├── client/           # Frontend React application
├── server/           # Backend Express server
├── shared/           # Shared TypeScript types
├── uploads/          # File storage directory
├── deploy/           # Deployment scripts
├── .env              # Environment configuration
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## 🎯 Default Login Credentials

**Admin Account:**
- Username: `admin`
- Password: `admin123`

**⚠️ IMPORTANT**: Change default password immediately after first login!

## 🔄 Maintenance

### Backup Database
```bash
pg_dump daan_darpan > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
psql daan_darpan < backup_20240920.sql
```

### Update Application
1. Replace application files (keep `.env` and `uploads/`)
2. Run: `npm install`
3. Run: `npm run db:push`
4. Restart: `./deploy/start.sh`

## 🌐 Network Access Setup

### For LAN Access (Same Network)
1. Set `HOST=0.0.0.0` in `.env`
2. Find server IP: `ip addr show` (Linux) or `ipconfig` (Windows)
3. Access from other computers: `http://SERVER_IP:8484`

### For Internet Access (Public Server)
1. Set `HOST=0.0.0.0` in `.env`
2. Configure router port forwarding (port 8484)
3. Access via public IP: `http://PUBLIC_IP:8484`
4. **Recommended**: Use SSL certificate and domain name

## ❗ Troubleshooting

### Application Won't Start
```bash
# Check logs
npm run dev

# Check port usage
netstat -tulpn | grep 8484

# Kill existing process
pkill -f "node.*8484"
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Test connection
psql -h localhost -U daan_darpan_user -d daan_darpan
```

### Permission Issues
```bash
# Fix uploads directory
chmod 755 uploads
chown -R $USER:$USER uploads

# Fix script permissions
chmod +x deploy/*.sh
```

## 📞 Support

For technical support or issues:
1. Check logs in the terminal
2. Verify database connectivity
3. Ensure all dependencies are installed
4. Check firewall settings for network access

## 🔒 Security Recommendations

1. **Change default credentials** immediately
2. **Use strong SESSION_SECRET** (minimum 32 characters)
3. **Enable firewall** for server deployments
4. **Regular backups** of database and uploads
5. **Use HTTPS** for production deployments
6. **Keep system updated** with security patches

---

**🌟 दान-दर्पण Temple Management System**  
Version: 1.0.0  
Developed for श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति