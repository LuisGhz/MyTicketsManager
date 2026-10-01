import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service.js';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found.');
    return department;
  }

  async create(input: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { name: input.name },
      select: { id: true },
    });
    if (existing) throw new ConflictException('A department with this name already exists.');

    try {
      return await this.prisma.department.create({ data: input });
    } catch (error: unknown) {
      if (this.#errorCode(error) === 'P2002') {
        throw new ConflictException('A department with this name already exists.');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateDepartmentDto) {
    await this.findOne(id);
    const duplicate = await this.prisma.department.findFirst({
      where: { name: input.name, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('A department with this name already exists.');

    try {
      return await this.prisma.department.update({ where: { id }, data: input });
    } catch (error: unknown) {
      if (this.#errorCode(error) === 'P2002') {
        throw new ConflictException('A department with this name already exists.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, _count: { select: { tickets: true } } },
    });
    if (!department) throw new NotFoundException('Department not found.');
    if (department._count.tickets > 0) {
      throw new ConflictException('Cannot delete a department that still has tickets.');
    }

    try {
      return await this.prisma.department.delete({ where: { id } });
    } catch (error: unknown) {
      if (this.#errorCode(error) === 'P2003') {
        throw new ConflictException('Cannot delete a department that still has tickets.');
      }
      throw error;
    }
  }

  #errorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    return typeof error.code === 'string' ? error.code : undefined;
  }
}