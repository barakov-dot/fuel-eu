import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PriceSelectionModule } from '../prices/price-selection.module';
import { StationsModule } from '../stations/stations.module';
import { FavoritesService } from './favorites.service';
import { MeController } from './me.controller';
import { PreferencesService } from './preferences.service';

@Module({
  imports: [AuthModule, StationsModule, PriceSelectionModule],
  controllers: [MeController],
  providers: [PreferencesService, FavoritesService],
  exports: [PreferencesService, FavoritesService],
})
export class UsersModule {}
