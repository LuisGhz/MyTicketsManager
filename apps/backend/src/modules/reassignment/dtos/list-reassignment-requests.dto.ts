import { IsEnum, IsOptional } from 'class-validator';
import { ReassignmentStatus } from '../../../generated/prisma/enums.js';

export class ListReassignmentRequestsDto {
  @IsOptional()
  @IsEnum(ReassignmentStatus)
  status?: ReassignmentStatus;
}