export type ErrorCode =
  | 'INVALID_N'
  | 'N_TOO_LARGE'
  | 'INVALID_CHARS'
  | 'LENGTH_MISMATCH'
  | 'UNBALANCED_SEQUENCE'
  | 'NEGATIVE_RANK'
  | 'RANK_OUT_OF_RANGE'
  | 'INVALID_RANK'
  | 'PREFIX_SYNTAX'
  | 'PREFIX_TOO_MANY_PARENS'
  | 'PREFIX_BELOW_ZERO'
  | 'INVALID_LIMIT'
  | 'LIMIT_TOO_LARGE'
  | 'INVALID_START'
  | 'INVALID_QUERY_TYPE'
  | 'NOT_FOUND'
  | 'BAD_REQUEST';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail?: unknown;

  constructor(code: ErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

export const MAX_N = 200;
export const MAX_PAGE_LIMIT = 1000;
