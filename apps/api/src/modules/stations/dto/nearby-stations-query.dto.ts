import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_NEARBY_LIMIT,
  DEFAULT_NEARBY_RADIUS_KM,
  MAX_NEARBY_LIMIT,
  MAX_NEARBY_RADIUS_KM,
  NEARBY_SORT_DISTANCE,
  NEARBY_SORT_VALUES,
} from '../stations.constants';
import { parseQueryBoolean, parseQueryCurrency } from './query-transforms';

export class NearbyStationsQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lon!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(MAX_NEARBY_RADIUS_KM)
  radiusKm?: number = DEFAULT_NEARBY_RADIUS_KM;

  @IsOptional()
  @IsUUID()
  fuelTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NEARBY_LIMIT)
  limit?: number = DEFAULT_NEARBY_LIMIT;

  @IsOptional()
  @IsIn(NEARBY_SORT_VALUES)
  sort?: (typeof NEARBY_SORT_VALUES)[number] = NEARBY_SORT_DISTANCE;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => parseQueryCurrency(value))
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => parseQueryBoolean(value))
  @IsBoolean()
  onlyWithPrice?: boolean = false;
}
