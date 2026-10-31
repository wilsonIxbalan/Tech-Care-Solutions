type ErrorRecord = Record<string, unknown>;
const driverCodes = new Set([
  'ETIMEOUT', 'ESOCKET', 'ECONNCLOSED', 'ENOTOPEN', 'ELOGIN', 'EINSTLOOKUP',
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EREQUEST',
]);
const unavailableNumbers = new Set([
  40615, 18456, 4060, 40613, 40197, 40501, 10928, 10929, 49918, 49919, 49920,
]);

/** Solo campos enumerados/numericos; NO mensajes ni stacks del driver. */
export function databaseDiagnostics(error: unknown) {
  let driverCode: string | undefined;
  let sqlNumber: number | undefined;
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();
  for (let index = 0; index < queue.length && index < 12; index++) {
    const candidate = queue[index];
    if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) continue;
    visited.add(candidate);
    const record = candidate as ErrorRecord;
    if (!driverCode && typeof record.code === 'string' && driverCodes.has(record.code))
      driverCode = record.code;
    if (sqlNumber === undefined && typeof record.number === 'number'
      && Number.isInteger(record.number) && record.number >= 0 && record.number <= 2147483647)
      sqlNumber = record.number;
    queue.push(record.originalError, record.info, record.cause);
  }
  const category = sqlNumber === 40615 ? 'firewall'
    : sqlNumber === 18456 || sqlNumber === 4060 ? 'sql-authentication'
      : sqlNumber !== undefined && unavailableNumbers.has(sqlNumber) ? 'sql-unavailable'
        : driverCode === 'ETIMEOUT' ? 'timeout'
          : driverCode && driverCode !== 'EREQUEST' ? 'connection'
            : sqlNumber !== undefined ? 'sql-request' : 'unknown';
  return { driverCode, sqlNumber, category };
}

export function databaseUnavailable(error: unknown) {
  const { driverCode, sqlNumber } = databaseDiagnostics(error);
  return (driverCode !== undefined && driverCode !== 'EREQUEST')
    || (sqlNumber !== undefined && unavailableNumbers.has(sqlNumber));
}
