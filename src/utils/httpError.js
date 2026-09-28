export class HttpError extends Error {
  constructor(status, message, details, headers) {
    super(message);
    this.status = status;
    this.details = details;
    this.headers = headers;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`);
