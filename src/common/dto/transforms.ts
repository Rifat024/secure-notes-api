import { Transform } from 'class-transformer';

export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const TrimLower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Trims, lower-cases, and de-duplicates a list of interest tags. */
export const NormalizeTags = () =>
  Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : tag)))]
      : value,
  );
