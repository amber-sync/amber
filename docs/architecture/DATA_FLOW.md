# Data Flow: File Types & Analytics

This document describes the complete data flow for file type information in Amber Backup.

## Quick Reference

| Layer | Field Name | Values |
|-------|-----------|--------|
| SQLite DB | `file_type` | `'file'`, `'dir'`, `'symlink'` |
| Rust struct | `node_type` | `"file"`, `"dir"` |
| JSON (serde) | `type` | `"file"`, `"dir"` |
| TypeScript | `type` | `'file' \| 'dir'` |

**CRITICAL**: All values must be **lowercase**. Never use `'FILE'` or `'FOLDER'`.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. MOCK DATA GENERATION (scripts/generate-mock-data.py)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ INSERT INTO files (..., file_type) VALUES (..., 'file')                     │
│ INSERT INTO files (..., file_type) VALUES (..., 'dir')                      │
│                                                                             │
│ Output: mock-data/index.db                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. RUST DATABASE READ (src-tauri/src/services/index_service.rs)             │
├─────────────────────────────────────────────────────────────────────────────┤
│ let file_type: String = row.get(4)?;   // "file" or "dir"                   │
│ let is_dir = file_type == "dir";       // Compare lowercase                 │
│ let node_type = if is_dir { "dir" } else { "file" };  // Use lowercase!     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. RUST STRUCT (src-tauri/src/types/snapshot.rs)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ #[derive(Serialize, Deserialize)]                                           │
│ pub struct FileNode {                                                       │
│     #[serde(rename = "type")]                                               │
│     pub node_type: String,    // "file" or "dir"                            │
│     ...                                                                     │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. JSON SERIALIZATION (Tauri IPC)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ { "type": "file", "name": "foo.txt", ... }                                  │
│ { "type": "dir", "name": "Documents", ... }                                 │
│                                                                             │
│ Note: serde(rename="type") converts node_type → type                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. TYPESCRIPT TYPES (src/types.ts)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ interface FileNode {                                                        │
│   type: 'file' | 'dir';    // Must match JSON exactly                       │
│   name: string;                                                             │
│   ...                                                                       │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. ANALYTICS CALCULATION (src/components/job-detail/utils.ts)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ if (node.type === 'file') {   // Must check lowercase!                      │
│   const ext = node.name.split('.').pop();                                   │
│   typesMap.set(ext, count + 1);                                             │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. UI DISPLAY (src/components/job-detail/JobAnalytics.tsx)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ {fileTypes.map(([ext, count]) => (                                          │
│   <div>{ext}: {count} files</div>                                           │
│ ))}                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `scripts/generate-mock-data.py` | Creates SQLite with lowercase `file_type` |
| `src-tauri/src/services/index_service.rs` | Reads DB, builds FileNode structs |
| `src-tauri/src/types/snapshot.rs` | FileNode struct with serde rename |
| `src/types.ts` | TypeScript interfaces |
| `src/components/job-detail/utils.ts` | Calculates file type stats |
| `src/components/job-detail/JobAnalytics.tsx` | Displays analytics |

## Common Mistakes to Avoid

1. **Case mismatch**: Using `'FILE'` instead of `'file'`
2. **Field name mismatch**: Using `node_type` instead of `type` in TypeScript
3. **Hardcoding in Rust**: Setting `"FOLDER"` instead of `"dir"` during serialization

## Testing

Verify the full chain works:

```bash
# 1. Check database values
sqlite3 mock-data/index.db "SELECT DISTINCT file_type FROM files;"
# Should output: file, dir

# 2. Check frontend receives correct data
# Open DevTools → Network → find API call → check response JSON
# Should see: "type": "file" or "type": "dir"
```
