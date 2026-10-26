import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SessionUser } from './auth.dto';
import { cookieName, CurrentUser, Public } from './access';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private cookie(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body);
    response.cookie(
      cookieName(this.config.get('NODE_ENV') === 'production'),
      result.token,
      { ...this.cookie(), maxAge: 3600000 },
    );
    return { usuario: result.usuario, expiresIn: result.expiresIn };
  }
  @ApiCookieAuth('session') @Get('me') me(@CurrentUser() user: SessionUser) {
    return user;
  }
  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(
      cookieName(this.config.get('NODE_ENV') === 'production'),
      this.cookie(),
    );
    return { message: 'Sesión cerrada.' };
  }
}
