import { Module } from '@nestjs/common';
import { AdminReassignmentController } from './controllers/admin-reassignment.controller.js';
import { AgentReassignmentController } from './controllers/agent-reassignment.controller.js';
import { ReassignmentService } from './services/reassignment.service.js';

@Module({
  controllers: [AgentReassignmentController, AdminReassignmentController],
  providers: [ReassignmentService],
  exports: [ReassignmentService],
})
export class ReassignmentModule {}