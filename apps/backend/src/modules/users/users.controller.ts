import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { Roles } from '../../shared/auth/roles.decorator.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('admin/users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateAdminUserDto) {
    return this.usersService.createAdminUser(dto);
  }
}