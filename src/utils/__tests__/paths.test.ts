import { describe, it, expect } from 'vitest';
import {
  isSshRemote,
  sshLocalPart,
  makeRelative,
  makeAbsolute,
  joinPaths,
  getParentPath,
  getFileName,
} from '../paths';

describe('isSshRemote', () => {
  it('returns true for SSH remote paths', () => {
    expect(isSshRemote('user@host:/path')).toBe(true);
    expect(isSshRemote('user@192.168.1.1:/var/www')).toBe(true);
    expect(isSshRemote('admin@server.example.com:/home/admin')).toBe(true);
  });

  it('returns false for local paths', () => {
    expect(isSshRemote('/local/path')).toBe(false);
    expect(isSshRemote('/Volumes/Backup/folder')).toBe(false);
  });

  it('returns false for invalid SSH formats', () => {
    expect(isSshRemote('relative/path')).toBe(false);
    expect(isSshRemote('user@host')).toBe(false); // Missing colon
    expect(isSshRemote('host:/path')).toBe(false); // Missing @
  });
});

describe('sshLocalPart', () => {
  it('extracts local path from SSH remote', () => {
    expect(sshLocalPart('user@host:/var/www')).toBe('/var/www');
    expect(sshLocalPart('user@host:/')).toBe('/');
    expect(sshLocalPart('user@host:/a/b/c')).toBe('/a/b/c');
  });

  it('returns null for non-SSH paths', () => {
    expect(sshLocalPart('/local/path')).toBeNull();
    expect(sshLocalPart('relative/path')).toBeNull();
  });
});

describe('makeRelative', () => {
  it('makes paths relative to root', () => {
    expect(makeRelative('/a/b/c', '/a/b')).toBe('c');
    expect(makeRelative('/a/b/c/d', '/a/b')).toBe('c/d');
    expect(makeRelative('/Volumes/Backup/snap/Users/john', '/Volumes/Backup/snap')).toBe(
      'Users/john'
    );
  });

  it('returns empty string for exact match', () => {
    expect(makeRelative('/a/b', '/a/b')).toBe('');
  });

  it('handles root with trailing slash', () => {
    expect(makeRelative('/a/b/c', '/a/b/')).toBe('c');
  });

  it('returns original path if not under root', () => {
    expect(makeRelative('/x/y/z', '/a/b')).toBe('/x/y/z');
  });
});

describe('makeAbsolute', () => {
  it('reconstructs absolute path from relative', () => {
    expect(makeAbsolute('Users/john', '/Volumes/Backup')).toBe('/Volumes/Backup/Users/john');
    expect(makeAbsolute('foo/bar', '/root')).toBe('/root/foo/bar');
  });

  it('returns root for empty relative path', () => {
    expect(makeAbsolute('', '/Volumes/Backup')).toBe('/Volumes/Backup');
  });

  it('handles root with trailing slash', () => {
    expect(makeAbsolute('foo', '/root/')).toBe('/root/foo');
  });
});

describe('joinPaths', () => {
  it('joins path segments', () => {
    expect(joinPaths('/a/b', 'c')).toBe('/a/b/c');
    expect(joinPaths('/a/b', 'c/d')).toBe('/a/b/c/d');
  });

  it('handles trailing slashes', () => {
    expect(joinPaths('/a/b/', 'c')).toBe('/a/b/c');
  });

  it('handles empty segment', () => {
    expect(joinPaths('/a/b', '')).toBe('/a/b');
  });
});

describe('getParentPath', () => {
  it('returns parent directory', () => {
    expect(getParentPath('/a/b/c')).toBe('/a/b');
    expect(getParentPath('/a/b')).toBe('/a');
    expect(getParentPath('/a')).toBe('/');
  });

  it('handles root', () => {
    expect(getParentPath('/')).toBe('/');
  });

  it('handles trailing slash', () => {
    expect(getParentPath('/a/b/c/')).toBe('/a/b');
  });
});

describe('getFileName', () => {
  it('extracts filename from path', () => {
    expect(getFileName('/a/b/file.txt')).toBe('file.txt');
    expect(getFileName('/a/b/folder')).toBe('folder');
    expect(getFileName('/file.txt')).toBe('file.txt');
  });

  it('handles trailing slash', () => {
    expect(getFileName('/a/b/')).toBe('b');
  });
});
