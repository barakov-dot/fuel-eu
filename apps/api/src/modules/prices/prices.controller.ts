import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { StationsService } from '../stations/stations.service';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PricesService } from './prices.service';

@Controller('stations/:stationId/prices')
export class PricesController {
  constructor(
    private readonly pricesService: PricesService,
    private readonly stationsService: StationsService,
  ) {}

  @Get('latest')
  async findLatest(@Param('stationId', ParseUUIDPipe) stationId: string) {
    if (!(await this.stationsService.exists(stationId))) {
      throw new NotFoundException(`Station ${stationId} not found`);
    }
    return this.pricesService.findLatestByStation(stationId);
  }

  @Get('history')
  async findHistory(
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    if (!(await this.stationsService.exists(stationId))) {
      throw new NotFoundException(`Station ${stationId} not found`);
    }
    return this.pricesService.findHistoryByStation(stationId, query);
  }
}
