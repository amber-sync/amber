const { expect } = require('chai');
const { RsyncService } = require('../electron/rsync-service');
const { SyncMode, JobStatus } = require('../electron/types');

// Create a partial mock of RsyncService to access private methods if needed
class TestableRsyncService extends RsyncService {
  constructor() {
    super();
    this.fatPaths = new Set();
  }

  async isFatFilesystem(dirPath) {
    return this.fatPaths.has(dirPath);
  }

  testBuildRsyncArgs(job, finalDest, linkDest, onLog) {
    // Access private method via casting to any in TS, here in JS it's just a method if not truly private
    // In TS private methods are soft private at runtime usually, but if compiled...
    // Let's assume public access for test or use reflection if needed.
    // Actually, private methods in TS class are accessible in JS runtime unless #private syntax is used.
    return this.buildRsyncArgs(job, finalDest, linkDest, onLog);
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

  it('should generate basic flags correctly', async () => {
    const args = await service.testBuildRsyncArgs(mockJob, '/dest', null, () => {});
    expect(args).to.include('-D');
    expect(args).to.include('--numeric-ids');
    expect(args).to.include('--links');
    expect(args).to.include('--hard-links');
    expect(args).to.include('--one-file-system');
    expect(args).to.include('--itemize-changes');
    expect(args).to.include('-a'); // archive mode bundles recursive/times/owner/group/perms
    expect(args).to.include('--stats');
    expect(args).to.include('--human-readable');

    expect(args).to.include('-z'); // compress enabled

    expect(args).to.include('-v');
    expect(args).to.not.include('--delete');
  });

  it('should include --delete when configured', async () => {
    const job = { ...mockJob, config: { ...mockJob.config, delete: true } };
    const args = await service.testBuildRsyncArgs(job, '/dest', null, () => {});
    expect(args).to.include('--delete');
  });

  it('should honor compression toggle off', async () => {
    const job = { ...mockJob, config: { ...mockJob.config, compress: false } };
    const args = await service.testBuildRsyncArgs(job, '/dest', null, () => {});
    expect(args).to.not.include('-z');
  });

  it('should forbid any custom flags even if seemingly safe', async () => {
    const job = { ...mockJob, config: { ...mockJob.config, customFlags: '--progress' } };
    try {
      await service.testBuildRsyncArgs(job, '/dest', null, () => {});
      throw new Error('Expected rejection');
    } catch (err) {
      expect(err.message).to.contain('Custom flags are disabled');
    }
  });

  it('should handle SSH config', async () => {
    const job = {
      ...mockJob,
      sshConfig: {
        enabled: true,
        port: '2222',
        identityFile: '/key',
        configFile: '/config'
      }
    };
    const args = await service.testBuildRsyncArgs(job, '/dest', null, () => {});
    const sshFlagIndex = args.indexOf('-e');
    expect(sshFlagIndex).to.not.equal(-1);
    const sshCmd = args[sshFlagIndex + 1];
    expect(sshCmd).to.contain('ssh');
    expect(sshCmd).to.contain('-p 2222');
    expect(sshCmd).to.contain('-i /key');
    expect(sshCmd).to.contain('-F /config');
    expect(args).to.include('-z');
  });

  it('should handle exclusions', async () => {
    const job = {
      ...mockJob,
      config: { ...mockJob.config, excludePatterns: ['*.log', 'temp/'] }
    };
    const args = await service.testBuildRsyncArgs(job, '/dest', null, () => {});
    expect(args).to.include('--exclude=*.log');
    expect(args).to.include('--exclude=temp/');
  });

  it('should include exclusions for each mode', async () => {
    const modes = [SyncMode.MIRROR, SyncMode.ARCHIVE, SyncMode.TIME_MACHINE];
    for (const mode of modes) {
      const job = {
        ...mockJob,
        mode,
        config: { ...mockJob.config, excludePatterns: ['node_modules', '*.tmp'] }
      };
      const args = await service.testBuildRsyncArgs(job, '/dest', mode === SyncMode.TIME_MACHINE ? '/dest/prev' : null, () => {});
      expect(args).to.include('--exclude=node_modules');
      expect(args).to.include('--exclude=*.tmp');
    }
  });

  it('should append trailing slash to source path', async () => {
    const args = await service.testBuildRsyncArgs(mockJob, '/dest', null, () => {});
    expect(args[args.length - 2]).to.equal('/src/');
  });

  it('should add --modify-window when FAT detected', async () => {
    service.fatPaths.add('/src');
    const args = await service.testBuildRsyncArgs(mockJob, '/dest', null, () => {});
    expect(args).to.include('--modify-window=2');
  });

  it('should include SSH strict host key disable only when set', async () => {
    const job = {
      ...mockJob,
      sshConfig: { enabled: true, disableHostKeyChecking: true }
    };
    const args = await service.testBuildRsyncArgs(job, '/dest', null, () => {});
    const sshFlagIndex = args.indexOf('-e');
    expect(sshFlagIndex).to.not.equal(-1);
    const sshCmd = args[sshFlagIndex + 1];
    expect(sshCmd).to.contain('StrictHostKeyChecking=no');
  });

  it('should substitute placeholders in custom command including linkDest', async () => {
    const job = {
      ...mockJob,
      mode: SyncMode.TIME_MACHINE,
      config: {
        ...mockJob.config,
        customCommand: 'rsync {source} {dest} {linkDest}'
      }
    };
    const args = await service.testBuildRsyncArgs(job, '/dest/new', '/dest/old', () => {});
    expect(args).to.include('/src/');
    expect(args).to.include('/dest/new');
    expect(args).to.include('/dest/old');
  });

  it('should reject whitespace-only custom command when selected', async () => {
    const job = {
      ...mockJob,
      config: {
        ...mockJob.config,
        customCommand: '   '
      }
    };
    try {
      await service.testBuildRsyncArgs(job, '/dest', null, () => {});
      throw new Error('Expected rejection');
    } catch (err) {
      expect(err.message.toLowerCase()).to.contain('custom rsync command is selected but empty');
    }
  });

  it('should handle Time Machine mode with link-dest', async () => {
    const job = { ...mockJob, mode: SyncMode.TIME_MACHINE };
    const args = await service.testBuildRsyncArgs(job, '/dest/new-snapshot', '/dest/previous', () => {});
    expect(args).to.include('--link-dest=/dest/previous');
    expect(args[args.length - 1]).to.equal('/dest/new-snapshot');
  });

  it('should not include link-dest if not provided', async () => {
    const job = { ...mockJob, mode: SyncMode.TIME_MACHINE };
    const args = await service.testBuildRsyncArgs(job, '/dest/new-snapshot', null, () => {});
    const linkDest = args.find(a => a && a.startsWith('--link-dest'));
    expect(linkDest).to.be.undefined;
  });

  it('should reject dangerous custom flags', async () => {
    const job = {
      ...mockJob,
      config: { ...mockJob.config, customFlags: '--delete --inplace' }
    };
    try {
      await service.testBuildRsyncArgs(job, '/dest', null, () => {});
      throw new Error('Expected rejection');
    } catch (err) {
      expect(err.message).to.contain('Custom flags are disabled');
    }
  });

  it('should allow custom command with placeholders and safety flags', async () => {
    const job = {
      ...mockJob,
      config: {
        ...mockJob.config,
        customCommand: 'rsync -a --numeric-ids --one-file-system --hard-links {source} {dest}',
        customFlags: ''
      }
    };
    const args = await service.testBuildRsyncArgs(job, '/dest', null, () => {});
    expect(args[0]).to.equal('rsync');
    expect(args).to.include('/dest');
    expect(args.find(a => a.includes('/src'))).to.exist;
  });

  it('should allow custom Time Machine command even without link-dest placeholder', async () => {
    const job = {
      ...mockJob,
      mode: SyncMode.TIME_MACHINE,
      config: {
        ...mockJob.config,
        customCommand: 'rsync -a {source} {dest}'
      }
    };
    const args = await service.testBuildRsyncArgs(job, '/dest/new', '/dest/old', () => {});
    expect(args[0]).to.equal('rsync');
  });

  it('should reject empty custom command when selected', async () => {
    const job = {
      ...mockJob,
      config: {
        ...mockJob.config,
        customCommand: ''
      }
    };
    try {
      await service.testBuildRsyncArgs(job, '/dest', null, () => {});
      throw new Error('Expected rejection');
    } catch (err) {
      expect(err.message.toLowerCase()).to.contain('custom rsync command is selected but empty');
    }
  });
});
