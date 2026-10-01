import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { Roles } from '../../shared/auth/roles.decorator.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';
import { DepartmentsService } from './departments.service.js';

@Controller('admin/departments')
@Roles(Role.ADMIN)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departments.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departments.findOne(id);
  }

  @Post()
  create(@Body() input: CreateDepartmentDto) {
    return this.departments.create(input);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() input: UpdateDepartmentDto) {
    return this.departments.update(id, input);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departments.remove(id);
  }
}