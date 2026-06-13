import { describe, expect, it } from 'vitest';

import { parseRemoteOwnerName, parseRepoReference, parseRepoVisibility } from './repo.js';

describe('parseRepoVisibility', () => {
  it('parses private status', () => {
    expect(parseRepoVisibility('{"isPrivate": true}')).toBe(true);
    expect(parseRepoVisibility('{"isPrivate": false}')).toBe(false);
  });

  it('throws on invalid payload', () => {
    expect(() => parseRepoVisibility('{"private": true}')).toThrow();
  });
});

describe('parseRepoReference', () => {
  it('parses short repo name with authenticated-user fallback', () => {
    expect(parseRepoReference('my-mimocode-config', 'ihildy')).toEqual({
      owner: 'ihildy',
      name: 'my-mimocode-config',
    });
  });

  it('parses explicit owner/repo input', () => {
    expect(parseRepoReference('acme/mimocode-sync', 'ignored')).toEqual({
      owner: 'acme',
      name: 'mimocode-sync',
    });
  });

  it('parses GitHub https repo URLs', () => {
    expect(parseRepoReference('https://github.com/acme/mimocode-sync.git', 'ignored')).toEqual({
      owner: 'acme',
      name: 'mimocode-sync',
    });
  });

  it('parses GitHub ssh:// repo URLs', () => {
    expect(parseRepoReference('ssh://git@github.com/acme/mimocode-sync.git', 'ignored')).toEqual({
      owner: 'acme',
      name: 'mimocode-sync',
    });
  });

  it('parses GitHub SSH repo URLs', () => {
    expect(parseRepoReference('git@github.com:acme/mimocode-sync.git', 'ignored')).toEqual({
      owner: 'acme',
      name: 'mimocode-sync',
    });
  });

  it('parses GitHub SSH repo URLs with trailing slash', () => {
    expect(parseRepoReference('git@github.com:acme/mimocode-sync.git/', 'ignored')).toEqual({
      owner: 'acme',
      name: 'mimocode-sync',
    });
  });

  it('returns null for invalid repo references', () => {
    expect(parseRepoReference('https://example.com/acme/mimocode-sync', 'ignored')).toBeNull();
    expect(
      parseRepoReference('https://github.com/acme/mimocode-sync/issues', 'ignored')
    ).toBeNull();
    expect(parseRepoReference('acme/mimocode/sync', 'ignored')).toBeNull();
    expect(parseRepoReference('git@notgithub:acme/mimocode-sync', 'ignored')).toBeNull();
    expect(parseRepoReference('   ', 'ihildy')).toBeNull();
  });
});

describe('parseRemoteOwnerName', () => {
  it('parses SSH remote URLs', () => {
    expect(parseRemoteOwnerName('git@github.com:RicoBorra/mimocode-synced.git')).toEqual({
      owner: 'RicoBorra',
      name: 'mimocode-synced',
    });
  });

  it('parses SSH remote URLs without .git suffix', () => {
    expect(parseRemoteOwnerName('git@github.com:acme/my-config')).toEqual({
      owner: 'acme',
      name: 'my-config',
    });
  });

  it('parses HTTPS remote URLs', () => {
    expect(parseRemoteOwnerName('https://github.com/acme/my-config.git')).toEqual({
      owner: 'acme',
      name: 'my-config',
    });
  });

  it('parses HTTPS remote URLs without .git suffix', () => {
    expect(parseRemoteOwnerName('https://github.com/acme/my-config')).toEqual({
      owner: 'acme',
      name: 'my-config',
    });
  });

  it('returns null for non-GitHub URLs', () => {
    expect(parseRemoteOwnerName('https://gitlab.com/acme/repo')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseRemoteOwnerName('not-a-url')).toBeNull();
  });
});
