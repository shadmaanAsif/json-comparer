export const SAMPLE_A = JSON.stringify(
  { status: "ok", data: { id: 42, amount: 100, tags: ["api", "stable"] }, meta: { version: 1 } },
  null,
  2
);

export const SAMPLE_B = JSON.stringify(
  {
    status: "ok",
    data: { id: 42, amount: 150, tags: ["stable", "api"], currency: "USD" },
    meta: { version: "2" }
  },
  null,
  2
);

export const MAX_DOCUMENT_BYTES = Number(
  process.env.NEXT_PUBLIC_MAX_DOCUMENT_BYTES ?? 10 * 1024 * 1024
);

export const APP_AUTHOR = (process.env.NEXT_PUBLIC_APP_AUTHOR ?? "").trim();
