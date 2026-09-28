import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { SkipRateLimit } from '../common/decorators/rate-limit.decorator.js';
import { rethrow } from '../common/utils/rethrow.js';

@ApiTags('Health')
@Public()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  @Get()
  check() {
    try {
      return { status: 'ok' };
    } catch (error) {
      rethrow(error, 'HealthController.check');
    }
  }
}
