import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.constants';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import {
  IMAGE_MAX_BYTES,
  IMAGE_STATUS_POLL_THROTTLE,
  UPLOAD_THROTTLE,
} from './ocr.constants';
import { ReportImagesService } from './report-images.service';

@Controller()
export class ReportImagesController {
  constructor(private readonly reportImagesService: ReportImagesService) {}

  @Post('stations/:stationId/report-images')
  @HttpCode(201)
  @UseGuards(SessionAuthGuard, ThrottlerGuard)
  @Throttle({
    [UPLOAD_THROTTLE.name]: {
      ttl: UPLOAD_THROTTLE.ttl,
      limit: UPLOAD_THROTTLE.limit,
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  async uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.reportImagesService.uploadImage(user.id, stationId, file);
  }

  @Get('report-images/:imageId')
  @UseGuards(SessionAuthGuard, ThrottlerGuard)
  @Throttle({
    [IMAGE_STATUS_POLL_THROTTLE.name]: {
      ttl: IMAGE_STATUS_POLL_THROTTLE.ttl,
      limit: IMAGE_STATUS_POLL_THROTTLE.limit,
    },
  })
  async getImageStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.reportImagesService.getImageStatus(user.id, imageId);
  }

  @Get('report-images/:imageId/content')
  @UseGuards(SessionAuthGuard)
  async getImageContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res() response: Response,
  ) {
    const content = await this.reportImagesService.getImageContent(
      user.id,
      imageId,
    );

    response.setHeader('Content-Type', content.mimeType);
    response.setHeader('Content-Disposition', 'inline');
    response.send(content.buffer);
  }

  @Delete('report-images/:imageId')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async deleteImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    await this.reportImagesService.deleteImage(user.id, imageId);
  }
}
