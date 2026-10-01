import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import { DepartmentsService } from './departments.service.js';

describe('DepartmentsService', () => {
  it('rejects a duplicate department name', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: 'department-existing' }),
      },
    } as unknown as PrismaService;
    const service = new DepartmentsService(prisma);

    await expect(service.create({ name: 'Support' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects deleting a department that still has tickets', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: 'department-1', _count: { tickets: 2 } }),
      },
    } as unknown as PrismaService;
    const service = new DepartmentsService(prisma);

    await expect(service.remove('department-1')).rejects.toBeInstanceOf(ConflictException);
  });
});