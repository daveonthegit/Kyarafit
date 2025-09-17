#!/bin/bash

# Node.js Upgrade Script for Kyarafit
# This script helps upgrade Node.js to version 18+

set -e

# Colors for output
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

echo "🔧 Node.js Upgrade Helper for Kyarafit"
echo "======================================"

# Check current Node.js version
if command -v node &> /dev/null; then
    CURRENT_VERSION=$(node -v)
    MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    print_status "Current Node.js version: $CURRENT_VERSION"
    
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        print_success "Node.js version is already 18+! No upgrade needed."
        exit 0
    fi
else
    print_error "Node.js is not installed."
    MAJOR_VERSION=0
fi

echo ""
print_status "Kyarafit requires Node.js 18+ for development."
echo ""

# Check if nvm is installed
if command -v nvm &> /dev/null; then
    print_status "Found nvm! Using nvm to install Node.js 18..."
    nvm install 18
    nvm use 18
    print_success "Node.js 18 installed and activated!"
elif command -v brew &> /dev/null; then
    print_status "Found Homebrew! Installing Node.js 18..."
    brew install node@18
    brew link node@18 --force
    print_success "Node.js 18 installed via Homebrew!"
else
    print_warning "Neither nvm nor Homebrew found."
    echo ""
    print_status "Please install Node.js 18+ manually:"
    echo "1. Visit https://nodejs.org/"
    echo "2. Download and install Node.js 18 LTS"
    echo "3. Or install nvm first: https://github.com/nvm-sh/nvm"
    echo "4. Then run: nvm install 18 && nvm use 18"
    echo ""
    print_status "After installing, run: ./setup.sh"
    exit 1
fi

# Verify installation
if command -v node &> /dev/null; then
    NEW_VERSION=$(node -v)
    NEW_MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NEW_MAJOR_VERSION" -ge 18 ]; then
        print_success "Node.js upgraded successfully!"
        print_success "New version: $NEW_VERSION"
        echo ""
        print_status "You can now run: ./setup.sh"
    else
        print_error "Upgrade failed. Please try again or install manually."
        exit 1
    fi
else
    print_error "Node.js installation failed. Please install manually."
    exit 1
fi
