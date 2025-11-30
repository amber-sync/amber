#!/bin/bash

# Simple ticket workflow helper
# Usage: ./scripts/next-ticket.sh [ticket-id]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TICKETS_FILE="$SCRIPT_DIR/../tickets/tauri-migration.md"

if [ -z "$1" ]; then
    echo "🎯 Amber Tauri Migration - Next Ticket"
    echo ""
    echo "Usage: ./scripts/next-ticket.sh <ticket-id>"
    echo ""
    echo "Recommended order:"
    echo "  1. TIM-100: Initialize Tauri project (FOUNDATION - do this first)"
    echo "  2. TIM-101: Set up Rust backend structure"
    echo "  3. TIM-102: Create Tauri command stubs"
    echo "  4. TIM-110: Port FileService to Rust"
    echo "  5. TIM-111: Port RsyncService to Rust"
    echo "  6. TIM-112: Port SnapshotService to Rust"
    echo "  7. TIM-116: Port store.ts and preferences.ts"
    echo "  8. TIM-103: Create frontend API abstraction layer"
    echo "  9. TIM-120: Update frontend for Tauri commands"
    echo " 10. TIM-121: Implement event streaming"
    echo " 11. TIM-130: Create test suite"
    echo " 12. TIM-131: Benchmark performance"
    echo " 13. TIM-132: Verify feature parity"
    echo " ... (see tickets/tauri-migration.md for full list)"
    echo ""
    exit 0
fi

TICKET_ID=$1

# Show ticket details
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Ticket: $TICKET_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Extract ticket section from markdown (simple grep)
if [ -f "$TICKETS_FILE" ]; then
    echo "Full details in: tickets/tauri-migration.md"
    echo ""
    # Try to find the ticket header
    grep -A 50 "#### $TICKET_ID:" "$TICKETS_FILE" | head -60 || echo "Ticket not found in markdown"
else
    echo "⚠️  tickets/tauri-migration.md not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Create branch: git checkout -b feature/$TICKET_ID-<description>"
echo "  2. Read full ticket in tickets/tauri-migration.md"
echo "  3. Implement the solution"
echo "  4. Test thoroughly"
echo "  5. Commit: git commit -m \"feat($TICKET_ID): <description>\""
echo "  6. Update Linear: ./scripts/linear.sh done $TICKET_ID"
echo ""
echo "Or use Claude Code Task tool:"
echo "  'Complete $TICKET_ID following the spec in tickets/tauri-migration.md'"
echo ""
