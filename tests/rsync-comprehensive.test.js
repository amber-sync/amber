/**
 * Comprehensive Rsync Implementation Test Suite
 *
 * This test suite validates critical rsync behaviors that are essential for
 * reliable Time Machine-style backups. Failures in these tests could lead to:
 * - Data loss
 * - Incorrect permissions
 * - Massive backup sizes
 * - Broken hard link relationships
 *
 * Each test creates real filesystem scenarios in /tmp and validates behavior.
 */

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Import the service we're testing
const { RsyncService } = require('../electron/rsync-service.ts');

describe('Rsync Implementation - Comprehensive Validation', function() {
    this.timeout(60000); // 60 second timeout for filesystem operations

    let testRoot;
    let sourceDir;
    let destDir;
    let service;

    beforeEach(function() {
        // Create unique test directory for isolation
        testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rsync-test-'));
        sourceDir = path.join(testRoot, 'source');
        destDir = path.join(testRoot, 'dest');

        fs.mkdirSync(sourceDir, { recursive: true });
        fs.mkdirSync(destDir, { recursive: true });

        // Create backup marker file for safety check
        fs.writeFileSync(path.join(destDir, 'backup.marker'), '');

        service = new RsyncService();

        console.log(`Test directory: ${testRoot}`);
    });

    afterEach(function() {
        // Cleanup
        if (fs.existsSync(testRoot)) {
            fs.rmSync(testRoot, { recursive: true, force: true });
        }
    });

    /**
     * CRITICAL TEST 1: Hard Links Preservation
     *
     * Hard links in the source must be preserved in the backup.
     * Without --hard-links flag, they become separate files.
     */
    describe('Hard Links Preservation (CRITICAL)', function() {
        it('should preserve hard links within source directory', function(done) {
            // Create original file
            const file1 = path.join(sourceDir, 'original.txt');
            const file2 = path.join(sourceDir, 'hardlink.txt');

            fs.writeFileSync(file1, 'This file has hard links');

            // Create hard link (same inode)
            fs.linkSync(file1, file2);

            // Verify hard link created (same inode)
            const stat1 = fs.statSync(file1);
            const stat2 = fs.statSync(file2);
            expect(stat1.ino).to.equal(stat2.ino, 'Source hard links should share inode');
            expect(stat1.nlink).to.equal(2, 'Link count should be 2');

            // Run backup
            const job = {
                id: 'test-hardlinks',
                name: 'Hard Link Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: true,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            const logs = [];
            service.runBackup(job, (msg) => logs.push(msg), null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    // Check if hard links preserved in backup
                    const backupFile1 = path.join(destDir, 'original.txt');
                    const backupFile2 = path.join(destDir, 'hardlink.txt');

                    expect(fs.existsSync(backupFile1)).to.be.true;
                    expect(fs.existsSync(backupFile2)).to.be.true;

                    const backupStat1 = fs.statSync(backupFile1);
                    const backupStat2 = fs.statSync(backupFile2);

                    // CRITICAL: These should have the same inode
                    expect(backupStat1.ino).to.equal(backupStat2.ino,
                        'Hard links MUST be preserved (same inode in backup)');
                    expect(backupStat1.nlink).to.equal(2,
                        'Link count should be 2 in backup');

                    // Verify rsync command included --hard-links flag
                    const commandLog = logs.find(l => l.includes('rsync'));
                    expect(commandLog).to.exist;
                    expect(commandLog).to.include('--hard-links',
                        'rsync command MUST include --hard-links flag');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        it('should handle multiple hard links to same file', function(done) {
            // Create file with 3 hard links
            const original = path.join(sourceDir, 'data.bin');
            const link1 = path.join(sourceDir, 'link1.bin');
            const link2 = path.join(sourceDir, 'subdir', 'link2.bin');

            fs.mkdirSync(path.join(sourceDir, 'subdir'));
            fs.writeFileSync(original, 'Important data with multiple hard links');
            fs.linkSync(original, link1);
            fs.linkSync(original, link2);

            // Verify 3 links
            const stat = fs.statSync(original);
            expect(stat.nlink).to.equal(3);

            const job = {
                id: 'test-multi-hardlinks',
                name: 'Multiple Hard Links Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const backupOriginal = path.join(destDir, 'data.bin');
                    const backupLink1 = path.join(destDir, 'link1.bin');
                    const backupLink2 = path.join(destDir, 'subdir', 'link2.bin');

                    const inode1 = fs.statSync(backupOriginal).ino;
                    const inode2 = fs.statSync(backupLink1).ino;
                    const inode3 = fs.statSync(backupLink2).ino;

                    expect(inode1).to.equal(inode2);
                    expect(inode2).to.equal(inode3);
                    expect(fs.statSync(backupOriginal).nlink).to.equal(3);

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * CRITICAL TEST 2: Numeric IDs Preservation
     *
     * File ownership must be preserved using numeric UID/GID, not username mapping.
     * This is critical for cross-system restores.
     */
    describe('Numeric IDs Preservation (CRITICAL)', function() {
        it('should include --numeric-ids flag in rsync command', function(done) {
            fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'test');

            const job = {
                id: 'test-numeric-ids',
                name: 'Numeric IDs Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: true,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            const logs = [];
            service.runBackup(job, (msg) => logs.push(msg), null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const commandLog = logs.find(l => l.includes('rsync'));
                    expect(commandLog).to.exist;
                    expect(commandLog).to.include('--numeric-ids',
                        'rsync command MUST include --numeric-ids flag for UID/GID preservation');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        it('should preserve exact UID and GID of files', function(done) {
            // Note: We can't easily change ownership without sudo, but we can verify
            // that the current ownership is preserved exactly
            const testFile = path.join(sourceDir, 'ownership-test.txt');
            fs.writeFileSync(testFile, 'ownership test');

            const originalStat = fs.statSync(testFile);
            const originalUid = originalStat.uid;
            const originalGid = originalStat.gid;

            const job = {
                id: 'test-ownership',
                name: 'Ownership Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const backupFile = path.join(destDir, 'ownership-test.txt');
                    const backupStat = fs.statSync(backupFile);

                    expect(backupStat.uid).to.equal(originalUid,
                        'UID must be preserved exactly');
                    expect(backupStat.gid).to.equal(originalGid,
                        'GID must be preserved exactly');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * CRITICAL TEST 3: One File System Boundary
     *
     * Must NOT cross filesystem boundaries to avoid backing up /dev, /proc,
     * mounted drives, network shares, etc.
     */
    describe('Filesystem Boundary Enforcement (CRITICAL)', function() {
        it('should include --one-file-system flag in rsync command', function(done) {
            fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'test');

            const job = {
                id: 'test-one-fs',
                name: 'One Filesystem Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: true,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            const logs = [];
            service.runBackup(job, (msg) => logs.push(msg), null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const commandLog = logs.find(l => l.includes('rsync'));
                    expect(commandLog).to.exist;
                    expect(commandLog).to.include('--one-file-system',
                        'rsync command MUST include --one-file-system flag to prevent crossing mounts');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        // Note: Actually testing mount point crossing requires creating a mount,
        // which needs elevated privileges. The flag verification above is the
        // critical test. We trust rsync's implementation of --one-file-system.
    });

    /**
     * CRITICAL TEST 4: Incremental Backup with --link-dest
     *
     * Unchanged files between backups should be hard-linked to save space.
     */
    describe('Incremental Backup Efficiency (CRITICAL)', function() {
        it('should hard-link unchanged files to previous backup', function(done) {
            // First backup
            fs.writeFileSync(path.join(sourceDir, 'unchanged.txt'), 'This file will not change');
            fs.writeFileSync(path.join(sourceDir, 'willchange.txt'), 'Version 1');

            const job1 = {
                id: 'test-incremental-1',
                name: 'Incremental Test 1',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'TIME_MACHINE',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job1, () => {}, null).then(result1 => {
                try {
                    expect(result1.success).to.be.true;

                    // Get first backup directory
                    const backups = fs.readdirSync(destDir)
                        .filter(d => /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(d))
                        .sort();

                    expect(backups).to.have.lengthOf(1);
                    const backup1Dir = path.join(destDir, backups[0]);
                    const backup1Unchanged = path.join(backup1Dir, 'unchanged.txt');
                    const backup1Stat = fs.statSync(backup1Unchanged);

                    // Wait before modifying to ensure mtime differs significantly (fs resolution)
                    setTimeout(() => {
                        // Modify one file, leave other unchanged
                        fs.writeFileSync(path.join(sourceDir, 'willchange.txt'), 'Version 2');

                        const job2 = {
                            id: 'test-incremental-2',
                            name: 'Incremental Test 2',
                            sourcePath: sourceDir,
                            destPath: destDir,
                            mode: 'TIME_MACHINE',
                            config: {
                                archive: true,
                                recursive: true,
                                compress: false,
                                verbose: false,
                                delete: false,
                                excludePatterns: [],
                                customFlags: ''
                            }
                        };

                        service.runBackup(job2, () => {}, null).then(result2 => {
                            try {
                                expect(result2.success).to.be.true;

                                const backups2 = fs.readdirSync(destDir)
                                    .filter(d => /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(d))
                                    .sort();

                                expect(backups2).to.have.lengthOf(2);
                                const backup2Dir = path.join(destDir, backups2[1]);
                                const backup2Unchanged = path.join(backup2Dir, 'unchanged.txt');
                                const backup2Changed = path.join(backup2Dir, 'willchange.txt');
                                const backup2UnchangedStat = fs.statSync(backup2Unchanged);
                                const backup2ChangedStat = fs.statSync(backup2Changed);

                                // CRITICAL: Unchanged file should have same inode (hard link)
                                expect(backup2UnchangedStat.ino).to.equal(backup1Stat.ino,
                                    'Unchanged files MUST be hard-linked between backups');

                                // Changed file should have different inode
                                const backup1ChangedPath = path.join(backup1Dir, 'willchange.txt');
                                const backup1ChangedStat = fs.statSync(backup1ChangedPath);
                                
                                // DEBUG: Check content of previous backup
                                const backup1Content = fs.readFileSync(backup1ChangedPath, 'utf8');
                                const backup2Content = fs.readFileSync(backup2Changed, 'utf8');
                                
                                // Verify what happened
                                if (backup1Content === backup2Content) {
                                    throw new Error(`HISTORY CORRUPTION or NO UPDATE: Both backups have '${backup1Content}'. Expected Backup 1='Version 1', Backup 2='Version 2'`);
                                }

                                expect(backup2ChangedStat.ino).to.not.equal(
                                    backup1ChangedStat.ino,
                                    'Changed files should NOT be hard-linked');

                                // Verify content
                                expect(fs.readFileSync(backup2Changed, 'utf8')).to.equal('Version 2');
                                expect(fs.readFileSync(backup2Unchanged, 'utf8')).to.equal('This file will not change');

                                done();
                            } catch (err) {
                                done(err);
                            }
                        }).catch(done);
                    }, 3000); // 3 second delay

                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        it('should use --link-dest with absolute path', function(done) {
            fs.writeFileSync(path.join(sourceDir, 'file1.txt'), 'content');

            const job1 = {
                id: 'test-link-dest-1',
                name: 'Link Dest Test 1',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'TIME_MACHINE',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: true,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job1, () => {}, null).then(() => {
                setTimeout(() => {
                    const job2 = {
                        id: 'test-link-dest-2',
                        name: 'Link Dest Test 2',
                        sourcePath: sourceDir,
                        destPath: destDir,
                        mode: 'TIME_MACHINE',
                        config: {
                            archive: true,
                            recursive: true,
                            compress: false,
                            verbose: true,
                            delete: false,
                            excludePatterns: [],
                            customFlags: ''
                        }
                    };

                    const logs = [];
                    service.runBackup(job2, (msg) => logs.push(msg), null).then(result => {
                        try {
                            expect(result.success).to.be.true;

                            const commandLog = logs.find(l => l.includes('rsync'));
                            expect(commandLog).to.include('--link-dest=');

                            // Extract link-dest path
                            const match = commandLog.match(/--link-dest=([^\s]+)/);
                            expect(match).to.exist;
                            const linkDestPath = match[1];

                            // Should be absolute path
                            expect(path.isAbsolute(linkDestPath)).to.be.true;

                            done();
                        } catch (err) {
                            done(err);
                        }
                    }).catch(done);
                }, 1500);
            }).catch(done);
        });
    });

    /**
     * TEST 5: Backup Marker Safety Check
     */
    describe('Backup Marker Safety Check', function() {
        it('should refuse to backup without marker file', function(done) {
            // Remove the marker file
            fs.unlinkSync(path.join(destDir, 'backup.marker'));

            fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'test');

            const job = {
                id: 'test-no-marker',
                name: 'No Marker Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            const logs = [];
            service.runBackup(job, (msg) => logs.push(msg), null).then(result => {
                try {
                    expect(result.success).to.be.false;
                    expect(result.error).to.include('marker');

                    const errorLog = logs.find(l => l.includes('Safety check failed'));
                    expect(errorLog).to.exist;

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        it('should succeed when marker file exists', function(done) {
            // Marker file already created in beforeEach
            fs.writeFileSync(path.join(sourceDir, 'test.txt'), 'test');

            const job = {
                id: 'test-with-marker',
                name: 'With Marker Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;
                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * TEST 6: Permission and Metadata Preservation
     */
    describe('Permission and Metadata Preservation', function() {
        it('should preserve file permissions exactly', function(done) {
            const testFile = path.join(sourceDir, 'executable.sh');
            fs.writeFileSync(testFile, '#!/bin/bash\necho "test"');
            fs.chmodSync(testFile, 0o755); // rwxr-xr-x

            const job = {
                id: 'test-perms',
                name: 'Permissions Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const backupFile = path.join(destDir, 'executable.sh');
                    const stat = fs.statSync(backupFile);

                    // Check mode (mask to get just permission bits)
                    expect(stat.mode & 0o777).to.equal(0o755);

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        it('should preserve modification times', function(done) {
            const testFile = path.join(sourceDir, 'timed.txt');
            fs.writeFileSync(testFile, 'content');

            // Set specific mtime (January 1, 2020)
            const specificTime = new Date('2020-01-01T00:00:00Z');
            fs.utimesSync(testFile, specificTime, specificTime);

            const originalMtime = fs.statSync(testFile).mtime.getTime();

            const job = {
                id: 'test-mtime',
                name: 'Mtime Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const backupFile = path.join(destDir, 'timed.txt');
                    const backupMtime = fs.statSync(backupFile).mtime.getTime();

                    // Should be within 1 second (rsync precision)
                    expect(Math.abs(backupMtime - originalMtime)).to.be.lessThan(1000);

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });

        it('should preserve symlinks as symlinks', function(done) {
            const targetFile = path.join(sourceDir, 'target.txt');
            const symlinkFile = path.join(sourceDir, 'symlink.txt');

            fs.writeFileSync(targetFile, 'target content');
            fs.symlinkSync('target.txt', symlinkFile);

            const job = {
                id: 'test-symlink',
                name: 'Symlink Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const backupSymlink = path.join(destDir, 'symlink.txt');
                    const lstat = fs.lstatSync(backupSymlink);

                    expect(lstat.isSymbolicLink()).to.be.true;
                    expect(fs.readlinkSync(backupSymlink)).to.equal('target.txt');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * TEST 7: Backup Expiration Strategy
     */
    describe('Backup Expiration Strategy', function() {
        it('should implement 1:1 30:7 365:30 retention policy', function(done) {
            this.timeout(120000); // 2 minutes for multiple backups

            // We'll create simulated old backups by directly creating directories
            // with old timestamps, then run a new backup and verify expiration

            const now = new Date();

            // Create test backups at various ages
            const backupsToCreate = [
                { daysAgo: 0.5, shouldKeep: true, reason: '< 1 day, keep all' },
                // Strategy: Keep newest of each day.
                // If we have multiple backups for day -2:
                // We create them via timestamps? Or just folders?
                // The code parses folder name.
                
                // Day 2 backups (e.g. 2.1 days ago, 2.9 days ago)
                // With "Keep Newest", we should keep 2.1 and delete 2.9? 
                // Or just keep one per interval.
                // Code iterates newest -> oldest.
                // Keep 2.1 (first seen). Next is 2.9. Diff (2.9 - 2.1) = 0.8. < 1. Delete.
                
                { daysAgo: 2.1, shouldKeep: true, reason: '2.1 days ago (newest of day 2)' },
                { daysAgo: 2.9, shouldKeep: false, reason: '2.9 days ago (oldest of day 2, diff < 1 from 2.1)' },
                
                { daysAgo: 35, shouldKeep: true, reason: '35 days ago (newest of week 5)' },
                // 38 is 3 days older than 35. Interval 7. Diff 3 < 7. Delete.
                { daysAgo: 38, shouldKeep: false, reason: '38 days ago (diff 3 < 7 from day 35)' },
                
                // 45 days ago. Diff from 35 is 10. > 7. Keep.
                { daysAgo: 45, shouldKeep: true, reason: '45 days ago (diff 10 > 7 from day 35)' },
            ];

            // Create a small source file
            fs.writeFileSync(path.join(sourceDir, 'data.txt'), 'test data');

            // Create simulated old backups
            backupsToCreate.forEach(backup => {
                const backupDate = new Date(now.getTime() - backup.daysAgo * 24 * 60 * 60 * 1000);
                const folderName = formatTestDate(backupDate);
                const backupDir = path.join(destDir, folderName);

                fs.mkdirSync(backupDir, { recursive: true });
                fs.writeFileSync(path.join(backupDir, 'data.txt'), `backup from ${backup.daysAgo} days ago`);

                backup.folderName = folderName;
            });

            // Run a new backup which should trigger expiration
            const job = {
                id: 'test-expiration',
                name: 'Expiration Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'TIME_MACHINE',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            const logs = [];
            service.runBackup(job, (msg) => logs.push(msg), null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    // Check which backups still exist
                    const remaining = fs.readdirSync(destDir)
                        .filter(d => /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(d));

                    backupsToCreate.forEach(backup => {
                        const exists = remaining.includes(backup.folderName);

                        if (backup.shouldKeep) {
                            expect(exists, `Backup ${backup.folderName} should be kept: ${backup.reason}`).to.be.true;
                        } else {
                            expect(exists, `Backup ${backup.folderName} should be deleted: ${backup.reason}`).to.be.false;
                        }
                    });

                    // Verify pruning messages in logs
                    const pruningLogs = logs.filter(l => l.includes('Pruning'));
                    expect(pruningLogs.length).to.be.greaterThan(0,
                        'Should have pruning log messages');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * TEST 8: Exclusion Patterns
     */
    describe('Exclusion Patterns', function() {
        it('should exclude files matching patterns', function(done) {
            fs.writeFileSync(path.join(sourceDir, 'include.txt'), 'include me');
            fs.writeFileSync(path.join(sourceDir, 'exclude.log'), 'exclude me');
            fs.mkdirSync(path.join(sourceDir, 'node_modules'));
            fs.writeFileSync(path.join(sourceDir, 'node_modules', 'package.json'), '{}');

            const job = {
                id: 'test-exclude',
                name: 'Exclusion Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: ['*.log', 'node_modules/'],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    expect(fs.existsSync(path.join(destDir, 'include.txt'))).to.be.true;
                    expect(fs.existsSync(path.join(destDir, 'exclude.log'))).to.be.false;
                    expect(fs.existsSync(path.join(destDir, 'node_modules'))).to.be.false;

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * TEST 9: Large File Handling
     */
    describe('Large File Handling', function() {
        it('should handle files > 100MB correctly', function(done) {
            this.timeout(120000); // 2 minutes for large file

            const largefile = path.join(sourceDir, 'large.bin');
            const size = 100 * 1024 * 1024; // 100 MB

            // Create 100MB file filled with random data
            const fd = fs.openSync(largefile, 'w');
            const chunk = Buffer.alloc(1024 * 1024, 'x'); // 1MB chunks
            for (let i = 0; i < 100; i++) {
                fs.writeSync(fd, chunk);
            }
            fs.closeSync(fd);

            const originalSize = fs.statSync(largefile).size;
            expect(originalSize).to.equal(size);

            const job = {
                id: 'test-large-file',
                name: 'Large File Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, (msg) => console.log(msg), null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    const backupFile = path.join(destDir, 'large.bin');
                    const backupSize = fs.statSync(backupFile).size;

                    expect(backupSize).to.equal(originalSize);

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * TEST 10: Deep Directory Hierarchies
     */
    describe('Deep Directory Structures', function() {
        it('should handle deeply nested directories', function(done) {
            // Create 20-level deep directory structure
            let currentPath = sourceDir;
            for (let i = 0; i < 20; i++) {
                currentPath = path.join(currentPath, `level${i}`);
                fs.mkdirSync(currentPath);
            }
            fs.writeFileSync(path.join(currentPath, 'deep.txt'), 'I am very deep');

            const job = {
                id: 'test-deep',
                name: 'Deep Directory Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    let backupPath = destDir;
                    for (let i = 0; i < 20; i++) {
                        backupPath = path.join(backupPath, `level${i}`);
                    }

                    const deepFile = path.join(backupPath, 'deep.txt');
                    expect(fs.existsSync(deepFile)).to.be.true;
                    expect(fs.readFileSync(deepFile, 'utf8')).to.equal('I am very deep');

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });

    /**
     * TEST 11: Special Characters in Filenames
     */
    describe('Special Characters in Filenames', function() {
        it('should handle filenames with spaces, unicode, and special chars', function(done) {
            const files = [
                'file with spaces.txt',
                'file-with-dashes.txt',
                'file_with_underscores.txt',
                'emoji-😀-test.txt',
                'unicode-日本語.txt',
                "file'with'quotes.txt",
                'file(with)parens.txt',
                'file[with]brackets.txt'
            ];

            files.forEach(filename => {
                fs.writeFileSync(path.join(sourceDir, filename), `content of ${filename}`);
            });

            const job = {
                id: 'test-special-chars',
                name: 'Special Characters Test',
                sourcePath: sourceDir,
                destPath: destDir,
                mode: 'MIRROR',
                config: {
                    archive: true,
                    recursive: true,
                    compress: false,
                    verbose: false,
                    delete: false,
                    excludePatterns: [],
                    customFlags: ''
                }
            };

            service.runBackup(job, () => {}, null).then(result => {
                try {
                    expect(result.success).to.be.true;

                    files.forEach(filename => {
                        const backupFile = path.join(destDir, filename);
                        expect(fs.existsSync(backupFile)).to.be.true;
                        expect(fs.readFileSync(backupFile, 'utf8')).to.equal(`content of ${filename}`);
                    });

                    done();
                } catch (err) {
                    done(err);
                }
            }).catch(done);
        });
    });
});

/**
 * Helper function to format date in rsync backup format
 */
function formatTestDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d}-${h}${min}${s}`;
}
