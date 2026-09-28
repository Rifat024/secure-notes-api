import { IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TrimLower } from '../../common/dto/transforms';

export class InterestQueryDto extends PaginationQueryDto {
  @IsOptional()
  @TrimLower()
  @IsString()
  @Length(1, 40)
  interest?: string;
}
