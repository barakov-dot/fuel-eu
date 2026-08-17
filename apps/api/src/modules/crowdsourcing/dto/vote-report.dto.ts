import { IsIn, IsString } from 'class-validator';

export class VoteReportDto {
  @IsString()
  @IsIn(['confirm', 'dispute'])
  vote!: 'confirm' | 'dispute';
}
