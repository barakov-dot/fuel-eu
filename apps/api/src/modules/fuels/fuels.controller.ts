import { Controller, Get } from '@nestjs/common';
import { FuelsService } from './fuels.service';

@Controller('fuel-types')
export class FuelsController {
  constructor(private readonly fuelsService: FuelsService) {}

  @Get()
  findAll() {
    return this.fuelsService.findAll();
  }
}
