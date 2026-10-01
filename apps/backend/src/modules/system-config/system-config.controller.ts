import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { Roles } from '../../shared/auth/roles.decorator.js';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto.js';
import { SystemConfigService } from './system-config.service.js';

@Controller('admin/config')
@Roles(Role.ADMIN)
export class SystemConfigController {
  constructor(private readonly systemConfig: SystemConfigService) {}

  @Get()
  findAll() {
    return this.systemConfig.findAll();
  }

  @Patch()
  update(@Body() input: UpdateSystemConfigDto) {
    return this.systemConfig.update(input);
  }
}