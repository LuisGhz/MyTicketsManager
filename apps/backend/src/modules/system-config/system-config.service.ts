import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import {
  DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE,
  INACTIVITY_DAYS_BEFORE_CLOSE_KEY,
} from './system-config.constants.js';
import type { UpdateSystemConfigDto } from './dto/update-system-config.dto.js';

@Injectable()
export class SystemConfigService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key: INACTIVITY_DAYS_BEFORE_CLOSE_KEY },
      create: {
        key: INACTIVITY_DAYS_BEFORE_CLOSE_KEY,
        value: String(DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE),
        description: 'Days of inactivity before RESOLVED/PENDING_USER_RESPONSE tickets auto-close',
      },
      update: {},
    });
  }

  findAll() {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async update(input: UpdateSystemConfigDto) {
    if (input.key !== INACTIVITY_DAYS_BEFORE_CLOSE_KEY) {
      throw new BadRequestException('Unknown system configuration key.');
    }

    const days = Number(input.value);
    if (!Number.isSafeInteger(days) || days <= 0) {
      throw new BadRequestException('Configuration value must be a positive integer.');
    }

    return this.prisma.systemConfig.upsert({
      where: { key: INACTIVITY_DAYS_BEFORE_CLOSE_KEY },
      create: {
        key: INACTIVITY_DAYS_BEFORE_CLOSE_KEY,
        value: input.value,
        description: 'Days of inactivity before RESOLVED/PENDING_USER_RESPONSE tickets auto-close',
      },
      update: { value: input.value },
    });
  }

  async getInactivityDays(): Promise<number> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: INACTIVITY_DAYS_BEFORE_CLOSE_KEY },
      select: { value: true },
    });
    if (!config || !/^[1-9]\d*$/.test(config.value)) return DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE;

    const days = Number(config.value);
    return Number.isSafeInteger(days) && days > 0 ? days : DEFAULT_INACTIVITY_DAYS_BEFORE_CLOSE;
  }
}