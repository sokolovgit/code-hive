import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'test@example.com',
    type: String,
  })
  @IsEmail({}, { message: 'Invalid email' })
  email: string;
}
