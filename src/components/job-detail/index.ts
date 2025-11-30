// Job Detail sub-components
// TIM-50: Decomposed from monolithic JobDetail.tsx

export { JobDetailHeader } from './JobDetailHeader';
export { StorageUsage } from './StorageUsage';
export { StatsQuickView } from './StatsQuickView';
export { StorageHistory } from './StorageHistory';
export { JobAnalytics, JobAnalyticsPlaceholder } from './JobAnalytics';
export type { JobAnalyticsData } from './JobAnalytics';
export { SnapshotList } from './SnapshotList';
export type { SnapshotGrouping } from './SnapshotList';
export { LiveActivity } from './LiveActivity';
export { buildSnapshotFolderName, calculateJobStats, groupSnapshots } from './utils';
