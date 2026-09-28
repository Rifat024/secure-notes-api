import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { rethrow } from '../common/utils/rethrow';

@ApiTags('Health')
@Public()
@SkipThrottle()
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
