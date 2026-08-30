export interface InspectedVideoMetadata {
  readonly durationSeconds: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly nominalFrameRate: number | null;
  readonly variableFrameRate: boolean | null;
  readonly videoCodec: string | null;
  readonly audioCodec: string | null;
}

export interface VideoMetadataInspector {
  inspect(file: File): Promise<InspectedVideoMetadata>;
}
