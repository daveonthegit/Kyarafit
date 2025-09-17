#!/bin/bash

# Kyarafit Mobile App Interactive Startup Script
# This script starts the mobile app in interactive mode (foreground)

set -e

echo "📱 Starting Kyarafit Mobile App (Interactive Mode)..."
echo "====================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

# Check if npx is available
if ! command -v npx >/dev/null 2>&1; then
    echo -e "${RED}❌ npx not found. Please install Node.js and npm first${NC}"
    echo -e "${YELLOW}   Visit: https://nodejs.org/ to install Node.js${NC}"
    exit 1
fi

# Check if Expo CLI is available
if ! npx expo --version >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Expo CLI not found. Installing...${NC}"
    npm install -g @expo/cli
fi

# Navigate to mobile directory
cd /Users/admin/Documents/Kyarafit/mobile

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in mobile directory${NC}"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing mobile app dependencies...${NC}"
    npm install
fi

# Start the mobile app in interactive mode
echo -e "${PINK}🚀 Starting Expo development server (Interactive Mode)...${NC}"
echo -e "${YELLOW}📱 Make sure you have the Expo Go app installed on your phone${NC}"
echo -e "${YELLOW}   Download from: https://expo.dev/client${NC}"
echo ""
echo -e "${BLUE}💡 Press Ctrl+C to stop the development server${NC}"
echo ""

npx expo start --port 19000
