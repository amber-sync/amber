const { expect } = require('chai');
const { RsyncService } = require('../electron/rsync-service');
const { SyncMode, JobStatus } = require('../electron/types');

// Create a partial mock of RsyncService to access private methods if needed
class TestableRsyncService extends RsyncService {
  testBuildRsyncArgs(job, finalDest, linkDest) {
    // Access private method via casting to any in TS, here in JS it's just a method if not truly private
    // In TS private methods are soft private at runtime usually, but if compiled...
    // Let's assume public access for test or use reflection if needed.
    // Actually, private methods in TS class are accessible in JS runtime unless #private syntax is used.
    return this.buildRsyncArgs(job, finalDest, linkDest);
  }
}

describe('RsyncService - Unit Tests', () => {
  let service;
  const mockJob = {
    id: 'test-1',
    name: 'Test Job',
    sourcePath: '/src',
    destPath: '/dest',
    mode: SyncMode.MIRROR,
    scheduleInterval: null,
    config: {
      recursive: true,
      archive: true,
      compress: true,
      delete: false,
      verbose: true,
      excludePatterns: [],
      customFlags: ''
    },
    lastRun: null,
    status: JobStatus.IDLE
  };

  beforeEach(() => {
    service = new TestableRsyncService();
  });

  it('should generate basic flags correctly', () => {
    const args = service.testBuildRsyncArgs(mockJob, '/dest', null);
    expect(args).to.include('-D');
    expect(args).to.include('--numeric-ids');
    expect(args).to.include('--links');
    expect(args).to.include('--hard-links');
    expect(args).to.include('--one-file-system');
    expect(args).to.include('--itemize-changes');
    expect(args).to.include('--times');
    expect(args).to.include('--recursive');
    expect(args).to.include('--perms');
    expect(args).to.include('--owner');
    expect(args).to.include('--group');
    expect(args).to.include('--stats');
    expect(args).to.include('--human-readable');
    
    // Compression is only added if SSH is enabled now, or via custom flag?
    // Code says: if (conf.compress) args.push('--compress');
    // mockJob has compress: true.
    expect(args).to.include('--compress');
    
    expect(args).to.include('-v');
    expect(args).to.not.include('--delete');
  });

  it('should include --delete when configured', () => {
    const job = { ...mockJob, config: { ...mockJob.config, delete: true } };
    const args = service.testBuildRsyncArgs(job, '/dest', null);
    expect(args).to.include('--delete');
  });

  it('should handle SSH config', () => {
    const job = { 
      ...mockJob, 
      sshConfig: { 
        enabled: true, 
        port: '2222', 
        identityFile: '/key',
        configFile: '/config'
      } 
    };
    const args = service.testBuildRsyncArgs(job, '/dest', null);
    const sshFlagIndex = args.indexOf('-e');
    expect(sshFlagIndex).to.not.equal(-1);
    const sshCmd = args[sshFlagIndex + 1];
    expect(sshCmd).to.contain('ssh');
    expect(sshCmd).to.contain('-p 2222');
    expect(sshCmd).to.contain('-i /key');
    expect(sshCmd).to.contain('-F /config');
  });

  it('should handle exclusions', () => {
    const job = { 
      ...mockJob, 
      config: { ...mockJob.config, excludePatterns: ['*.log', 'temp/'] } 
    };
    const args = service.testBuildRsyncArgs(job, '/dest', null);
    expect(args).to.include('--exclude=*.log');
    expect(args).to.include('--exclude=temp/');
  });

  it('should handle Time Machine mode with link-dest', () => {
    const job = { ...mockJob, mode: SyncMode.TIME_MACHINE };
    const args = service.testBuildRsyncArgs(job, '/dest/new-snapshot', '/dest/previous');
    expect(args).to.include('--link-dest=/dest/previous');
    expect(args[args.length - 1]).to.equal('/dest/new-snapshot');
  });

  it('should not include link-dest if not provided', () => {
    const job = { ...mockJob, mode: SyncMode.TIME_MACHINE };
    const args = service.testBuildRsyncArgs(job, '/dest/new-snapshot', null);
    const linkDest = args.find(a => a && a.startsWith('--link-dest'));
    expect(linkDest).to.be.undefined;
  });
});

