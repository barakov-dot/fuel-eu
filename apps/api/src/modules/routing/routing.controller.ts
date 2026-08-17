import { Body, Controller, Post } from '@nestjs/common';
import { RouteRequestDto } from './dto/route-request.dto';
import { RouteStationsRequestDto } from './dto/route-stations-request.dto';
import { RouteStationsService } from './route-stations.service';
import { RoutingService } from './routing.service';

@Controller('routes')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly routeStationsService: RouteStationsService,
  ) {}

  @Post()
  async createRoute(@Body() body: RouteRequestDto) {
    const result = await this.routingService.route({
      origin: body.origin,
      destination: body.destination,
      profile: body.profile,
    });

    return {
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      geometry: result.geometry,
      bbox: result.bbox,
    };
  }

  @Post('stations')
  async findStationsAlongRoute(@Body() body: RouteStationsRequestDto) {
    return this.routeStationsService.findStationsAlongRoute({
      origin: body.origin,
      destination: body.destination,
      fuelTypeId: body.fuelTypeId,
      currency: body.currency,
      corridorKm: body.corridorKm,
      limit: body.limit,
      refuelLiters: body.refuelLiters,
      vehicleConsumptionLPer100Km: body.vehicleConsumptionLPer100Km,
      referencePrice: body.referencePrice,
      maxPrice: body.maxPrice,
      onlyWithPrice: body.onlyWithPrice,
      maxPriceAgeHours: body.maxPriceAgeHours,
      sort: body.sort,
      profile: body.profile,
    });
  }
}
