#!/bin/bash

echo "🚀 Starting Daan Darpan Temple Management System..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    print_success "Environment loaded from .env"
else
    print_warning ".env file not found. Using default settings."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not installed. Installing..."
    npm install
fi

# Check if database is accessible
print_status "Checking database connection..."

# Build the application
print_status "Building application..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed. Please check the build logs."
    exit 1
fi

print_success "Application built successfully"

# Start the application
print_status "Starting server on host ${HOST:-0.0.0.0} port ${PORT:-8484}..."
print_status ""
print_success "🌟 Daan Darpan Temple Management System 🌟"
print_status "Application URL: http://${HOST:-localhost}:${PORT:-8484}"
print_status ""
print_status "Press Ctrl+C to stop the server"
print_status ""

# Start in production mode
NODE_ENV=production npm start