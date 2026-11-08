#!/bin/bash
set -e

echo "📦 Initializing dependencies..."
npm install

echo "🛡️ Verifying Docker runtime environment state..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: The Docker daemon process cannot be reached. Please verify Docker is running locally."
    exit 1
fi

echo "🚀 Booting Advanced Agent Harness project pipeline..."
npm start
