"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobStatus = exports.SyncMode = void 0;
exports.isRsyncProgress = isRsyncProgress;
exports.isBackupResult = isBackupResult;
var SyncMode;
(function (SyncMode) {
    SyncMode["MIRROR"] = "MIRROR";
    SyncMode["ARCHIVE"] = "ARCHIVE";
    SyncMode["TIME_MACHINE"] = "TIME_MACHINE";
    SyncMode["CLOUD"] = "CLOUD";
})(SyncMode || (exports.SyncMode = SyncMode = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["IDLE"] = "IDLE";
    JobStatus["RUNNING"] = "RUNNING";
    JobStatus["SUCCESS"] = "SUCCESS";
    JobStatus["FAILED"] = "FAILED";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
// Type guards
function isRsyncProgress(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'percentage' in data &&
        typeof data.percentage === 'number');
}
function isBackupResult(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        typeof data.success === 'boolean');
}
