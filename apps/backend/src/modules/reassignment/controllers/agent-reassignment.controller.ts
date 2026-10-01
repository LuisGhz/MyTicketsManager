import { Body, Controller, Param, Post } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums.js';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/auth/jwt-payload.type.js';
import { Roles } from '../../../shared/auth/roles.decorator.js';
import { CreateReassignmentRequestDto } from '../dtos/create-reassignment-request.dto.js';
import { ReassignmentService } from '../services/reassignment.service.js';

@Controller('tickets')
export class AgentReassignmentController {
  constructor(private readonly reassignmentService: ReassignmentService) {}

  @Post(':id/reassignment-request')
  @Roles(Role.AGENT)
  createRequest(
    @Param('id') ticketId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateReassignmentRequestDto,
  ) {
    return this.reassignmentService.createRequest(ticketId, currentUser, dto);
  }
}