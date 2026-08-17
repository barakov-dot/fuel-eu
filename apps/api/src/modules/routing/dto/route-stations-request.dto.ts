import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import {
  DEFAULT_CORRIDOR_KM,
  DEFAULT_ROUTE_STATIONS_LIMIT,
  DEFAULT_ROUTE_STATIONS_SORT,
  MAX_CORRIDOR_KM,
  MAX_ROUTE_STATIONS_LIMIT,
  ROUTE_STATIONS_SORT_VALUES,
  ROUTING_PROFILES,
} from '../routing.constants';
import { RouteCoordinateDto } from './route-request.dto';

function parseDecimalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return String(value);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return undefined;
}

function IsDecimalInRange(
  minExclusive: number,
  maxInclusive: number,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDecimalInRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          const num = Number(value);
          return (
            Number.isFinite(num) && num > minExclusive && num <= maxInclusive
          );
        },
      },
    });
  };
}

export class RouteStationsRequestDto {
  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  origin!: RouteCoordinateDto;

  @ValidateNested()
  @Type(() => RouteCoordinateDto)
  destination!: RouteCoordinateDto;

  @IsUUID()
  fuelTypeId!: string;

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1)
  @Max(MAX_CORRIDOR_KM)
  corridorKm?: number = DEFAULT_CORRIDOR_KM;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ROUTE_STATIONS_LIMIT)
  limit?: number = DEFAULT_ROUTE_STATIONS_LIMIT;

  @Transform(({ value }) => parseDecimalString(value))
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  @IsDecimalInRange(0, 200, { message: 'refuelLiters must be > 0 and <= 200' })
  refuelLiters!: string;

  @Transform(({ value }) => parseDecimalString(value))
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  @IsDecimalInRange(0, 50, {
    message: 'vehicleConsumptionLPer100Km must be > 0 and <= 50',
  })
  vehicleConsumptionLPer100Km!: string;

  @IsOptional()
  @Transform(({ value }) => parseDecimalString(value))
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  referencePrice?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  onlyWithPrice?: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  maxPriceAgeHours?: number;

  @IsOptional()
  @IsIn(ROUTE_STATIONS_SORT_VALUES)
  sort?: (typeof ROUTE_STATIONS_SORT_VALUES)[number] =
    DEFAULT_ROUTE_STATIONS_SORT;

  @IsOptional()
  @IsIn(ROUTING_PROFILES)
  profile?: (typeof ROUTING_PROFILES)[number];
}
