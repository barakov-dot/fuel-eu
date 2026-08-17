import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { DeleteAccountDto } from '../auth/dto/auth.dto';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PatchPreferencesDto } from './dto/patch-preferences.dto';
import { FavoritesService } from './favorites.service';
import { PreferencesService } from './preferences.service';

@Controller('me')
@UseGuards(SessionAuthGuard)
export class MeController {
  constructor(
    private readonly preferencesService: PreferencesService,
    private readonly favoritesService: FavoritesService,
    private readonly authService: AuthService,
  ) {}

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.getPreferences(user.id);
  }

  @Patch('preferences')
  patchPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PatchPreferencesDto,
  ) {
    return this.preferencesService.patchPreferences(user.id, dto);
  }

  @Get('favorites')
  async listFavorites(@CurrentUser() user: AuthenticatedUser) {
    const preferences = await this.preferencesService.getPreferences(user.id);
    return this.favoritesService.listFavorites(
      user.id,
      preferences.preferredFuelTypeId ?? undefined,
    );
  }

  @Post('favorites/:stationId')
  @HttpCode(204)
  async addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stationId', ParseUUIDPipe) stationId: string,
  ) {
    await this.favoritesService.addFavorite(user.id, stationId);
  }

  @Delete('favorites/:stationId')
  @HttpCode(204)
  async removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stationId', ParseUUIDPipe) stationId: string,
  ) {
    await this.favoritesService.removeFavorite(user.id, stationId);
  }

  @Delete()
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.authService.deleteAccount(user.id, dto.password);
  }
}
