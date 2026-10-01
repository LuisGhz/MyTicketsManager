import { IsIn, IsString, Matches } from 'class-validator';
import { INACTIVITY_DAYS_BEFORE_CLOSE_KEY } from '../system-config.constants.js';

/** PATCH accepts one key/value pair; only the inactivity-days key is currently supported. */
export class UpdateSystemConfigDto {
  @IsString()
  @IsIn([INACTIVITY_DAYS_BEFORE_CLOSE_KEY])
  key!: string;

  @IsString()
  @Matches(/^[1-9]\d*$/)
  value!: string;
}