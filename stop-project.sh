#!/bin/bash

# Kyarafit Project Stop Script
# This script stops all running Kyarafit services

set -e

echo "🛑 Stopping Kyarafit Project..."
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

# Function to stop service
stop_service() {
    local service_name=$1
    local port=$2
    local process_pattern=$3
    local pid_file="/tmp/kyarafit-$service_name.pid"
    local found_process=false
    
    # First try to stop using PID file
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${BLUE}🛑 Stopping $service_name (PID: $pid)...${NC}"
            kill $pid
            rm "$pid_file"
            echo -e "${GREEN}✅ $service_name stopped${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  PID file exists but process not running, cleaning up...${NC}"
            rm "$pid_file"
        fi
    fi
    
    # If no PID file or process not found, try to find by port
    if [ -n "$port" ] && lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        echo -e "${BLUE}🛑 Stopping $service_name on port $port (PID: $pid)...${NC}"
        kill $pid 2>/dev/null || true
        echo -e "${GREEN}✅ $service_name stopped${NC}"
        found_process=true
    fi
    
    # If still not found and we have a process pattern, try to find by process name
    if [ "$found_process" = false ] && [ -n "$process_pattern" ]; then
        local pids=$(pgrep -f "$process_pattern" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo -e "${BLUE}🛑 Stopping $service_name processes matching '$process_pattern' (PIDs: $pids)...${NC}"
            echo $pids | xargs kill 2>/dev/null || true
            echo -e "${GREEN}✅ $service_name stopped${NC}"
            found_process=true
        fi
    fi
    
    if [ "$found_process" = false ]; then
        echo -e "${YELLOW}⚠️  $service_name was not running${NC}"
    fi
}

# Stop all services
stop_service "backend" "8080"
stop_service "web" "3000"
stop_service "image-service" "8000"
stop_service "mobile" "19000"

# Stop PostgreSQL
echo -e "${BLUE}🛑 Stopping PostgreSQL...${NC}"
docker-compose down
echo -e "${GREEN}✅ PostgreSQL stopped${NC}"

# Clean up any remaining processes
echo -e "${BLUE}🧹 Cleaning up...${NC}"

# Kill any remaining processes on our ports (force kill if needed)
for port in 3000 19000 8080 8000; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        pids=$(lsof -ti:$port)
        echo -e "${YELLOW}⚠️  Force killing remaining processes on port $port (PIDs: $pids)${NC}"
        echo $pids | xargs kill -9 2>/dev/null || true
    fi
done

# Clean up any remaining PID files
rm -f /tmp/kyarafit-*.pid

echo ""
echo -e "${GREEN}🎉 All services stopped!${NC}"
echo "==============================="
echo -e "${PINK}🌸 Thanks for using Kyarafit!${NC}"
