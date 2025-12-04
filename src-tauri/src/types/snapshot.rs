use serde::{Deserialize, Serialize};

/// Centralized file type constants - use these everywhere instead of string literals.
/// These match the TypeScript FileNode.type: 'file' | 'dir'
pub mod file_type {
    pub const DIR: &str = "dir";
    pub const FILE: &str = "file";

    /// Check if a string represents a directory type
    pub fn is_dir(s: &str) -> bool {
        s == DIR
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub timestamp: i64,
    pub path: String,
    pub file_count: usize,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: i64,
    pub children: Option<Vec<FileTreeNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotMetadata {
    pub id: String,
    pub timestamp: i64,
    pub date: String,
    pub size_bytes: u64,
    pub file_count: u64,
    pub path: String,
    /// Status of the snapshot (Complete, Partial, Failed)
    #[serde(default = "default_status")]
    pub status: String,
    /// Duration of backup in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
    /// Number of files changed since previous snapshot
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes_count: Option<u64>,
}

fn default_status() -> String {
    "Complete".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub size: u64,
    pub modified: i64,
    pub children: Option<Vec<FileNode>>,
    pub path: String,
}
