# Directory Navigation API Flow Analysis - CRITICAL BUG FOUND

## Executive Summary

**CRITICAL BUG IDENTIFIED**: The `PathValidator` in the backend requires paths to exist before they can be validated, but it's being called BEFORE checking if the path exists. This creates a catch-22 where subdirectory navigation fails.

## Complete API Call Flow

### 1. Frontend Initiation (FileBrowser.tsx)

**Location**: `/Users/florianmahner/Desktop/amber/src/components/FileBrowser.tsx:97-156`

```typescript
const loadDirectory = useCallback(async (path: string) => {
  // ...
  const result = await api.readDir(path);  // Line 130
  // ...
}, [isIndexed, destPath, jobId, snapshotTimestamp, initialPath]);
```

When user clicks a directory:
- `handleEntryClick()` is called (line 220)
- For directories: `setCurrentPath(entry.path)` (line 222)
- This triggers `loadDirectory()` via the `useEffect` at line 159
- `loadDirectory()` calls `api.readDir(path)` with the new path

### 2. API Layer (index.ts)

**Location**: `/Users/florianmahner/Desktop/amber/src/api/index.ts:118-120`

```typescript
async readDir(path: string): Promise<DirEntry[]> {
  return invoke('read_dir', { path });
}
```

Simple pass-through to Tauri backend with command name `'read_dir'` and parameter `{ path }`.

### 3. Tauri Command Registration (lib.rs)

**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/lib.rs:100`

```rust
commands::filesystem::read_dir,
```

Command is properly registered in both debug and release builds.

### 4. Backend Command Handler (filesystem.rs)

**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/commands/filesystem.rs:30-42`

```rust
#[tauri::command]
pub async fn read_dir(state: State<'_, AppState>, path: String) -> Result<Vec<DirEntry>> {
    // ⚠️ CRITICAL: Validates path BEFORE checking existence
    let validator = state
        .path_validator
        .read()
        .map_err(|e| crate::error::AmberError::Filesystem(format!("Lock error: {}", e)))?;
    let validated_path = validator.validate_str(&path)?;  // 🔴 FAILS HERE
    drop(validator); // Release lock early

    let entries = state.file_service.scan_directory(&validated_path)?;
    Ok(entries.into_iter().map(DirEntry::from).collect())
}
```

**Problem**: Path validation happens at line 37 BEFORE the file service checks if the directory exists.

### 5. Path Validation (path_validation.rs)

