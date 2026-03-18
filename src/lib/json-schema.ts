import type { ZodTypeAny } from 'zod';

type JsonSchema = Record<string, unknown>;

type ZodLike = ZodTypeAny & {
  description?: string;
  _def: Record<string, unknown>;
};

function getTypeName(schema: ZodLike): string | undefined {
  return schema?._def?.typeName as string | undefined;
}

function getDescription(schema: ZodLike): string | undefined {
  return schema.description;
}

function unwrapSchema(schema: ZodLike): { schema: ZodLike; optional: boolean; nullable: boolean; defaultValue?: unknown } {
  let current = schema;
  let optional = false;
  let nullable = false;
  let defaultValue: unknown;

  while (current?._def) {
    const typeName = getTypeName(current);

    if (typeName === 'ZodOptional') {
      optional = true;
      current = current._def.innerType as ZodLike;
      continue;
    }

    if (typeName === 'ZodDefault') {
      optional = true;
      defaultValue = (current._def.defaultValue as (() => unknown) | undefined)?.();
      current = current._def.innerType as ZodLike;
      continue;
    }

    if (typeName === 'ZodNullable') {
      nullable = true;
      current = current._def.innerType as ZodLike;
      continue;
    }

    break;
  }

  return { schema: current, optional, nullable, defaultValue };
}

function addMetadata(schema: JsonSchema, zodSchema: ZodLike, defaultValue?: unknown): JsonSchema {
  const description = getDescription(zodSchema);
  return {
    ...schema,
    ...(description ? { description } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
  };
}

function convertArray(schema: ZodLike, defaultValue?: unknown): JsonSchema {
  const itemSchema = schema._def.type as ZodLike;
  return addMetadata(
    {
      type: 'array',
      items: zodSchemaToJsonSchema(itemSchema),
    },
    schema,
    defaultValue,
  );
}

function convertObject(schema: ZodLike, defaultValue?: unknown): JsonSchema {
  const shapeSource = schema._def.shape;
  const shape = typeof shapeSource === 'function' ? shapeSource() : shapeSource;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape as Record<string, ZodLike>)) {
    const normalized = unwrapSchema(value);
    properties[key] = zodSchemaToJsonSchema(value);
    if (!normalized.optional) {
      required.push(key);
    }
  }

  return addMetadata(
    {
      type: 'object',
      properties,
      additionalProperties: false,
      ...(required.length > 0 ? { required } : {}),
    },
    schema,
    defaultValue,
  );
}

export function zodSchemaToJsonSchema(schema: unknown): JsonSchema {
  if (!schema || typeof schema !== 'object' || !('_def' in schema)) {
    return { type: 'object', properties: {}, additionalProperties: true };
  }

  const normalized = unwrapSchema(schema as ZodLike);
  const zodSchema = normalized.schema;
  const typeName = getTypeName(zodSchema);

  let jsonSchema: JsonSchema;

  switch (typeName) {
    case 'ZodObject':
      jsonSchema = convertObject(zodSchema, normalized.defaultValue);
      break;
    case 'ZodString':
      jsonSchema = addMetadata({ type: 'string' }, zodSchema, normalized.defaultValue);
      break;
    case 'ZodNumber':
      jsonSchema = addMetadata({ type: 'number' }, zodSchema, normalized.defaultValue);
      break;
    case 'ZodBoolean':
      jsonSchema = addMetadata({ type: 'boolean' }, zodSchema, normalized.defaultValue);
      break;
    case 'ZodEnum':
      jsonSchema = addMetadata({ type: 'string', enum: zodSchema._def.values }, zodSchema, normalized.defaultValue);
      break;
    case 'ZodArray':
      jsonSchema = convertArray(zodSchema, normalized.defaultValue);
      break;
    default:
      jsonSchema = addMetadata({}, zodSchema, normalized.defaultValue);
      break;
  }

  if (normalized.nullable) {
    const existingType = jsonSchema.type;
    if (typeof existingType === 'string') {
      jsonSchema.type = [existingType, 'null'];
    }
  }

  return jsonSchema;
}
