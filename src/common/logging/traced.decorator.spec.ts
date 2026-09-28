import { jest } from '@jest/globals';
import { Logger, NotFoundException } from '@nestjs/common';
import { Traced } from './traced.decorator.js';

@Traced()
class Sample {
  constructor(private readonly factor: number) {}

  double(value: number) {
    return value * this.factor;
  }

  async load(id: string) {
    if (id === 'missing') throw new NotFoundException('Nope');
    if (id === 'boom') throw new Error('database down');
    return { id };
  }
}

describe('@Traced', () => {
  let verbose: ReturnType<typeof jest.spyOn>;
  let debug: ReturnType<typeof jest.spyOn>;
  let warn: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    verbose = jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
    debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps behaviour and `this` for sync and async methods', async () => {
    const sample = new Sample(2);
    expect(sample.double(4)).toBe(8);
    await expect(sample.load('a')).resolves.toEqual({ id: 'a' });
  });

  it('logs entry at verbose and completion at debug without arguments', async () => {
    await new Sample(2).load('secret-token');
    expect(verbose).toHaveBeenCalledWith('→ load');
    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^← load ok \d+ms$/));
    const everything = [...verbose.mock.calls, ...debug.mock.calls].flat().join(' ');
    expect(everything).not.toContain('secret-token');
  });

  it('logs HTTP failures at debug and unexpected failures at warn, then rethrows', async () => {
    const sample = new Sample(1);
    await expect(sample.load('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^load failed 404 Nope \d+ms$/));
    await expect(sample.load('boom')).rejects.toThrow('database down');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^load failed Error \d+ms$/));
  });
});
