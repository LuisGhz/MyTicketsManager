import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  const jwtSecret = 'test-secret-with-at-least-32-characters';

  it('parses valid environment values with defaults', () => {
    expect(
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/tickets',
        JWT_SECRET: jwtSecret,
      }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/tickets',
      JWT_SECRET: jwtSecret,
      JWT_EXPIRES_IN: '1d',
      MAIL_FROM: 'MyTicketsManager <onboarding@resend.dev>',
      APP_URL: 'http://localhost:5173',
    });
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/tickets',
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_SECRET/);
  });
});