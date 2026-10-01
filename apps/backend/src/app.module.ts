import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module.js';
import { SharedAuthModule } from './shared/auth/shared-auth.module.js';
import { MailModule } from './shared/infrastructure/mail/mail.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { SystemConfigModule } from './modules/system-config/system-config.module.js';
import { SchedulerModule } from './modules/scheduler/scheduler.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { ReassignmentModule } from './modules/reassignment/reassignment.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    SharedAuthModule,
    MailModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    SystemConfigModule,
    SchedulerModule,
    TicketsModule,
    ReassignmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
