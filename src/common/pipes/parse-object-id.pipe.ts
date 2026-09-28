import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { rethrow } from '../utils/rethrow.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    try {
      if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
        throw new BadRequestException({ error: 'Validation failed', details: [{ path: 'id', message: 'Invalid id' }] });
      }
      return value;
    } catch (error) {
      rethrow(error, 'ParseObjectIdPipe.transform');
    }
  }
}
