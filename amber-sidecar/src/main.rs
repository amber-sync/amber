use clap::{Parser, Subcommand};
use walkdir::WalkDir;
use serde::Serialize;
use std::io::{self, Write};
use std::fs;
use std::path::Path;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Lists immediate children of a directory (Lazy Load)
    Scan {
        path: String,
    },
    /// Recursively searches for files matching a query
    Search {
        path: String,
        query: String,
    },
    /// Generates dummy files for testing
    Generate {
        path: String,
        #[arg(short, long, default_value_t = 10000)]
        count: usize,
    },
}

#[derive(Serialize)]
struct FileEntry {
    path: String,
    name: String,
    is_dir: bool,
    size: u64,
    modified: u64,
}

fn main() {
    let cli = Cli::parse();

    match &cli.command {
        Commands::Scan { path } => {
            scan_directory(path, 1); // Lazy: Depth 1
        }
        Commands::Search { path, query } => {
            search_directory(path, query);
        }
        Commands::Generate { path, count } => {
            generate_sandbox(path, *count);
        }
    }
}

fn scan_directory(path: &str, depth: usize) {
    let stdout = io::stdout();
    let mut handle = stdout.lock();

    // min_depth 1 to skip the root folder itself
    for entry in WalkDir::new(path).min_depth(1).max_depth(depth) {
        match entry {
            Ok(entry) => {
                if let Some(json) = make_json(&entry) {
                    writeln!(handle, "{}", json).ok();
                }
            }
            Err(e) => eprintln!("Error: {}", e),
        }
    }
}

fn search_directory(path: &str, query: &str) {
    let stdout = io::stdout();
    let mut handle = stdout.lock();
    let query_lower = query.to_lowercase();

    // Unlimited depth for search
    for entry in WalkDir::new(path).min_depth(1).into_iter().filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.contains(&query_lower) {
            if let Some(json) = make_json(&entry) {
                writeln!(handle, "{}", json).ok();
            }
        }
    }
}

fn generate_sandbox(path: &str, count: usize) {
    let root = Path::new(path);
    if let Err(e) = fs::create_dir_all(root) {
        eprintln!("Failed to create root: {}", e);
        return;
    }

    println!("Generating {} files in {}", count, path);

    // Create some subdirectories
    let subdirs = ["docs", "images", "logs", "data"];
    for sub in &subdirs {
        let _ = fs::create_dir_all(root.join(sub));
    }

    for i in 0..count {
        let subdir = subdirs[i % subdirs.len()];
        let filename = format!("file_{}.txt", i);
        let filepath = root.join(subdir).join(filename);
        
        // Write minimal content
        if let Err(e) = fs::write(&filepath, format!("Content for file {}", i)) {
            eprintln!("Failed to write file {}: {}", filepath.display(), e);
        }

        if i % 1000 == 0 {
            print!(".");
            io::stdout().flush().ok();
        }
    }
    println!("\nDone.");
}

fn make_json(entry: &walkdir::DirEntry) -> Option<String> {
    let metadata = entry.metadata().ok();
    let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
    let modified = metadata
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let file_entry = FileEntry {
        path: entry.path().to_string_lossy().to_string(),
        name: entry.file_name().to_string_lossy().to_string(),
        is_dir: entry.file_type().is_dir(),
        size,
        modified,
    };

    serde_json::to_string(&file_entry).ok()
}