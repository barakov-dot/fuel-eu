import { Controller, Get, Query } from '@nestjs/common';
import { GeocodingNotFoundException } from './geocoding.errors';
import { GeocodingReverseQueryDto } from './dto/geocoding-reverse.dto';
import { GeocodingSearchQueryDto } from './dto/geocoding-search.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  async search(@Query() query: GeocodingSearchQueryDto) {
    const countryCodes = query.countryCodes
      ? query.countryCodes.split(',').map((code) => code.trim().toLowerCase())
      : undefined;

    const items = await this.geocodingService.search({
      query: query.q,
      limit: query.limit,
      language: query.language,
      countryCodes,
      biasLocation:
        query.lat !== undefined && query.lon !== undefined
          ? { lat: query.lat, lon: query.lon }
          : undefined,
    });

    return { items };
  }

  @Get('reverse')
  async reverse(@Query() query: GeocodingReverseQueryDto) {
    const result = await this.geocodingService.reverse({
      lat: query.lat,
      lon: query.lon,
      language: query.language,
    });

    if (!result) {
      throw new GeocodingNotFoundException();
    }

    return result;
  }
}
