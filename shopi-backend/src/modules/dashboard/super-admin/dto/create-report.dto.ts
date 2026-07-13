import { IsString, IsOptional, IsEnum, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ReportSeverity } from '../../../../database/entities/report.entity';

export class CreateReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ReportSeverity)
  severity?: ReportSeverity;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}
