const EXPECTED_FORMAT = '[HH:mm:ss] FamilyA killed FamilyB from GuildB (CharacterB, CharacterA)';

export class InvalidLogFileNameError extends Error {
  constructor(fileName: string) {
    super(`Expected a valid YYYY-MM-DD.log filename, but received "${fileName}".`);
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
