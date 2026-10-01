import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SystemConfigModule } from '../system-config/system-config.module.js';
import { InactivityScheduler } from './inactivity-scheduler.js';

@Module({
  imports: [ScheduleModule.forRoot(), SystemConfigModule],
  providers: [InactivityScheduler],
})
export class SchedulerModule {}