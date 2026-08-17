import { Module } from '@nestjs/common';
import { FuelsController } from './fuels.controller';
import { FuelsService } from './fuels.service';

@Module({
  controllers: [FuelsController],
  providers: [FuelsService],
  exports: [FuelsService],
})
export class FuelsModule {}
