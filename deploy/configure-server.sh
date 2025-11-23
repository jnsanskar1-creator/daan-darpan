#!/bin/bash

echo "🔧 Configuring Daan Darpan for Server Deployment..."

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

print_header() {
    echo -e "${BLUE}==================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}==================================${NC}"
}

print_header "DAAN DARPAN SERVER CONFIGURATION"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider creating a dedicated user for the application."
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Not available")

print_status "Current server details:"
print_status "Local IP: $SERVER_IP"
print_status "Public IP: $PUBLIC_IP"

# Configuration options
echo ""
print_header "CONFIGURATION OPTIONS"
echo "1. Localhost only (127.0.0.1) - Access from this machine only"
echo "2. Local network (0.0.0.0) - Access from local network"
echo "3. Specific IP ($SERVER_IP) - Access from specific IP"
echo "4. Custom IP - Enter your own IP"
echo ""

read -p "Select configuration option (1-4): " choice

case $choice in
    1)
        HOST="127.0.0.1"
        print_status "Configured for localhost access only"
        ACCESS_URL="http://localhost:8484"
        ;;
    2)
        HOST="0.0.0.0"
        print_status "Configured for local network access"
        ACCESS_URL="http://$SERVER_IP:8484"
        ;;
    3)
        HOST="$SERVER_IP"
        print_status "Configured for specific IP access"
        ACCESS_URL="http://$SERVER_IP:8484"
        ;;
    4)
        read -p "Enter custom IP address: " CUSTOM_IP
        HOST="$CUSTOM_IP"
        print_status "Configured for custom IP access"
        ACCESS_URL="http://$CUSTOM_IP:8484"
        ;;
    *)
        print_error "Invalid option. Using default (0.0.0.0)"
        HOST="0.0.0.0"
        ACCESS_URL="http://$SERVER_IP:8484"
        ;;
esac

# Port configuration
read -p "Enter port number (default 8484): " PORT_INPUT
PORT=${PORT_INPUT:-8484}

# Update .env file
if [ -f .env ]; then
    # Update existing .env
    sed -i "s/^HOST=.*/HOST=$HOST/" .env
    sed -i "s/^PORT=.*/PORT=$PORT/" .env
    print_success "Updated existing .env file"
else
    # Create new .env from template
    cp deploy/production.env .env
    sed -i "s/^HOST=.*/HOST=$HOST/" .env
    sed -i "s/^PORT=.*/PORT=$PORT/" .env
    print_success "Created new .env file from template"
fi

# Security recommendations
echo ""
print_header "SECURITY CONFIGURATION"

# Check if default session secret is being used
if grep -q "CHANGE_THIS_TO_A_STRONG_RANDOM_STRING" .env; then
    print_warning "Default session secret detected. Generating secure session secret..."
    
    # Generate random session secret
    SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
    sed -i "s/CHANGE_THIS_TO_A_STRONG_RANDOM_STRING_32_CHARS_MINIMUM/$SESSION_SECRET/" .env
    print_success "Generated secure session secret"
fi

# Firewall configuration
echo ""
print_header "FIREWALL CONFIGURATION"

if [ "$HOST" != "127.0.0.1" ]; then
    print_status "Network access enabled. Checking firewall..."
    
    # Ubuntu/Debian UFW
    if command -v ufw &> /dev/null; then
        print_status "UFW detected. Would you like to open port $PORT? (y/n)"
        read -p "> " open_port
        if [ "$open_port" = "y" ] || [ "$open_port" = "Y" ]; then
            sudo ufw allow $PORT
            print_success "Port $PORT opened in UFW firewall"
        fi
    
    # CentOS/RHEL firewalld
    elif command -v firewall-cmd &> /dev/null; then
        print_status "Firewalld detected. Would you like to open port $PORT? (y/n)"
        read -p "> " open_port
        if [ "$open_port" = "y" ] || [ "$open_port" = "Y" ]; then
            sudo firewall-cmd --permanent --add-port=$PORT/tcp
            sudo firewall-cmd --reload
            print_success "Port $PORT opened in firewalld"
        fi
    
    else
        print_warning "No firewall detected or manual configuration required"
        print_status "Please ensure port $PORT is open for incoming connections"
    fi
fi

# Process management recommendation
echo ""
print_header "PROCESS MANAGEMENT"
print_status "For production deployment, consider using PM2 for process management:"
print_status "1. Install PM2: npm install -g pm2"
print_status "2. Start app: pm2 start 'npm start' --name daan-darpan"
print_status "3. Save config: pm2 save && pm2 startup"

# Final summary
echo ""
print_header "CONFIGURATION COMPLETE"
print_success "Server configuration completed successfully!"
print_status ""
print_status "Configuration Summary:"
print_status "• Host: $HOST"
print_status "• Port: $PORT"
print_status "• Access URL: $ACCESS_URL"
print_status ""
print_status "Next Steps:"
print_status "1. Run database setup: ./deploy/setup-database.sh"
print_status "2. Start application: ./deploy/start.sh"
print_status "3. Access application: $ACCESS_URL"
print_status ""
print_warning "Important: Change the default admin password after first login!"
print_status "Default credentials: admin / admin123"
print_status ""