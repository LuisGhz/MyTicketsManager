import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../../shared/auth/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto, SetupDto, VerifyAccountDto } from './dto/auth.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('setup-status')
  getSetupStatus() {
    return this.authService.getSetupStatus();
  }

  @Public()
  @Post('setup')
  setup(@Body() dto: SetupDto) {
    return this.authService.setup(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('verify')
  verify(@Body() dto: VerifyAccountDto) {
    return this.authService.verify(dto);
  }

  @Public()
  @Post('register')
  register(): never {
    return this.authService.register();
  }
}