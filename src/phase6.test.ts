import { describe, expect, it } from 'vitest';
import { friendlySyncError } from './sync/controller';

describe('friendlySyncError', () => {
  it('tells the user to sign in again when the login has expired', () => {
    expect(friendlySyncError('JWT expired')).toMatch(/sign in again/i);
    expect(friendlySyncError('Invalid Refresh Token: Refresh Token Not Found')).toMatch(/sign in again/i);
  });

  it('explains permission problems without database jargon', () => {
    const msg = friendlySyncError('new row violates row-level security policy for table "events"');
    expect(msg).not.toMatch(/row-level/i);
    expect(msg).toMatch(/account/i);
  });

  it('always reassures that nothing is lost for other failures', () => {
    expect(friendlySyncError('something odd')).toMatch(/safe on this device/i);
  });
});
