
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { RsyncService } = require('../electron/rsync-service.ts');

describe('Rsync Progress Reporting', function() {
    this.timeout(30000);

    let testRoot;
    let sourceDir;
    let destDir;
    let service;

    beforeEach(function() {
        testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rsync-progress-test-'));
        sourceDir = path.join(testRoot, 'source');
        destDir = path.join(testRoot, 'dest');

        fs.mkdirSync(sourceDir, { recursive: true });
        fs.mkdirSync(destDir, { recursive: true });

        // Create marker
        const destBasename = path.basename(destDir);
        fs.writeFileSync(path.join(destDir, `.${destBasename}_backup-marker`), '');

        service = new RsyncService();
    });

    afterEach(function() {
        if (fs.existsSync(testRoot)) {
            fs.rmSync(testRoot, { recursive: true, force: true });
        }
    });

    it('should report progress during transfer', function(done) {
        // Create a large file to ensure transfer takes enough time to generate progress updates
        // 10MB should be enough
        const largeFile = path.join(sourceDir, 'large.bin');
        const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
        fs.writeFileSync(largeFile, buffer);

        const job = {
            id: 'test-progress',
            name: 'Progress Test',
            sourcePath: sourceDir,
            destPath: destDir,
            mode: 'MIRROR',
            config: {
                archive: true,
                recursive: true,
                compress: false,
                verbose: true, // Need verbose for progress? RsyncService adds --stats and --itemize-changes
                delete: false,
                excludePatterns: [],
                customFlags: ''
            }
        };

        let progressUpdates = [];
        
        service.runBackup(
            job, 
            (msg) => console.log(`[Log] ${msg}`), 
            (data) => {
                console.log('[Progress]', data);
                progressUpdates.push(data);
            }
        ).then(result => {
            try {
                expect(result.success).to.be.true;
                
                // We might not get updates if it's too fast, but with 10MB we should get at least one
                // or at least the "Calculating..." one.
                expect(progressUpdates.length).to.be.greaterThan(0);
                
                // Check structure of first update
                const first = progressUpdates[0];
                if (first.percentage !== undefined) {
                    expect(first).to.have.property('percentage');
                    expect(first).to.have.property('speed');
                } else {
                    // Might be the "Calculating..." update
                    expect(first).to.have.property('transferred');
                }

                done();
            } catch (err) {
                done(err);
            }
        }).catch(done);
    });
});
