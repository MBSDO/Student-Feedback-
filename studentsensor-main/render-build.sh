#!/usr/bin/env bash

npm install

if [ -f requirements.txt ]; then
  echo "📦 Installing Python dependencies..."
  pip install -r requirements.txt
fi
