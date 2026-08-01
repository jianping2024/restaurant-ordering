/** Sole query shape for on-prem web runtime log viewer. */
export type SystemLogQuery = {
  from: Date;
  to: Date;
  /** Case-insensitive substring; empty = no keyword filter. */
  q: string;
};

/** Sole line shape returned to API/UI. */
export type SystemLogLine = {
  ts: string;
  message: string;
};

export type SystemLogQueryResult = {
  lines: SystemLogLine[];
  truncated: boolean;
  source: 'docker' | 'file';
};
