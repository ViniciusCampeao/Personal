import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

/**
 * Validates a request body against a Zod schema shared with the frontend (spec:
 * "Forms | React Hook Form + Zod (schemas compartilhados com o back)"). Failures come
 * out as an array of "path: message" strings, which `ProblemDetailsFilter` renders as
 * the RFC 7807 `errors` field.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues.map(
        (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      );
      throw new BadRequestException({ message });
    }
    return result.data;
  }
}
