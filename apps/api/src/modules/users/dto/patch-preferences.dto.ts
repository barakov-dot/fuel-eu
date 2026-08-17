import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class PatchPreferencesDto {
  @IsOptional()
  @IsUUID()
  preferredFuelTypeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  preferredCurrency?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultRefuelLiters?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  vehicleConsumptionLPer100Km?: string | null;

  @IsOptional()
  @IsIn(['en', 'ru'])
  locale?: string;
}
