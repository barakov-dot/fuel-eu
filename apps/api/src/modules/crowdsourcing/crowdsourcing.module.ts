import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OcrModule } from '../ocr/ocr.module';
import { PriceSelectionModule } from '../prices/price-selection.module';
import { REPORT_THROTTLE, VOTE_THROTTLE } from './crowdsourcing.constants';
import { ConfidenceService } from './confidence.service';
import { CrowdsourcedReconciliationService } from './crowdsourced-reconciliation.service';
import { OptionalSessionAuthGuard } from './optional-session-auth.guard';
import { PriceReportsController } from './price-reports.controller';
import { PriceReportsService } from './price-reports.service';
import { ReportModerationService } from './report-moderation.service';
import { ReputationService } from './reputation.service';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => OcrModule),
    PriceSelectionModule,
    ThrottlerModule.forRoot([
      {
        name: REPORT_THROTTLE.name,
        ttl: REPORT_THROTTLE.ttl,
        limit: REPORT_THROTTLE.limit,
      },
      {
        name: VOTE_THROTTLE.name,
        ttl: VOTE_THROTTLE.ttl,
        limit: VOTE_THROTTLE.limit,
      },
    ]),
  ],
  controllers: [PriceReportsController],
  providers: [
    PriceReportsService,
    ReputationService,
    ConfidenceService,
    ReportModerationService,
    CrowdsourcedReconciliationService,
    OptionalSessionAuthGuard,
  ],
  exports: [
    PriceReportsService,
    ReputationService,
    CrowdsourcedReconciliationService,
    ReportModerationService,
  ],
})
export class CrowdsourcingModule {}
