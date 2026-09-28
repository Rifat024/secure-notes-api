import { HttpError } from '../utils/httpError.js';

export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      return next(new HttpError(400, 'Validation failed', result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }))));
    }
    // Express 5 exposes req.query as a getter, so parsed values are stored separately.
    req.valid = { ...req.valid, [key]: result.data };
  }
  return next();
};
