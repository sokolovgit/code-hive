import { Inject } from '@nestjs/common';

import { DRIZZLE_DB } from './drizzle.constants';

/**
 * Inject Drizzle database instance
 */
export const InjectDrizzle = () => Inject(DRIZZLE_DB);
