/**
 * Dev Tools Panel - Only visible in development mode
 *
 * Provides controls for:
 * - Seeding mock data for testing
 * - Running performance benchmarks
 * - Viewing database statistics
 */

import React, { useState, useEffect } from 'react';
import { Icons } from './IconComponents';
import { api } from '../api';
import { formatBytes } from '../utils/formatters';
import type { DevSeedResult, DevBenchmarkResult, DevDbStats } from '../types';
import { Title, Body, Caption, Code } from './ui';

interface DevToolsProps {
  onClose?: () => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ onClose }) => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [seedResult, setSeedResult] = useState<DevSeedResult | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<DevBenchmarkResult[] | null>(null);
  const [dbStats, setDbStats] = useState<DevDbStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load DB stats on mount
  useEffect(() => {
    loadDbStats();
  }, []);

  const loadDbStats = async () => {
    try {
      const stats = await api.devDbStats();
      setDbStats(stats);
    } catch (err) {
      console.error('Failed to load DB stats:', err);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setError(null);
    setSeedResult(null);

    try {
      const result = await api.devSeedData();
      setSeedResult(result);
      await loadDbStats();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleRunBenchmarks = async () => {
    setIsBenchmarking(true);
    setError(null);
    setBenchmarkResults(null);

    try {
      const results = await api.devRunBenchmarks();
      setBenchmarkResults(results);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Clear all dev seeded data? This cannot be undone.')) return;

    setIsClearing(true);
    setError(null);

    try {
      await api.devClearData();
      setSeedResult(null);
      setBenchmarkResults(null);
      await loadDbStats();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsClearing(false);
    }
  };

  // Only show in dev mode
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-layer-1 rounded-2xl border border-border-base shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-base bg-layer-2/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-secondary flex items-center justify-center">
              <Icons.Code size={20} className="text-accent-primary" />
            </div>
            <div>
              <Title level={4}>Dev Tools</Title>
              <Caption color="tertiary">Testing & Performance</Caption>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-layer-3 rounded-lg text-text-tertiary transition-colors"
            >
              <Icons.X size={18} />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] space-y-6">
          {/* Database Stats */}
          {dbStats && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Snapshots"
                value={dbStats.snapshot_count.toLocaleString()}
                icon={<Icons.Clock size={16} />}
              />
              <StatCard
                label="Files Indexed"
                value={dbStats.file_count.toLocaleString()}
                icon={<Icons.File size={16} />}
              />
              <StatCard
                label="DB Size"
                value={formatBytes(dbStats.db_size_bytes)}
                icon={<Icons.HardDrive size={16} />}
              />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Body size="sm" weight="medium" color="secondary">
              Data Generation
            </Body>
            <div className="flex gap-3">
              <button
                onClick={handleSeedData}
                disabled={isSeeding}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent-primary text-white rounded-xl font-medium hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSeeding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Icons.Database size={18} />
                    Seed Mock Data
                  </>
                )}
              </button>
              <button
                onClick={handleClearData}
                disabled={isClearing}
                className="px-4 py-3 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-xl font-medium hover:bg-[var(--color-error)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isClearing ? 'Clearing...' : 'Clear'}
              </button>
            </div>
          </div>

          {/* Seed Result */}
          {seedResult && (
            <div
              className={`p-4 rounded-xl animate-fade-in ${
                seedResult.jobs_created === 0
                  ? 'bg-[var(--color-info)]/10 border border-[var(--color-info)]/20'
                  : 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                {seedResult.jobs_created === 0 ? (
                  <>
                    <Icons.Info size={18} className="text-[var(--color-info)]" />
                    <Body weight="medium" className="text-[var(--color-info)]">
                      Data Already Exists
                    </Body>
                  </>
                ) : (
                  <>
                    <Icons.Check size={18} className="text-[var(--color-success)]" />
                    <Body weight="medium" className="text-[var(--color-success)]">
                      Seeding Complete
                    </Body>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {seedResult.jobs_created > 0 && (
                  <Body size="sm" color="tertiary">
                    Jobs:{' '}
                    <Body as="span" size="sm" weight="medium">
                      {seedResult.jobs_created}
                    </Body>
                  </Body>
                )}
                <Body size="sm" color="tertiary">
                  Snapshots:{' '}
                  <Body as="span" size="sm" weight="medium">
                    {seedResult.snapshots_created}
                  </Body>
                </Body>
                <Body size="sm" color="tertiary">
                  Files:{' '}
                  <Body as="span" size="sm" weight="medium">
                    {seedResult.files_created.toLocaleString()}
                  </Body>
                </Body>
                <Body size="sm" color="tertiary">
                  Size:{' '}
                  <Body as="span" size="sm" weight="medium">
                    {formatBytes(seedResult.total_size_bytes)}
                  </Body>
                </Body>
                {seedResult.duration_ms > 0 && (
                  <Body size="sm" color="tertiary" className="col-span-2">
                    Duration:{' '}
                    <Body
                      as="span"
                      size="sm"
                      weight="medium"
                      className="text-[var(--color-success)]"
                    >
                      {(seedResult.duration_ms / 1000).toFixed(2)}s
                    </Body>
                  </Body>
                )}
              </div>
              {seedResult.jobs_created === 0 && (
                <Caption color="tertiary" className="mt-3">
                  Click "Clear" first if you want to regenerate the data.
                </Caption>
              )}
            </div>
          )}

          {/* Benchmarks */}
          <div className="space-y-3">
            <Body size="sm" weight="medium" color="secondary">
              Performance Benchmarks
            </Body>
            <button
              onClick={handleRunBenchmarks}
              disabled={isBenchmarking || !dbStats || dbStats.file_count === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-layer-2 border border-border-base rounded-xl font-medium hover:bg-layer-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isBenchmarking ? (
                <>
                  <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                  Running Benchmarks...
                </>
              ) : (
                <>
                  <Icons.Zap size={18} className="text-accent-primary" />
                  Run Benchmarks
                </>
              )}
            </button>
          </div>

          {/* Benchmark Results */}
          {benchmarkResults && (
            <div className="space-y-2 animate-fade-in">
              <Caption color="tertiary" className="font-medium uppercase tracking-wide">
                Results (100 iterations each)
              </Caption>
              <div className="bg-layer-2 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-base">
                      <th className="px-4 py-2 text-left">
                        <Caption color="tertiary" className="font-medium">
                          Operation
                        </Caption>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <Caption color="tertiary" className="font-medium">
                          Avg
                        </Caption>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <Caption color="tertiary" className="font-medium">
                          Min
                        </Caption>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <Caption color="tertiary" className="font-medium">
                          Max
                        </Caption>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarkResults.map((result, i) => (
                      <tr key={result.operation} className={i % 2 === 0 ? 'bg-layer-1/50' : ''}>
                        <td className="px-4 py-2">
                          <Code size="sm">{result.operation}</Code>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <Body
                            size="sm"
                            className={
                              result.avg_ms < 1
                                ? 'text-[var(--color-success)]'
                                : result.avg_ms < 10
                                  ? 'text-accent-primary'
                                  : 'text-[var(--color-error)]'
                            }
                          >
                            {result.avg_ms.toFixed(3)}ms
                          </Body>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <Body size="sm" color="tertiary">
                            {result.min_ms.toFixed(3)}ms
                          </Body>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <Body size="sm" color="tertiary">
                            {result.max_ms.toFixed(3)}ms
                          </Body>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl animate-fade-in">
              <div className="flex items-center gap-2">
                <Icons.AlertCircle size={18} className="text-[var(--color-error)]" />
                <Body size="sm" className="text-[var(--color-error)]">
                  {error}
                </Body>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 bg-layer-2 rounded-xl space-y-2">
            <Caption color="tertiary">
              <strong>Seed Mock Data</strong> creates 2 backup jobs with 85 snapshots total spanning
              2 years, containing 40K-60K files each (~3.7M file entries, ~1GB database).
            </Caption>
            <Caption color="tertiary">
              <strong>Caching</strong>: First seed generates data and saves to{' '}
              <Code size="sm" className="bg-layer-3 px-1 py-0.5 rounded">
                mock-data/
              </Code>
              . Subsequent seeds import from cache (much faster).
            </Caption>
            <Caption color="tertiary">
              <strong>Benchmarks</strong> run 100 iterations of each operation to measure query
              performance.
            </Caption>
            <Caption color="tertiary">
              Dev data is prefixed with{' '}
              <Code size="sm" className="bg-layer-3 px-1 py-0.5 rounded">
                dev-
              </Code>{' '}
              and won't affect real backups.
            </Caption>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="p-4 bg-layer-2 rounded-xl">
    <div className="flex items-center gap-2 text-text-tertiary mb-1">
      {icon}
      <Caption>{label}</Caption>
    </div>
    <Title level={4} className="tabular-nums">
      {value}
    </Title>
  </div>
);

export default DevTools;
