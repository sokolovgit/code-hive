import { ApiProperty } from '@nestjs/swagger';

export function ApiUuidProperty(...rest: Parameters<typeof ApiProperty>) {
  return ApiProperty({
    example: '0c168cb5-d5e0-459c-9265-71b5aada4a7e',
    format: 'uuid',
    type: 'string',
    ...rest[0],
  });
}
