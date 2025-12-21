#!/bin/bash

# Setup script for infrastructure environment
# This script creates .env file from template if it doesn't exist

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$INFRA_DIR/.env"
ENV_TEMPLATE="$INFRA_DIR/env.template"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_TEMPLATE" ]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    echo "✅ Created $ENV_FILE from template"
    echo "⚠️  Please review and update $ENV_FILE with your configuration"
  else
    echo "❌ Error: $ENV_TEMPLATE not found"
    exit 1
  fi
else
  echo "ℹ️  $ENV_FILE already exists, skipping..."
fi

