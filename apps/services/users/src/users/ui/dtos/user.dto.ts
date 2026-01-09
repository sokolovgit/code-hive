import { ApiUuidProperty } from '@code-hive/nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { UserId } from '@users-service/users/domain/schemas';

export class UserDto {
  @ApiUuidProperty({
    description: 'The ID of the user',
  })
  id: UserId;

  @ApiProperty({
    description: 'The email of the user',
    example: 'test@example.com',
    type: String,
  })
  email: string;

  @ApiProperty({
    description: 'The creation date of the user',
    example: '2021-01-01T00:00:00.000Z',
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The update date of the user',
    example: '2021-01-01T00:00:00.000Z',
    type: Date,
  })
  updatedAt: Date;
}
