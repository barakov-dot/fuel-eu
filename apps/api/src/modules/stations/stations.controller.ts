import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { BboxStationsQueryDto } from './dto/bbox-stations-query.dto';
import { NearbyStationsQueryDto } from './dto/nearby-stations-query.dto';
import { StationsQueryService } from './stations-query.service';
import { StationsService } from './stations.service';

@Controller('stations')
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
    private readonly stationsQueryService: StationsQueryService,
  ) {}

  @Get('nearby')
  findNearby(@Query() query: NearbyStationsQueryDto) {
    return this.stationsQueryService.findNearby(query);
  }

  @Get('bbox')
  findInBbox(@Query() query: BboxStationsQueryDto) {
    return this.stationsQueryService.findInBbox(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const station = await this.stationsService.findOne(id);
    if (!station) {
      throw new NotFoundException(`Station ${id} not found`);
    }
    return station;
  }
}
