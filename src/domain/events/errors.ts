const EXPECTED_FORMAT =
  '[HH:mm:ss] FamilyA [has] killed FamilyB from GuildB (CharacterB, CharacterA), or Ikusa raw-session JSON v4';

export class InvalidLogFileNameError extends Error {
  constructor(fileName: string) {
    super(`Expected a dated .log or .ikusa.json filename, but received "${fileName}".`);
    this.name = 'InvalidLogFileNameError';
  }
}

export class UnrecognizedLogError extends Error {
  readonly expectedFormat = EXPECTED_FORMAT;

  constructor() {
    super(`The file does not contain recognized BDO events. Expected format: ${EXPECTED_FORMAT}`);
    this.name = 'UnrecognizedLogError';
  }
}
