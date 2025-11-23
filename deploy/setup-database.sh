#!/bin/bash

echo "🗄️ Setting up Daan Darpan Database..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    print_error ".env file not found. Please run ./deploy/install.sh first."
    exit 1
fi

# Extract database details from DATABASE_URL
DB_NAME="daan_darpan"
DB_USER=${DATABASE_USER:-"daan_darpan_user"}
DB_PASS=${DATABASE_PASSWORD:-"daan_darpan_pass"}
DB_HOST=${DATABASE_HOST:-"localhost"}
DB_PORT=${DATABASE_PORT:-"5432"}

print_status "Database configuration:"
print_status "Host: $DB_HOST"
print_status "Port: $DB_PORT"
print_status "Database: $DB_NAME"
print_status "User: $DB_USER"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
    print_warning "PostgreSQL is not running. Attempting to start..."
    
    # Try to start PostgreSQL service
    if command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql
    elif command -v service &> /dev/null; then
        sudo service postgresql start
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql
    else
        print_error "Could not start PostgreSQL. Please start it manually."
        exit 1
    fi
    
    # Wait for PostgreSQL to start
    sleep 3
    
    if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
        print_error "PostgreSQL failed to start. Please check the service status."
        exit 1
    fi
fi

print_success "PostgreSQL is running"

# Create database user and database
print_status "Creating database user and database..."

# Function to execute SQL as admin
execute_sql_as_admin() {
    local sql_commands="$1"
    
    # Try different methods to connect as admin
    
    # Method 1: Try postgres user (most common)
    if id "postgres" >/dev/null 2>&1; then
        print_status "Using postgres user..."
        sudo -u postgres psql <<< "$sql_commands"
        return $?
    fi
    
    # Method 2: Try current user with admin privileges
    if psql -d postgres -c "\l" >/dev/null 2>&1; then
        print_status "Using current user with admin privileges..."
        psql -d postgres <<< "$sql_commands"
        return $?
    fi
    
    # Method 3: Try root/admin user
    if sudo psql -d postgres -c "\l" >/dev/null 2>&1; then
        print_status "Using sudo with psql..."
        sudo psql -d postgres <<< "$sql_commands"
        return $?
    fi
    
    # Method 4: Try connecting without specifying user
    if psql postgres -c "\l" >/dev/null 2>&1; then
        print_status "Using default connection..."
        psql postgres <<< "$sql_commands"
        return $?
    fi
    
    return 1
}

# SQL commands to create user and database
SQL_COMMANDS="
-- Create user if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
"

# Execute SQL commands
if execute_sql_as_admin "$SQL_COMMANDS"; then
    print_success "Database and user created successfully"
else
    print_error "Failed to create database and user"
    print_status "Trying manual database creation..."
    
    # Try creating database manually with simpler commands
    print_status "Please run these commands manually in PostgreSQL:"
    echo ""
    echo "psql -d postgres"
    echo "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    echo "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    echo "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    echo "ALTER USER $DB_USER CREATEDB;"
    echo "\q"
    echo ""
    
    read -p "Have you created the database manually? (y/n): " manual_created
    if [ "$manual_created" != "y" ] && [ "$manual_created" != "Y" ]; then
        print_error "Database setup incomplete. Please create the database manually."
        exit 1
    fi
    
    print_success "Database setup completed manually"
fi

# Update DATABASE_URL in .env
NEW_DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"
sed -i "s|DATABASE_URL=.*|DATABASE_URL=$NEW_DATABASE_URL|" .env

print_status "Running database migrations..."

# Push database schema
npm run db:push

if [ $? -eq 0 ]; then
    print_success "Database schema created successfully"
else
    print_error "Failed to create database schema"
    exit 1
fi

print_success "Database setup completed!"
print_status ""
print_status "Database Details:"
print_status "• Database: $DB_NAME"
print_status "• User: $DB_USER"
print_status "• Host: $DB_HOST"
print_status "• Port: $DB_PORT"
print_status ""
print_status "You can now start the application with: npm run start"