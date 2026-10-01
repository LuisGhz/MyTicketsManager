import { vi } from 'vitest';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE } from './system-config.constants.js';
import { SystemConfigService } from './system-config.service.js';

describe('SystemConfigService', () => {
  it('falls back to seven days when the config row is missing', async () => {
    const prisma = {
      systemConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SystemConfigService(prisma);

    await expect(service.getInactivityDays()).resolves.toBe(DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE);
  });

  it('falls back to seven days when the config value is invalid', async () => {
    const prisma = {
      systemConfig: { findUnique: vi.fn().mockResolvedValue({ value: '0' }) },
    } as unknown as PrismaService;
    const service = new SystemConfigService(prisma);

    await expect(service.getInactivityDays()).resolves.toBe(DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE);
  });
});