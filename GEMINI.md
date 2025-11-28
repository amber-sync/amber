# Agent Workflow Protocol

This section defines the automated workflow the Agent must follow when implementing features.

## 0. Accessing Linear Tickets

### API Configuration
- **API Key Location**: Stored in `.env.local` as `LINEAR_API_KEY`
- **GraphQL Endpoint**: `https://api.linear.app/graphql`
- **Team Key**: `TIM` (used in ticket identifiers like TIM-16, TIM-17, etc.)

### Fetching Todo Tickets

To retrieve all open tickets in the "Todo" state, use the following GraphQL query:

**Query**:
```graphql
query {
  issues(filter: { state: { name: { eq: "Todo" } } }) {
    nodes {
      id
      identifier
      title
      description
      state { name }
      priority
      team { key }
      createdAt
      updatedAt
    }
  }
}
```

**Curl Command**:
```bash
curl -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: lin_api_iET7hQbDEUsQxLIdiNF2QkS6JCJrdXogGH8Q884G" \
  --data '{"query": "query { issues(filter: { state: { name: { eq: \"Todo\" } } }) { nodes { id identifier title description state { name } priority team { key } createdAt updatedAt } } }"}'
```

**Response Format**:
```json
{
  "data": {
    "issues": {
      "nodes": [
        {
          "id": "37d654a9-dcaa-4c4b-ba8f-4326148cca45",
          "identifier": "TIM-30",
          "title": "Codebase Audit & Refactor",
          "description": "Comprehensive code review...",
          "state": { "name": "Todo" },
          "priority": 0,
          "team": { "key": "TIM" },
          "createdAt": "2025-11-28T10:39:35.064Z",
          "updatedAt": "2025-11-28T10:39:35.064Z"
        }
      ]
    }
  }
}
```

### Workflow
1. **Start of Session**: Run the fetch query to see all available Todo tickets
2. **Select Ticket**: Choose a ticket based on priority, dependencies, or user preference
3. **Implement**: Follow the Feature Implementation Cycle (Section 2)
4. **Update Status**: Mark ticket as "Done" when complete (Section 6 below)

## 1. Ticket Management Principles
- **Granularity**: Tickets must be small, concise, and atomic. Avoid monolithic "do everything" tickets.
- **Clear Goals**: Each ticket must have a specific goal and defined intermediate steps.
- **Dynamic Creation**: If new problems or out-of-scope requirements are identified during implementation, **create a new ticket** immediately. Do not expand the scope of the current ticket.
- **Linear Integration**:
    - Use the Linear API (as documented above) to fetch "Todo" items.
    - Create new tickets using the `issueCreate` mutation when necessary.

## 2. Feature Implementation Cycle
1.  **Create Branch**:
    - Format: `feature/<TICKET-ID>-<short-description>`
    - Example: `git checkout -b feature/TIM-16-rehaul-website`
2.  **Implement & Verify**:
    - Write code iteratively.
    - Run relevant tests frequently (e.g., `npm test`, `npm run build`).
    - **CRITICAL**: Do not proceed to push unless tests pass.
3.  **Push & Submit**:
    - Once tests pass, push the branch to origin.
    - Command: `git push -u origin feature/<TICKET-ID>-<short-description>`
    - Notify the user that the branch is pushed and ready for PR/Merge.

## 3. Completion & Cleanup
1.  **Merge to Main**:
    - Once the feature is verified (tests pass, Vercel preview works), merge the branch into `main`.
    - Command:
      ```bash
      git checkout main
      git merge feature/<TICKET-ID>-<short-description>
      git push origin main
      ```
2.  **Delete Branch**:
    - Remove the feature branch to keep the repository clean.
    - Command:
      ```bash
      git branch -d feature/<TICKET-ID>-<short-description>
      git push origin --delete feature/<TICKET-ID>-<short-description>
      ```

## 4. Vercel & Deployment
- **Vercel Connection**: The repository is connected to Vercel.
- **Preview**: Pushing a feature branch automatically triggers a **Preview Deployment**.
- **Production**: Merging a PR into `main` automatically triggers a **Production Deployment**.
- **Verification**: Always check the Vercel Preview URL (provided in the PR) before merging.

## 5. Fetching Team States (Required for Updates)

Before updating a ticket status, you need to fetch the state IDs for your team:

**Query**:
```graphql
query {
  teams(filter: { key: { eq: "TIM" } }) {
    nodes {
      id
      key
      states {
        nodes {
          id
          name
          type
        }
      }
    }
  }
}
```

**Response Example**:
```json
{
  "data": {
    "teams": {
      "nodes": [
        {
          "id": "team-id-here",
          "key": "TIM",
          "states": {
            "nodes": [
              { "id": "state-todo-id", "name": "Todo", "type": "unstarted" },
              { "id": "state-inprogress-id", "name": "In Progress", "type": "started" },
              { "id": "state-done-id", "name": "Done", "type": "completed" }
            ]
          }
        }
      ]
    }
  }
}
```

## 6. Update Issue Status

Use the `issueUpdate` mutation with the Issue ID and the desired State ID from the previous step.

**Mutation**:
```graphql
mutation {
  issueUpdate(
    id: "0023c308-9a50-40e4-86ce-c184bf1bbf7e",
    input: { stateId: "7c9b8132-9436-4cdd-aa15-5668f709930f" }
  ) {
    success
    issue {
      id
      state {
        name
      }
    }
  }
}
```

**Curl Command**:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: <YOUR_LINEAR_API_KEY>" \
  --data '{"query": "mutation { issueUpdate(id: \"0023c308-9a50-40e4-86ce-c184bf1bbf7e\", input: { stateId: \"7c9b8132-9436-4cdd-aa15-5668f709930f\" }) { success issue { id state { name } } } }"}' \
  https://api.linear.app/graphql
```
