import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { SUPPORTED_GEOCODING_LANGUAGES } from '../geocoding.constants';

export class GeocodingReverseQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lon!: number;

  @IsOptional()
  @IsIn(SUPPORTED_GEOCODING_LANGUAGES)
  language?: (typeof SUPPORTED_GEOCODING_LANGUAGES)[number];
}
