#!/bin/bash

# Bulk import tickets from tickets.json to Linear
# Usage: ./scripts/import-tickets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TICKETS_FILE="$SCRIPT_DIR/../tickets/tickets.json"

if [ ! -f "$TICKETS_FILE" ]; then
    echo "Error: tickets.json not found at $TICKETS_FILE"
    exit 1
fi

# Check if LINEAR_API_KEY is set
if [ -z "$LINEAR_API_KEY" ]; then
    # Try to load from .env.local
    if [ -f "$SCRIPT_DIR/../.env.local" ]; then
        export $(grep -v '^#' "$SCRIPT_DIR/../.env.local" | xargs)
    fi
fi

if [ -z "$LINEAR_API_KEY" ]; then
    echo "Error: LINEAR_API_KEY not set. Add it to .env.local or export it."
    exit 1
fi

# Get team ID for TIM
echo "Fetching team ID..."
TEAM_RESPONSE=$(curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  --data '{"query": "query { teams(filter: { key: { eq: \"TIM\" } }) { nodes { id } } }"}')

TEAM_ID=$(echo "$TEAM_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['teams']['nodes'][0]['id'])" 2>/dev/null)

if [ -z "$TEAM_ID" ]; then
    echo "Error: Could not find team TIM"
    echo "Response: $TEAM_RESPONSE"
    exit 1
fi

echo "Team ID: $TEAM_ID"

# Read tickets and create each one
echo "Creating tickets..."

TICKET_COUNT=$(python3 -c "import json; data=json.load(open('$TICKETS_FILE')); print(len(data['tickets']))")
echo "Found $TICKET_COUNT tickets to create"

# Create tickets using GraphQL mutations
python3 << 'PYTHON_SCRIPT'
import json
import os
import sys
import urllib.request

API_KEY = os.environ.get('LINEAR_API_KEY')
TEAM_ID = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('TEAM_ID')

# Load tickets
with open(os.environ.get('TICKETS_FILE', 'tickets/tickets.json')) as f:
    data = json.load(f)

tickets = data['tickets']

# Priority mapping (Linear: 0=none, 1=urgent, 2=high, 3=medium, 4=low)
priority_map = {1: 1, 2: 2, 3: 3, 4: 4}

created = []
failed = []

for i, ticket in enumerate(tickets):
    print(f"Creating ticket {i+1}/{len(tickets)}: {ticket['title'][:50]}...")

    # Escape description for GraphQL
    description = ticket['description'].replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    title = ticket['title'].replace('"', '\\"')
    priority = priority_map.get(ticket.get('priority', 3), 3)

    mutation = f'''
    mutation {{
      issueCreate(input: {{
        teamId: "{TEAM_ID}"
        title: "{title}"
        description: "{description}"
        priority: {priority}
      }}) {{
        success
        issue {{
          id
          identifier
          title
        }}
      }}
    }}
    '''

    req = urllib.request.Request(
        'https://api.linear.app/graphql',
        data=json.dumps({'query': mutation}).encode(),
        headers={
            'Content-Type': 'application/json',
            'Authorization': API_KEY
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if result.get('data', {}).get('issueCreate', {}).get('success'):
                issue = result['data']['issueCreate']['issue']
                created.append(issue)
                print(f"  ✓ Created {issue['identifier']}: {issue['title'][:40]}")
            else:
                failed.append({'ticket': ticket, 'error': result})
                print(f"  ✗ Failed: {result}")
    except Exception as e:
        failed.append({'ticket': ticket, 'error': str(e)})
        print(f"  ✗ Error: {e}")

print(f"\n{'='*50}")
print(f"Created: {len(created)} tickets")
print(f"Failed: {len(failed)} tickets")

if created:
    print(f"\nCreated tickets:")
    for issue in created:
        print(f"  {issue['identifier']}: {issue['title']}")
PYTHON_SCRIPT

echo ""
echo "Done!"
