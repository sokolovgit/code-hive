import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { z, ZodType } from 'zod';

export const ENV = Symbol('ENV');

type ConfigModuleOptions<Schema extends ZodType<unknown>> = {
  providers: Provider[];
  validationSchema: Schema;
};

@Global()
@Module({})
export class ConfigModule {
  static forRoot<Schema extends ZodType<unknown>>(
    options: ConfigModuleOptions<Schema>
  ): DynamicModule {
    const { validationSchema } = options;

    const parsed = validationSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      throw new Error(`Env validation error: ${issues}`);
    }

    type EnvType = z.infer<Schema>;
    const validatedEnv: EnvType = parsed.data;

    process.env = validatedEnv as unknown as NodeJS.ProcessEnv;

    return {
      module: ConfigModule,
      providers: [...options.providers, { provide: ENV, useValue: validatedEnv }],
      exports: options.providers,
    };
  }
}
