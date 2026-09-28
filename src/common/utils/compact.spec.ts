import { compact } from './compact';

describe('compact', () => {
  it('drops undefined values but keeps falsy ones', () => {
    expect(compact({ a: undefined, b: 0, c: '', d: null, e: 'x' })).toEqual({ b: 0, c: '', d: null, e: 'x' });
    expect(compact(undefined)).toEqual({});
  });
});
