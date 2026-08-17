import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PRICE_HISTORY_LIMIT,
  MAX_PRICE_HISTORY_LIMIT,
} from '../prices.constants';

export class PriceHistoryQueryDto {
  @IsUUID()
  fuelTypeId!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_HISTORY_LIMIT)
  limit?: number = DEFAULT_PRICE_HISTORY_LIMIT;
}
