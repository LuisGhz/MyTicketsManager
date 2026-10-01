import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): Env['PORT'] {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): Env['DATABASE_URL'] {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get jwtSecret(): Env['JWT_SECRET'] {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiresIn(): Env['JWT_EXPIRES_IN'] {
    return this.config.get('JWT_EXPIRES_IN', { infer: true });
  }

  get resendApiKey(): Env['RESEND_API_KEY'] {
    return this.config.get('RESEND_API_KEY', { infer: true });
  }

  get mailFrom(): Env['MAIL_FROM'] {
    return this.config.get('MAIL_FROM', { infer: true });
  }

  get appUrl(): Env['APP_URL'] {
    return this.config.get('APP_URL', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}