import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewReassignmentRequestDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  assigneeId?: string;
}