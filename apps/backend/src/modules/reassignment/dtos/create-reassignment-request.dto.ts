import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateReassignmentRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetAgentId?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(1000)
  reason!: string;
}