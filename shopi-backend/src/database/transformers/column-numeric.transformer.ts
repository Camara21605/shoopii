// src/database/transformers/column-numeric.transformer.ts

import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {

  // DB → JS
  from(value: string | null): number {
    if (value === null || value === undefined) return 0;
    return parseFloat(value);
  }

  // JS → DB
  to(value: number | null): number {
    if (value === null || value === undefined) return 0;
    return value;
  }
}