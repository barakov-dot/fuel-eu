import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  AUTH_THROTTLE,
  REGISTER_THROTTLE,
  type AuthenticatedUser,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({
    [REGISTER_THROTTLE.name]: {
      limit: REGISTER_THROTTLE.limit,
      ttl: REGISTER_THROTTLE.ttl,
    },
  })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(
      dto.email,
      dto.password,
      dto.displayName,
      response,
      request.headers['user-agent'],
    );
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({
    [AUTH_THROTTLE.name]: {
      limit: AUTH_THROTTLE.limit,
      ttl: AUTH_THROTTLE.ttl,
    },
  })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(
      dto.email,
      dto.password,
      response,
      request.headers['user-agent'],
    );
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.sessionService.getCookieName();
    const token = request.cookies?.[cookieName] as string | undefined;
    await this.authService.logout(token, response);
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
