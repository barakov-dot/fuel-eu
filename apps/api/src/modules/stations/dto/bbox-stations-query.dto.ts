import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DEFAULT_BBOX_LIMIT, MAX_BBOX_LIMIT } from '../stations.constants';
import { parseQueryBoolean } from './query-transforms';

export class BboxStationsQueryDto {
  @Type(() => Number)
  @IsLongitude()
  west!: number;

  @Type(() => Number)
  @IsLatitude()
  south!: number;

  @Type(() => Number)
  @IsLongitude()
  east!: number;

  @Type(() => Number)
  @IsLatitude()
  north!: number;

  @IsOptional()
  @IsUUID()
  fuelTypeId?: string;

  @IsOptional()
  @Transform(({ value }) => parseQueryBoolean(value))
  @IsBoolean()
  onlyWithPrice?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BBOX_LIMIT)
  limit?: number = DEFAULT_BBOX_LIMIT;
}
