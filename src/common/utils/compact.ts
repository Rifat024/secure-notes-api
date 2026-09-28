/** Drops undefined values so partial updates never overwrite fields the client did not send. */
export function compact<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
}
