import { Module } from '@nestjs/common';
import { IngestionCoreModule } from './ingestion-core.module';

@Module({
  imports: [IngestionCoreModule],
  exports: [IngestionCoreModule],
})
export class IngestionCliModule {}
