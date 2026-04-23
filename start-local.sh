#!/bin/bash

echo "Starting Diamond Scanner application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

echo "1. Installing dependencies..."
npm install

echo "2. Building the Vue application..."
npm run build

echo "3. Starting the server..."
echo "=========================================="
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:3000"
echo "=========================================="
echo "Press Ctrl+C to stop"
echo ""

# Start the server
npm start