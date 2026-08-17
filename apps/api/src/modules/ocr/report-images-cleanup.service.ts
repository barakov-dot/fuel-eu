import { Injectable } from '@nestjs/common';
import { ReportImagesService } from './report-images.service';

@Injectable()
export class ReportImagesCleanupService {
  constructor(private readonly reportImagesService: ReportImagesService) {}

  async cleanupExpiredImages(): Promise<number> {
    return this.reportImagesService.cleanupExpiredUnattached();
  }
}
