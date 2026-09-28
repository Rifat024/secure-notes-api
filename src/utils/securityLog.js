export function securityLog(event, details = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.warn(JSON.stringify({ type: 'security', event, at: new Date().toISOString(), ...details }));
}
