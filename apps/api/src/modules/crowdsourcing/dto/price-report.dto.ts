import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { REPORT_COMMENT_MAX_LENGTH } from '../crowdsourcing.constants';

class ReportLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;
}

class OriginalCandidateDto {
  @IsOptional()
  @IsUUID()
  fuelTypeId?: string;

  @IsOptional()
  @IsString()
  fuelCodeSuggestion?: string;

  @IsOptional()
  @IsString()
  rawLabel?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class CreatePriceReportDto {
  @IsUUID()
  fuelTypeId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'price must be a decimal string with up to 4 decimal places',
  })
  price!: string;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsOptional()
  @IsISO8601()
  reportedAt?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportLocationDto)
  location?: ReportLocationDto;

  @IsOptional()
  @IsString()
  @MaxLength(REPORT_COMMENT_MAX_LENGTH)
  comment?: string;

  @IsOptional()
  @IsUUID()
  reportImageId?: string;

  @IsOptional()
  @IsBoolean()
  ocrAssisted?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OriginalCandidateDto)
  originalCandidate?: OriginalCandidateDto;
}

export class ListStationReportsQueryDto {
  @IsOptional()
  @IsUUID()
  fuelTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ListMyReportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}
