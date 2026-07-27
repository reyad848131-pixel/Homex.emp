import { z } from "zod";

// Centralized request-body validation schemas. Applied at the top of mutation
// routes so malformed input is rejected with a clear message before it can
// reach Prisma. Monetary fields are still re-computed/clamped in quote-calc.ts;
// these schemas guard shape and required fields.

export const loginSchema = z.object({
  civilId: z.string().trim().min(1),
  password: z.string().min(1),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  phoneCode: z.string().trim().optional(),
  governorate: z.string().trim().min(1),
  wilayat: z.string().trim().min(1),
  address: z.string().trim().nullish(),
});

export const customerUpdateSchema = z
  .object({
    name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    phoneCode: z.string().trim(),
    governorate: z.string().trim().min(1),
    wilayat: z.string().trim().min(1),
    address: z.string().nullish(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const quoteItemSchema = z.object({
  categoryId: z.string().min(1),
  description: z.string().optional(),
  details: z.unknown().optional(),
  quantity: z.coerce.number().finite().optional(),
  unitPrice: z.coerce.number().finite().optional(),
  extras: z.coerce.number().finite().optional(),
  lineTotal: z.coerce.number().finite().optional(),
});

export const createQuotationSchema = z.object({
  customer: customerSchema,
  items: z.array(quoteItemSchema).min(1, "يجب إضافة بند واحد على الأقل"),
  notes: z.string().nullish(),
  advancePct: z.coerce.number().min(0).max(100).optional(),
  deliveryDate: z.string().nullish(),
  deliveryTime: z.string().nullish(),
});

export const updateQuotationItemsSchema = z.object({
  items: z.array(quoteItemSchema).min(1, "يجب إضافة بند واحد على الأقل"),
  customer: customerSchema.partial().optional(),
  customerId: z.string().optional(),
  vatRate: z.coerce.number().min(0).optional(),
  advancePct: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().nullish(),
  deliveryDate: z.string().nullish(),
  deliveryTime: z.string().nullish(),
});

export const ROLES = ["admin", "manager", "sales", "accountant", "driver"] as const;

export const employeeCreateSchema = z.object({
  name: z.string().trim().min(1),
  civilId: z.string().trim().min(1),
  phone: z.string().trim().nullish(),
  phoneCode: z.string().trim().nullish(),
  // Any role key; the route verifies it exists among system + custom roles.
  role: z.string().trim().min(1).default("sales"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export const employeeUpdateSchema = z
  .object({
    name: z.string().trim().min(1),
    phone: z.string().trim().nullish(),
    phoneCode: z.string().trim().nullish(),
    role: z.string().trim().min(1),
    isActive: z.boolean(),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const changePasswordSchema = z.object({
  action: z.literal("change-password"),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export const paymentSchema = z.object({
  quotationId: z.string().min(1),
  amount: z.coerce.number().positive("مبلغ الدفعة غير صحيح"),
  method: z.string().optional(),
  reference: z.string().nullish(),
  notes: z.string().nullish(),
});

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Validates `data` against `schema`, returning either the typed value or a
 * flattened first-error message suitable for a 400 response body.
 */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    return {
      ok: false,
      error: path ? `${path}: ${first.message}` : first?.message ?? "Invalid input",
    };
  }
  return { ok: true, data: result.data };
}
