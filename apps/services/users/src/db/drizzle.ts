import { users } from '@users-service/users/domain/schemas';

const schemas = { users };
const relations = {};

export const schema = { ...schemas, ...relations };
