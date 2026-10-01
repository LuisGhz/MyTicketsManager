import { Module } from '@nestjs/common';
import { SystemConfigController } from './system-config.controller.js';
import { SystemConfigService } from './system-config.service.js';

@Module({
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}