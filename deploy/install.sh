#!/bin/bash

echo "🚀 Installing Daan Darpan Temple Management System..."

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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    print_status "Visit: https://nodejs.org/en/download/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL is not installed."
    print_status "Installing PostgreSQL..."
    
    # Detect OS and install PostgreSQL
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
        # CentOS/RHEL
        elif command -v yum &> /dev/null; then
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
        else
            print_error "Unsupported Linux distribution. Please install PostgreSQL manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install postgresql
            brew services start postgresql
        else
            print_error "Homebrew not found. Please install PostgreSQL manually."
            exit 1
        fi
    else
        print_error "Unsupported operating system. Please install PostgreSQL manually."
        exit 1
    fi
fi

print_success "PostgreSQL detected"

# Install npm dependencies
print_status "Installing npm dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install npm dependencies"
    exit 1
fi

print_success "Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_warning "Please update the .env file with your database credentials and other settings"
    print_status "Edit .env file: nano .env"
else
    print_warning ".env file already exists. Please verify your settings."
fi

# Create uploads directory
print_status "Creating uploads directory..."
mkdir -p uploads
chmod 755 uploads

print_success "Setup completed!"
print_status ""
print_status "Next steps:"
print_status "1. Update your .env file with database credentials"
print_status "2. Run: ./deploy/setup-database.sh to setup the database"
print_status "3. Run: npm run start to start the application"
print_status ""
print_status "The application will be available at: http://localhost:8484"