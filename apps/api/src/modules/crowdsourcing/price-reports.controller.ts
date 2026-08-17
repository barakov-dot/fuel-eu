import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.constants';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { REPORT_THROTTLE, VOTE_THROTTLE } from './crowdsourcing.constants';
import {
  CreatePriceReportDto,
  ListMyReportsQueryDto,
  ListStationReportsQueryDto,
} from './dto/price-report.dto';
import { VoteReportDto } from './dto/vote-report.dto';
import { OptionalSessionAuthGuard } from './optional-session-auth.guard';
import { PriceReportsService } from './price-reports.service';
import { ReputationService } from './reputation.service';

@Controller()
export class PriceReportsController {
  constructor(
    private readonly priceReportsService: PriceReportsService,
    private readonly reputationService: ReputationService,
  ) {}

  @Post('stations/:stationId/reports')
  @HttpCode(201)
  @UseGuards(SessionAuthGuard, ThrottlerGuard)
  @Throttle({
    [REPORT_THROTTLE.name]: {
      ttl: REPORT_THROTTLE.ttl,
      limit: REPORT_THROTTLE.limit,
    },
  })
  async createReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Body() dto: CreatePriceReportDto,
  ) {
    return this.priceReportsService.createReport(user.id, stationId, dto);
  }

  @Get('stations/:stationId/reports')
  @UseGuards(OptionalSessionAuthGuard)
  async listStationReports(
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Query() query: ListStationReportsQueryDto,
    @Req() request: Request,
  ) {
    return this.priceReportsService.listStationReports(
      stationId,
      query.fuelTypeId,
      query.limit ?? 20,
      request.user?.id,
    );
  }

  @Put('reports/:reportId/vote')
  @HttpCode(200)
  @UseGuards(SessionAuthGuard, ThrottlerGuard)
  @Throttle({
    [VOTE_THROTTLE.name]: {
      ttl: VOTE_THROTTLE.ttl,
      limit: VOTE_THROTTLE.limit,
    },
  })
  async voteOnReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: VoteReportDto,
  ) {
    return this.priceReportsService.voteOnReport(user.id, reportId, dto);
  }

  @Get('me/reports')
  @UseGuards(SessionAuthGuard)
  async listMyReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyReportsQueryDto,
  ) {
    return this.priceReportsService.listMyReports(user.id, query.limit ?? 20);
  }

  @Get('me/reputation')
  @UseGuards(SessionAuthGuard)
  async getMyReputation(@CurrentUser() user: AuthenticatedUser) {
    return this.reputationService.getSummary(user.id);
  }
}
