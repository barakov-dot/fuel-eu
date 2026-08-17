import { AuthMaintenanceCliModule } from '../../cli/auth-maintenance-cli.module';
import { runMaintenanceCli } from '../../cli/run-maintenance-cli';
import { SessionCleanupService } from '../../modules/auth/session-cleanup.service';

void runMaintenanceCli({
  module: AuthMaintenanceCliModule,
  label: 'Session cleanup',
  run: async (app) => app.get(SessionCleanupService).cleanupExpiredSessions(),
  formatResult: (removed) => {
    console.log(`Removed ${removed} expired auth session(s).`);
  },
});
