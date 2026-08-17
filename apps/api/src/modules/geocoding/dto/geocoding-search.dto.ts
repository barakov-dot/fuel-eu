import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  GEOCODING_DEFAULT_LIMIT,
  GEOCODING_MAX_LIMIT,
  GEOCODING_MAX_QUERY_LENGTH,
  GEOCODING_MIN_QUERY_LENGTH,
  SUPPORTED_GEOCODING_LANGUAGES,
} from '../geocoding.constants';

export class GeocodingSearchQueryDto {
  @IsString()
  @MinLength(GEOCODING_MIN_QUERY_LENGTH)
  @MaxLength(GEOCODING_MAX_QUERY_LENGTH)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(GEOCODING_MAX_LIMIT)
  limit?: number = GEOCODING_DEFAULT_LIMIT;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lon?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(,[a-z]{2})*$/i, {
    message: 'countryCodes must be comma-separated ISO2 codes',
  })
  countryCodes?: string;

  @IsOptional()
  @IsIn(SUPPORTED_GEOCODING_LANGUAGES)
  language?: (typeof SUPPORTED_GEOCODING_LANGUAGES)[number];
}
