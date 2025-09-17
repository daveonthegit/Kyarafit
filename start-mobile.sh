#!/bin/bash

# Kyarafit Mobile App Startup Script
# This script starts only the mobile app for development

set -e

echo "📱 Starting Kyarafit Mobile App..."
echo "=================================="

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

# Start the mobile app
echo -e "${PINK}🚀 Starting Expo development server...${NC}"
echo -e "${YELLOW}📱 Make sure you have the Expo Go app installed on your phone${NC}"
echo -e "${YELLOW}   Download from: https://expo.dev/client${NC}"
echo ""

# Check if port 19000 is already in use
if lsof -Pi :19000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 19000 is already in use. Mobile app might already be running.${NC}"
    echo -e "${BLUE}📱 Expo DevTools: http://localhost:19000${NC}"
    exit 0
fi

# Start Expo in background
echo -e "${BLUE}🚀 Starting Expo in background...${NC}"
nohup npx expo start --port 19000 > /tmp/kyarafit-mobile.log 2>&1 &
echo $! > /tmp/kyarafit-mobile.pid

# Wait a moment for Expo to start
sleep 5

# Check if it started successfully
if [ -f "/tmp/kyarafit-mobile.pid" ] && ps -p $(cat /tmp/kyarafit-mobile.pid) > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Mobile app started successfully!${NC}"
else
    echo -e "${RED}❌ Failed to start mobile app. Check logs: tail -f /tmp/kyarafit-mobile.log${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Mobile app development server started!${NC}"
echo "=================================="
echo -e "${BLUE}📱 Expo DevTools:${NC} http://localhost:19000"
echo -e "${BLUE}📱 Scan QR code with Expo Go app${NC}"
echo ""
echo -e "${YELLOW}📋 Available Commands:${NC}"
echo "  • Press 'i' to open iOS simulator"
echo "  • Press 'a' to open Android emulator"
echo "  • Press 'w' to open in web browser"
echo "  • Press 'r' to reload the app"
echo "  • Press 'm' to toggle the menu"
echo "  • Press 'c' to clear cache and restart"
echo "  • Press 'q' to quit"
echo ""
echo -e "${PINK}🌸 Happy mobile development with Kyarafit!${NC}"
