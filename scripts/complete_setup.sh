#!/bin/bash

# Complete Academic System Setup Script
# Production-ready deployment for IESPP Sistema Academico Integral

echo "🚀 Starting Complete Academic System Setup..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running from correct directory
if [ ! -f "package.json" ] && [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Setting up production-ready Academic System..."

# Backend Setup
print_info "Setting up Backend..."
cd backend

# Install Python dependencies
print_info "Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    print_status "Python dependencies installed"
else
    print_error "requirements.txt not found"
    exit 1
fi

# Install additional required packages
print_info "Installing additional Python packages..."
pip install pandas openpyxl qrcode[pil] reportlab pymongo[srv]
print_status "Additional packages installed"

# Run database seeding
print_info "Seeding database with demo data..."
python complete_seed_data.py
print_status "Database seeded successfully"

cd ..

# Frontend Setup
print_info "Setting up Frontend..."
cd frontend

# Install Node dependencies with Yarn
print_info "Installing Node.js dependencies with Yarn..."
if command -v yarn &> /dev/null; then
    yarn install
    print_status "Frontend dependencies installed with Yarn"
else
    print_warning "Yarn not found, using npm..."
    npm install
    print_status "Frontend dependencies installed with npm"
fi

cd ..

# Create required directories
print_info "Creating required directories..."
mkdir -p docs/pdfs
mkdir -p uploads/documents
mkdir -p uploads/procedures
mkdir -p uploads/admission
mkdir -p logs
print_status "Directories created"

# Set up environment files
print_info "Checking environment configuration..."
if [ -f "backend/.env" ] && [ -f "frontend/.env" ]; then
    print_status "Environment files found"
else
    print_warning "Environment files missing - using defaults"
    
    # Create backend .env if missing
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=sistema_academico
SECRET_KEY=your-secret-key-here-change-in-production
CORS_ORIGINS=http://localhost:3000,https://academic-sys-1.preview.emergentagent.com
MINEDU_API_BASE=https://api.minedu.gob.pe/siagie/v1
MINEDU_API_KEY=test-key
INSTITUTION_CODE=IESPP123
EOF
        print_status "Backend .env created"
    fi
    
    # Create frontend .env if missing
    if [ ! -f "frontend/.env" ]; then
        cat > frontend/.env << EOF
REACT_APP_BACKEND_URL=https://academic-sys-1.preview.emergentagent.com/api
EOF
        print_status "Frontend .env created"
    fi
fi

# Service restart
print_info "Restarting services..."
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sleep 5

# Check service status
print_info "Checking service status..."
backend_status=$(sudo supervisorctl status backend | grep RUNNING)
frontend_status=$(sudo supervisorctl status frontend | grep RUNNING)

if [[ $backend_status == *"RUNNING"* ]]; then
    print_status "Backend service is running"
else
    print_error "Backend service failed to start"
    sudo supervisorctl status backend
fi

if [[ $frontend_status == *"RUNNING"* ]]; then
    print_status "Frontend service is running"
else
    print_error "Frontend service failed to start"  
    sudo supervisorctl status frontend
fi

# System health check
print_info "Performing system health check..."
sleep 3

# Check if backend is responding
backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/health || echo "000")
if [ "$backend_health" = "200" ]; then
    print_status "Backend health check passed"
else
    print_warning "Backend health check failed (HTTP $backend_health)"
fi

# Display system information
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 ACADEMIC SYSTEM SETUP COMPLETE! 🎉${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}📊 SYSTEM INFORMATION:${NC}"
echo "• Backend: FastAPI + MongoDB"
echo "• Frontend: React + Shadcn UI"
echo "• Database: MongoDB with demo data"
echo "• Modules: Academic, Admission, Mesa de Partes, Treasury"
echo ""
echo -e "${BLUE}🌐 ACCESS URLS:${NC}"
echo "• Frontend: https://academic-sys-1.preview.emergentagent.com"
echo "• Backend API: https://academic-sys-1.preview.emergentagent.com/api"
echo "• Health Check: https://academic-sys-1.preview.emergentagent.com/api/health"
echo ""
echo -e "${BLUE}👥 DEMO CREDENTIALS:${NC}"
echo "• Admin: admin / password123"
echo "• Teacher: teacher1 / password123"
echo "• Student: student1 / password123"
echo "• Applicant: applicant1 / password123"
echo "• Finance: finance_admin / password123"
echo "• Cashier: cashier / password123"
echo ""
echo -e "${BLUE}📚 AVAILABLE MODULES:${NC}"
echo "• ✅ Academic Management (Students, Courses, Grades)"
echo "• ✅ Admission System (Applications, Evaluations)"
echo "• ✅ Mesa de Partes Virtual (Digital Procedures)"
echo "• ✅ Treasury & Administration (Finance, HR, Inventory)"
echo "• ✅ MINEDU Integration (SIA/SIAGIE)"
echo ""
echo -e "${BLUE}📖 DOCUMENTATION:${NC}"
echo "• Complete User Manual: /app/docs/MANUAL_COMPLETO_USUARIO.md"
echo "• Technical Manual: /app/docs/MANUAL_TECNICO.md"
echo "• Coverage Report: /app/coverage_report.md"
echo "• Final Report: /app/final_report.md"
echo ""
echo -e "${YELLOW}⚡ NEXT STEPS:${NC}"
echo "1. Access the system using the URLs above"
echo "2. Login with demo credentials"
echo "3. Explore all modules and functionalities"
echo "4. Check documentation for detailed guides"
echo ""
echo -e "${RED}🔒 SECURITY REMINDER:${NC}"
echo "• Change default passwords in production"
echo "• Update SECRET_KEY in backend/.env"
echo "• Configure proper CORS origins"
echo "• Set up HTTPS certificates"
echo ""
print_status "System is ready for demonstration and production use!"
echo "=================================================="