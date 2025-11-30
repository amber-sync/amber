#!/bin/bash

# Linear API Helper Script
# Usage:
#   ./scripts/linear.sh list                           # List all tickets
#   ./scripts/linear.sh create "Title" "Description"   # Create ticket
#   ./scripts/linear.sh update TIM-XX "Description"    # Update ticket
#   ./scripts/linear.sh done TIM-XX                    # Mark as Done
#   ./scripts/linear.sh cancel TIM-XX                  # Cancel ticket
#   ./scripts/linear.sh view TIM-XX                    # View ticket details

set -e

# Configuration
LINEAR_API_KEY="${LINEAR_API_KEY:-lin_api_iET7hQbDEUsQxLIdiNF2QkS6JCJrdXogGH8Q884G}"
LINEAR_ENDPOINT="https://api.linear.app/graphql"
TEAM_ID="7621f957-2d9f-417f-bf41-bc25369a4df5"
STATE_TODO="8a3d82d7-7a32-4216-a313-057fa386fbf2"
STATE_DONE="7c9b8132-9436-4cdd-aa15-5668f709930f"

# Helper function to make GraphQL requests
linear_query() {
    local query="$1"
    curl -s -X POST "$LINEAR_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_KEY" \
        -d "$query"
}

# List all tickets
cmd_list() {
    local filter="${1:-Todo}"

    cat > /tmp/linear_query.json <<EOF
{
  "query": "query { issues(filter: { team: { key: { eq: \\"TIM\\" } }, state: { name: { eq: \\"$filter\\" } } }, orderBy: updatedAt) { nodes { identifier title state { name } updatedAt } } }"
}
EOF

    echo "📋 Linear Tickets (Status: $filter)"
    echo "─────────────────────────────────────"

    linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
issues = data['data']['issues']['nodes']
if not issues:
    print('  No tickets found')
else:
    for issue in issues:
        print(f\"  {issue['identifier']}: {issue['title']}\")
"
}

# Create a new ticket
cmd_create() {
    local title="$1"
    local description="$2"

    if [ -z "$title" ]; then
        echo "Error: Title required"
        echo "Usage: ./scripts/linear.sh create \"Title\" \"Description\""
        exit 1
    fi

    cat > /tmp/linear_query.json <<EOF
{
  "query": "mutation CreateIssue(\$teamId: String!, \$stateId: String!, \$title: String!, \$description: String!) { issueCreate(input: { teamId: \$teamId, stateId: \$stateId, title: \$title, description: \$description }) { success issue { id identifier title } } }",
  "variables": {
    "teamId": "$TEAM_ID",
    "stateId": "$STATE_TODO",
    "title": "$title",
    "description": "$description"
  }
}
EOF

    echo "📝 Creating ticket..."

    linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['data']['issueCreate']['success']:
    issue = data['data']['issueCreate']['issue']
    print(f\"✅ Created {issue['identifier']}: {issue['title']}\")
else:
    print('❌ Failed to create ticket')
    sys.exit(1)
"
}

# Create ticket from JSON file
cmd_create_from_file() {
    local file="$1"

    if [ ! -f "$file" ]; then
        echo "Error: File not found: $file"
        exit 1
    fi

    echo "📝 Creating ticket from $file..."

    linear_query @"$file" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['data']['issueCreate']['success']:
    issue = data['data']['issueCreate']['issue']
    print(f\"✅ Created {issue['identifier']}: {issue['title']}\")
else:
    print('❌ Failed to create ticket')
    print(json.dumps(data, indent=2))
    sys.exit(1)
"
}

# Update a ticket
cmd_update() {
    local identifier="$1"
    local description="$2"

    if [ -z "$identifier" ] || [ -z "$description" ]; then
        echo "Error: Identifier and description required"
        echo "Usage: ./scripts/linear.sh update TIM-XX \"Description\""
        exit 1
    fi

    # Get issue ID from identifier
    cat > /tmp/linear_query.json <<EOF
{
  "query": "query { issue(id: \\"$identifier\\") { id identifier title } }"
}
EOF

    local issue_id=$(linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['issue']['id'])
")

    # Update the issue
    cat > /tmp/linear_query.json <<EOF
{
  "query": "mutation UpdateIssue(\$issueId: String!, \$description: String!) { issueUpdate(id: \$issueId, input: { description: \$description }) { success issue { identifier title } } }",
  "variables": {
    "issueId": "$issue_id",
    "description": "$description"
  }
}
EOF

    echo "📝 Updating $identifier..."

    linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['data']['issueUpdate']['success']:
    issue = data['data']['issueUpdate']['issue']
    print(f\"✅ Updated {issue['identifier']}: {issue['title']}\")
else:
    print('❌ Failed to update ticket')
    sys.exit(1)
"
}

# Mark ticket as Done
cmd_done() {
    local identifier="$1"

    if [ -z "$identifier" ]; then
        echo "Error: Identifier required"
        echo "Usage: ./scripts/linear.sh done TIM-XX"
        exit 1
    fi

    # Get issue ID from identifier
    cat > /tmp/linear_query.json <<EOF
{
  "query": "query { issue(id: \\"$identifier\\") { id identifier title } }"
}
EOF

    local issue_id=$(linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['issue']['id'])
")

    # Update state to Done
    cat > /tmp/linear_query.json <<EOF
{
  "query": "mutation UpdateIssue(\$issueId: String!, \$stateId: String!) { issueUpdate(id: \$issueId, input: { stateId: \$stateId }) { success issue { identifier title state { name } } } }",
  "variables": {
    "issueId": "$issue_id",
    "stateId": "$STATE_DONE"
  }
}
EOF

    echo "✓ Marking $identifier as Done..."

    linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['data']['issueUpdate']['success']:
    issue = data['data']['issueUpdate']['issue']
    print(f\"✅ {issue['identifier']} → {issue['state']['name']}\")
else:
    print('❌ Failed to update ticket')
    sys.exit(1)
"
}

# View ticket details
cmd_view() {
    local identifier="$1"

    if [ -z "$identifier" ]; then
        echo "Error: Identifier required"
        echo "Usage: ./scripts/linear.sh view TIM-XX"
        exit 1
    fi

    cat > /tmp/linear_query.json <<EOF
{
  "query": "query { issue(id: \\"$identifier\\") { identifier title description state { name } createdAt updatedAt } }"
}
EOF

    linear_query @/tmp/linear_query.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
issue = data['data']['issue']
print(f\"\\n{'─' * 80}\")
print(f\"{issue['identifier']}: {issue['title']}\")
print(f\"{'─' * 80}\")
print(f\"Status: {issue['state']['name']}\")
print(f\"Created: {issue['createdAt']}\")
print(f\"Updated: {issue['updatedAt']}\")
print(f\"\\nDescription:\")
print(f\"{'─' * 80}\")
print(issue['description'])
print(f\"{'─' * 80}\\n\")
"
}

# Main command dispatcher
case "$1" in
    list|ls)
        cmd_list "${2:-Todo}"
        ;;
    create)
        cmd_create "$2" "$3"
        ;;
    create-file)
        cmd_create_from_file "$2"
        ;;
    update)
        cmd_update "$2" "$3"
        ;;
    done|complete)
        cmd_done "$2"
        ;;
    view|show)
        cmd_view "$2"
        ;;
    *)
        echo "Linear API Helper Script"
        echo ""
        echo "Usage:"
        echo "  ./scripts/linear.sh list [status]              # List tickets (default: Todo)"
        echo "  ./scripts/linear.sh create \"Title\" \"Desc\"     # Create ticket"
        echo "  ./scripts/linear.sh create-file file.json      # Create from JSON file"
        echo "  ./scripts/linear.sh update TIM-XX \"Desc\"       # Update ticket"
        echo "  ./scripts/linear.sh done TIM-XX                 # Mark as Done"
        echo "  ./scripts/linear.sh view TIM-XX                 # View details"
        echo ""
        echo "Examples:"
        echo "  ./scripts/linear.sh list"
        echo "  ./scripts/linear.sh list Done"
        echo "  ./scripts/linear.sh create \"Fix bug\" \"Description here\""
        echo "  ./scripts/linear.sh create-file /tmp/ticket.json"
        echo "  ./scripts/linear.sh done TIM-35"
        echo "  ./scripts/linear.sh view TIM-34"
        exit 1
        ;;
esac
