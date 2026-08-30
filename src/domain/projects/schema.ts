import { z } from 'zod';

import { CURRENT_PROJECT_SCHEMA_VERSION } from './constants';

const isoTimestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Expected an ISO timestamp.',
});

const nonNegativeNumber = z.number().finite().nonnegative();
const positiveInteger = z.number().int().positive();

export const synchronizationAnchorSchema = z.strictObject({
  eventId: z.string().min(1),
  eventSessionTimeSeconds: nonNegativeNumber,
  videoTimeSeconds: nonNegativeNumber,
  offsetSeconds: z.number().finite(),
});

export const vodReferenceSchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string().trim().min(1).max(255),
  fileName: z.string().trim().min(1).max(255),
  fileSizeBytes: z.number().int().nonnegative(),
  lastModifiedMs: z.number().int().nonnegative().nullable(),
  durationSeconds: nonNegativeNumber.nullable(),
  width: positiveInteger.nullable(),
  height: positiveInteger.nullable(),
  nominalFrameRate: z.number().finite().positive().nullable(),
  variableFrameRate: z.boolean().nullable(),
  videoCodec: z.string().max(120).nullable(),
  audioCodec: z.string().max(120).nullable(),
  synchronizationAnchor: synchronizationAnchorSchema.nullable(),
  searchTerms: z.array(z.string().trim().min(1).max(120)).max(50),
});

export const clipSchema = z.strictObject({
  id: z.uuid(),
  vodId: z.uuid(),
  title: z.string().trim().max(240),
  inPointSeconds: nonNegativeNumber,
  outPointSeconds: nonNegativeNumber,
  searchTermsSnapshot: z.array(z.string().trim().min(1).max(120)).max(50),
  matchingEventIds: z.array(z.string().min(1)).max(100_000),
  order: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
  exportStatus: z.enum(['notExported', 'exporting', 'exported', 'failed']),
  lastErrorCode: z.string().max(120).nullable(),
});

export const portableProjectSchema = z.strictObject({
  schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
  appVersion: z.string().min(1).max(50),
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  sessionDate: z.iso.date().nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  rawLog: z.string().max(5_000_000).nullable(),
  parserVersion: z.number().int().positive(),
  vods: z.array(vodReferenceSchema).max(500),
  clips: z.array(clipSchema).max(100_000),
  clipOrder: z.array(z.uuid()).max(100_000),
  uiState: z.strictObject({
    clipPanelCollapsed: z.boolean(),
  }),
  davinciDefaults: z.strictObject({
    frameRate: z.number().finite().positive(),
    width: positiveInteger,
    height: positiveInteger,
  }),
});

export type PortableProject = z.infer<typeof portableProjectSchema>;