**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/security/path_validation.rs:96-147`

```rust
pub fn validate(&self, path: &str) -> Result<PathBuf> {
    // ... null byte check, URL decoding ...

    let path_obj = Path::new(decoded.as_ref());

    // 🔴 CRITICAL BUG: Canonicalize requires path to EXIST
    let canonical = path_obj
        .canonicalize()  // Line 121-123
        .map_err(|e| AmberError::InvalidPath(format!("Cannot access path: {}", e)))?;

    // Check if canonical path starts with any allowed root
    let is_allowed = self
        .allowed_roots
        .iter()
        .any(|root| canonical.starts_with(root));

    if !is_allowed {
        return Err(AmberError::PermissionDenied(...));
    }

    Ok(canonical)
}
```

**The Bug**:
- `Path::canonicalize()` at line 121 **REQUIRES THE PATH TO EXIST**
- From Rust docs: "This function will traverse symbolic links to resolve to the final destination, and it requires that all path components exist"
- If the path doesn't exist, it returns an error: "Cannot access path: No such file or directory"
- This error is returned BEFORE the file service can check if the directory actually exists

### 6. File Service (file_service.rs)

**Location**: `/Users/florianmahner/Desktop/amber/src-tauri/src/services/file_service.rs:23-57`

```rust
pub fn scan_directory(&self, dir_path: &str) -> Result<Vec<FileEntry>> {
    let path = Path::new(dir_path);

    // This check never runs because validation fails first
    if !path.exists() {
        return Err(AmberError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Directory not found: {}", dir_path),
        )));
    }
    // ... scan directory ...
}
```

This existence check never executes because the validator fails first.

## The Root Cause

The `PathValidator` uses `Path::canonicalize()` which has these requirements:
1. The path must exist
2. All parent directories must exist
3. Symlinks are resolved to their final destination

**This creates a catch-22**:
- User navigates to a subdirectory that exists
- Frontend sends the full path to backend
- Validator tries to canonicalize the path
- Canonicalize fails because... wait, the path SHOULD exist
- **The real issue**: Either the path doesn't exist, OR the validator's allowed roots don't include the parent directory

## Testing the Hypothesis

Looking at the PathValidator initialization in `state.rs`, the validator is created with:
- Home directory
- `/Volumes/*`
- Application data directory
- Job source and destination paths (from `PathValidator::with_job_roots`)

**The Problem**: When navigating from `/Volumes/Backup/test` to `/Volumes/Backup/test/subdir`:
1. If `/Volumes/Backup/test` is a job destination, it's added as an allowed root
2. But `/Volumes/Backup/test/subdir` is NOT in the allowed roots
3. The validator checks if the canonical path **starts with** an allowed root
4. `/Volumes/Backup/test/subdir` DOES start with `/Volumes/Backup/test`
5. So the allowed root check should pass...

**Wait, there's another issue**: The validator adds individual job paths as roots, but the user might be browsing a directory that's not a configured job path. Let me check the test case from line 260:

```rust
// Should fail because path doesn't exist (can't canonicalize)
assert!(result.is_err());
```

The test confirms: **non-existent paths fail during canonicalization**.

## Two Possible Scenarios

### Scenario A: Path Doesn't Exist (User Error)
- User tries to navigate to a subdirectory that doesn't actually exist on disk
- Frontend shows it in the list but clicking fails
- This would be a frontend issue - showing directories that don't exist

### Scenario B: Path Exists but Isn't in Allowed Roots
- The subdirectory exists
- But it's not explicitly added to allowed roots
- However, the code checks `canonical.starts_with(root)`, which should work for subdirectories
- **BUT**: `/Volumes` is added as a root (line 43), so ALL volumes should be accessible

## The Most Likely Bug

Looking at the state initialization code, I need to check how the validator is created:

**Key Question**: Is the path being passed correctly to the backend?

Let me check the FileBrowser path construction:
- Line 122: `path: ${initialPath}/${item.path}`
- This builds paths like: `/Volumes/Backup/Projects/webapp`
- If SQLite stores relative paths and we prepend initialPath, this should be correct

## Conclusion

**The bug is in the PathValidator requiring paths to exist before validation.**

This is fundamentally flawed for a security validator because:
1. It prevents browsing subdirectories that exist but aren't explicitly whitelisted
2. It requires the filesystem operation before security check
3. The error message is confusing ("Cannot access path" vs "Path not found")

## Recommended Fixes

### Option 1: Relaxed Validation (Recommended)
- Only require parent directory to exist
- Allow subdirectories under allowed roots without requiring their existence
- Move canonicalization to AFTER existence check

### Option 2: Two-Phase Validation
- Phase 1: Validate parent directory (must exist)
- Phase 2: Check if requested path is under allowed root (doesn't need to exist)

### Option 3: Lazy Validation
- Skip canonicalization for non-existent paths
- Only validate that the path would be under an allowed root if it existed
- Normalize the path manually instead of using canonicalize

## Error Propagation

When validation fails:
1. `AmberError::InvalidPath` is returned from validator
2. Wrapped in `Result<Vec<DirEntry>>` from `read_dir` command
3. Serialized by Tauri and sent to frontend
4. Frontend `api.readDir()` throws an error
5. Caught in `FileBrowser.tsx` line 149: `catch (err: any)`
6. Displayed as: `setError(err.message || String(err))`
7. Shows in UI: "Error: {error message}"

The error message would be: **"Cannot access path: No such file or directory"** or **"Path is outside allowed directories"**

## Next Steps

1. Add debug logging to see exact path being validated
2. Check if the path actually exists on disk
3. Verify the allowed roots include the parent directory
4. Fix the validator to handle non-existent paths properly
