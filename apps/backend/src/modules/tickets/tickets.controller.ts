import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import { Roles } from '../../shared/auth/roles.decorator.js';
import type { AuthenticatedUser } from '../../shared/auth/jwt-payload.type.js';
import {
  AssignTicketDto,
  CreateTicketCommentDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tickets.create(dto, actor);
  }

  @Get()
  findAll(
    @Query() query: ListTicketsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tickets.findAll(query, actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tickets.findOne(id, actor);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tickets.updateStatus(id, dto, actor);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN)
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.tickets.assign(id, dto);
  }

  @Post(':id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tickets.addComment(id, dto, actor);
  }
}