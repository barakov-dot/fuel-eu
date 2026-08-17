import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestionCoreModule } from '../../cli/ingestion-core.module';
import { CrowdsourcingModule } from '../crowdsourcing/crowdsourcing.module';
import { IngestionController } from './ingestion.controller';
import { IngestionSchedulerService } from './scheduler/ingestion-scheduler.service';

@Module({
  imports: [IngestionCoreModule, ScheduleModule.forRoot(), CrowdsourcingModule],
  controllers: [IngestionController],
  providers: [IngestionSchedulerService],
  exports: [IngestionCoreModule, IngestionSchedulerService],
})
export class IngestionModule {}
