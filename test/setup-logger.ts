import { Logger } from '@nestjs/common';

// Keeps test output readable; specs that assert on logging spy on Logger.prototype directly.
Logger.overrideLogger(false);
