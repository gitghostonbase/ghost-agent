import { z } from "zod";

const nonEmptyTrimmedString = z.string().trim().min(1);

export const emptySchema = z.object({});

export const initSchema = z.object({
  ringName: nonEmptyTrimmedString,
});

export const ringAddSchema = z.object({
  github: nonEmptyTrimmedString,
});

export const commitSchema = z.object({
  message: nonEmptyTrimmedString,
});

export const verifySchema = z.object({
  sha: nonEmptyTrimmedString,
});

export type InitInput = z.infer<typeof initSchema>;
export type RingAddInput = z.infer<typeof ringAddSchema>;
export type CommitInput = z.infer<typeof commitSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
