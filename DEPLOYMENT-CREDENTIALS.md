# 🔑 दान-दर्पण Database Credentials

## PostgreSQL Configuration

### Database Details:
- **Database Name**: `daan_darpan`
- **PostgreSQL User**: `daan_user`  
- **PostgreSQL Password**: `daan_password`
- **Host**: `localhost`
- **Port**: `5432`

### Environment Variables (.env):
```env
DATABASE_URL=postgresql://daan_user:daan_password@localhost:5432/daan_darpan
PGHOST=localhost
PGPORT=5432
PGUSER=daan_user
PGPASSWORD=daan_password
PGDATABASE=daan_darpan
```

### Database Setup Commands:
```sql
-- Run as PostgreSQL superuser (postgres)
CREATE USER daan_user WITH PASSWORD 'daan_password';
CREATE DATABASE daan_darpan WITH OWNER daan_user ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE daan_darpan TO daan_user;
```

### Quick Setup:
```bash
# Extract package
tar -xzf daan-darpan-local-v1.3.tar.gz
cd daan-darpan-local

# Run setup script
./setup.sh

# Setup PostgreSQL database
sudo -u postgres psql -f setup_database.sql

# Restore production backup
npm run restore database-backups/full_production_backup.sql.gz

# Start application
npm run dev
```

### Access:
- **Local**: http://localhost:5000
- **Network**: http://223.190.85.106:5000

---
**Package**: daan-darpan-local-v1.3.tar.gz  
**Updated**: August 17, 2025  
**Production Data**: Complete current database backup included