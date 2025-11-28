# Agent Workflow Protocol

This section defines the automated workflow the Agent must follow when implementing features.

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

## 4. Completion & Cleanup
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

## 5. Vercel & Deployment
- **Vercel Connection**: The repository is connected to Vercel.
- **Preview**: Pushing a feature branch automatically triggers a **Preview Deployment**.
- **Production**: Merging a PR into `main` automatically triggers a **Production Deployment**.
- **Verification**: Always check the Vercel Preview URL (provided in the PR) before merging.

**Response Example**:
```json
  "data": {
    "issue": {
      "id": "0023c308-9a50-40e4-86ce-c184bf1bbf7e",
      "team": {
        "states": {
          "nodes": [
            { "id": "7c9b8132-9436-4cdd-aa15-5668f709930f", "name": "Done", "type": "completed" }
          ]
        }
      }
    }
  }
}
```

## 2. Update Issue Status

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
