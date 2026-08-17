import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ROUTING_PROFILES } from '../routing.constants';

export class RouteCoordinateDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lon!: number;
}

export class RouteRequestDto {
  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  origin!: RouteCoordinateDto;

  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  destination!: RouteCoordinateDto;

  @IsOptional()
  @IsIn(ROUTING_PROFILES)
  profile?: (typeof ROUTING_PROFILES)[number];
}
