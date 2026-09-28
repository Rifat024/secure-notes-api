import { resolveLogLevels } from './app-logger';

describe('resolveLogLevels', () => {
  it('enables the chosen level and every more severe one', () => {
    expect(resolveLogLevels('warn')).toEqual(['fatal', 'error', 'warn']);
    expect(resolveLogLevels('verbose')).toEqual(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']);
  });

  it('defaults to log for missing or unknown values', () => {
    expect(resolveLogLevels(undefined)).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(resolveLogLevels('loud')).toEqual(['fatal', 'error', 'warn', 'log']);
  });
});
