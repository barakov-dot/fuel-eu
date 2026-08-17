import { ReportImagesMaintenanceCliModule } from '../../cli/report-images-maintenance-cli.module';
import { runMaintenanceCli } from '../../cli/run-maintenance-cli';
import { ReportImagesCleanupService } from '../../modules/ocr/report-images-cleanup.service';

void runMaintenanceCli({
  module: ReportImagesMaintenanceCliModule,
  label: 'Report image cleanup',
  run: async (app) =>
    app.get(ReportImagesCleanupService).cleanupExpiredImages(),
  formatResult: (removed) => {
    console.log(`Removed ${removed} expired unattached report image(s).`);
  },
});
