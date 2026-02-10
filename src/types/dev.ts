/**
 * Dev tools types (only used in dev mode)
 */

export interface DevSeedResult {
  jobs_created: number;
  snapshots_created: number;
  files_created: number;
  total_size_bytes: number;
  duration_ms: number;
}

export interface DevBenchmarkResult {
  operation: string;
  iterations: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  total_ms: number;
}

export interface DevChurnResult {
  added: number;
  modified: number;
  deleted: number;
}

export interface DevDbStats {
  snapshot_count: number;
  file_count: number;
  total_size_bytes: number;
  fts_index_entries: number;
  db_size_bytes: number;
}
