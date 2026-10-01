import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '../../../generated/prisma/enums.js';
import { Roles } from '../../../shared/auth/roles.decorator.js';
import { ListReassignmentRequestsDto } from '../dtos/list-reassignment-requests.dto.js';
import { ReviewReassignmentRequestDto } from '../dtos/review-reassignment-request.dto.js';
import { ReassignmentService } from '../services/reassignment.service.js';

@Controller('admin/reassignment-requests')
@Roles(Role.ADMIN)
export class AdminReassignmentController {
  constructor(private readonly reassignmentService: ReassignmentService) {}

  @Get()
  listRequests(@Query() query: ListReassignmentRequestsDto) {
    return this.reassignmentService.listRequests(query.status);
  }

  @Patch(':id')
  reviewRequest(@Param('id') id: string, @Body() dto: ReviewReassignmentRequestDto) {
    return this.reassignmentService.reviewRequest(id, dto);
  }
}