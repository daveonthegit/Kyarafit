#!/bin/bash

# Kyarafit Project Startup Script
# This script starts all services for the complete Kyarafit project

set -e

echo "🌸 Starting Kyarafit Project..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start after $max_attempts attempts${NC}"
    return 1
}

# Function to start service in background
start_service() {
    local service_name=$1
    local port=$2
    local command=$3
    local working_dir=$4
    
    if check_port $port; then
        echo -e "${YELLOW}⚠️  Port $port is already in use. $service_name might already be running.${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🚀 Starting $service_name...${NC}"
    cd "$working_dir"
    nohup $command > /tmp/kyarafit-$service_name.log 2>&1 &
    echo $! > /tmp/kyarafit-$service_name.pid
    cd - > /dev/null
}

# Start PostgreSQL Database
echo -e "${PINK}📊 Starting PostgreSQL Database...${NC}"
if check_port 5433; then
    echo -e "${YELLOW}⚠️  PostgreSQL is already running on port 5433${NC}"
else
    docker-compose up -d postgres
    echo -e "${GREEN}✅ PostgreSQL started${NC}"
fi

# Wait for PostgreSQL to be ready
sleep 5

# Start Backend API
echo -e "${PINK}🔧 Starting Backend API...${NC}"
start_service "backend" "8080" "go run main.go" "/Users/admin/Documents/Kyarafit/backend"

# Start Web Application
echo -e "${PINK}🌐 Starting Web Application...${NC}"
start_service "web" "3000" "npm run dev" "/Users/admin/Documents/Kyarafit/web"

# Start Image Service
echo -e "${PINK}🖼️  Starting Image Service...${NC}"
start_service "image-service" "8000" "python3 -m uvicorn main:app --reload --port 8000 --host 0.0.0.0" "/Users/admin/Documents/Kyarafit/image-service"

# Start Mobile App (Expo)
echo -e "${PINK}📱 Starting Mobile App (Expo)...${NC}"
if command -v npx >/dev/null 2>&1; then
    start_service "mobile" "19000" "npx expo start --port 19000" "/Users/admin/Documents/Kyarafit/mobile"
else
    echo -e "${YELLOW}⚠️  npx not found. Please install Node.js and npm to run the mobile app${NC}"
    echo -e "${YELLOW}   You can start it manually with: cd mobile && npx expo start${NC}"
fi

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
wait_for_service "http://localhost:8080/health" "Backend API"
wait_for_service "http://localhost:3000" "Web Application"
wait_for_service "http://localhost:8000/docs" "Image Service"

echo ""
echo -e "${GREEN}🎉 All services are running!${NC}"
echo "=================================="
echo -e "${BLUE}🌐 Web Application:${NC} http://localhost:3000"
echo -e "${BLUE}📱 Mobile App:${NC} http://localhost:19000 (Expo DevTools)"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:8080"
echo -e "${BLUE}🖼️  Image Service:${NC} http://localhost:8000"
echo -e "${BLUE}📊 PostgreSQL:${NC} localhost:5433"
echo ""
echo -e "${YELLOW}📋 Available Commands:${NC}"
echo "  • View logs: tail -f /tmp/kyarafit-<service>.log"
echo "  • Stop service: kill \$(cat /tmp/kyarafit-<service>.pid)"
echo "  • Stop all: ./stop-project.sh"
echo ""
echo -e "${PINK}🌸 Happy coding with Kyarafit!${NC}"
