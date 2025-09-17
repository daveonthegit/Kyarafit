#!/bin/bash

# Kyarafit Setup Script
# This script sets up the development environment for Kyarafit

set -e

echo "🚀 Setting up Kyarafit development environment..."

# Colors for output
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

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check Go
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed. Please install Go 1.21+ from https://golang.org/"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3.11+ from https://python.org/"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker from https://docker.com/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose from https://docs.docker.com/compose/"
        exit 1
    fi
    
    print_success "All requirements are installed!"
}

# Setup environment files
setup_env_files() {
    print_status "Setting up environment files..."
    
    # Web environment
    if [ ! -f "web/.env" ]; then
        cp web/env.example web/.env
        print_success "Created web/.env"
    else
        print_warning "web/.env already exists, skipping..."
    fi
    
    # Mobile environment
    if [ ! -f "mobile/.env" ]; then
        cp mobile/env.example mobile/.env
        print_success "Created mobile/.env"
    else
        print_warning "mobile/.env already exists, skipping..."
    fi
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/env.example backend/.env
        print_success "Created backend/.env"
    else
        print_warning "backend/.env already exists, skipping..."
    fi
    
    # Image service environment
    if [ ! -f "image-service/.env" ]; then
        cp image-service/env.example image-service/.env
        print_success "Created image-service/.env"
    else
        print_warning "image-service/.env already exists, skipping..."
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Web dependencies
    print_status "Installing web dependencies..."
    cd web
    npm install
    cd ..
    print_success "Web dependencies installed"
    
    # Mobile dependencies
    print_status "Installing mobile dependencies..."
    cd mobile
    npm install
    cd ..
    print_success "Mobile dependencies installed"
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    go mod tidy
    cd ..
    print_success "Backend dependencies installed"
    
    # Image service dependencies
    print_status "Installing image service dependencies..."
    cd image-service
    pip install -r requirements.txt
    cd ..
    print_success "Image service dependencies installed"
}

# Start database
start_database() {
    print_status "Starting PostgreSQL database..."
    docker-compose up -d postgres
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Test database connection
    if docker-compose exec postgres pg_isready -U kyarafit; then
        print_success "Database is ready!"
    else
        print_error "Database failed to start"
        exit 1
    fi
}

# Setup database schema
setup_database() {
    print_status "Setting up database schema..."
    
    # Run Prisma migrations for web app
    cd web
    npx prisma generate
    npx prisma db push
    cd ..
    print_success "Database schema created"
}

# Build services
build_services() {
    print_status "Building services..."
    
    # Build web app
    print_status "Building web app..."
    cd web
    npm run build
    cd ..
    print_success "Web app built"
    
    # Build backend
    print_status "Building backend..."
    cd backend
    go build -o main .
    cd ..
    print_success "Backend built"
}

# Main setup function
main() {
    echo "🎭 Welcome to Kyarafit Setup!"
    echo "================================"
    
    check_requirements
    setup_env_files
    install_dependencies
    start_database
    setup_database
    build_services
    
    echo ""
    echo "🎉 Setup complete!"
    echo "================================"
    echo ""
    echo "To start the development environment:"
    echo "  docker-compose up"
    echo ""
    echo "Or start individual services:"
    echo "  Web:     cd web && npm run dev"
    echo "  Mobile:  cd mobile && npx expo start"
    echo "  Backend: cd backend && go run main.go"
    echo "  Images:  cd image-service && python main.py"
    echo ""
    echo "Web app: http://localhost:3000"
    echo "Backend API: http://localhost:8080"
    echo "Image service: http://localhost:8001"
    echo ""
    echo "Happy coding! 🚀"
}

# Run main function
main "$@"

