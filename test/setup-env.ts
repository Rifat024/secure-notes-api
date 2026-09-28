process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-integration-test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/replaced-in-before-all';
process.env.CORS_ORIGIN = 'http://localhost:5173';
