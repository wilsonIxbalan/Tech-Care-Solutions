import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../../common/api-error';

export const loginLimit = { attempts: 20, windowMs: 300000, maxKeys: 10000 };

@Injectable()
export class LoginLimiter {
  private readonly entries = new Map<
    string,
    { attempts: number; expires: number }
  >();
  private nextSweep = 0;

  consume(identifier: string) {
    const now = Date.now();
    if (now >= this.nextSweep) {
      for (const [key, entry] of this.entries)
        if (entry.expires <= now) this.entries.delete(key);
      this.nextSweep = now + 60000;
    }
    // No almacenar correos ni usernames en memoria ni confiar en X-Forwarded-For.
    const normalized = identifier
      .trim()
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase();
    const key = createHash('sha256').update(normalized).digest('hex');
    let entry = this.entries.get(key);
    if (entry && entry.expires <= now) {
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      // Nunca rechazar todos los logins por saturación del mapa.
      if (this.entries.size >= loginLimit.maxKeys)
        this.entries.delete(this.entries.keys().next().value!);
      entry = { attempts: 0, expires: now + loginLimit.windowMs };
      this.entries.set(key, entry);
    }
    if (entry.attempts >= loginLimit.attempts)
      throw new ApiError(
        429,
        'LOGIN_LIMITADO',
        'Demasiados intentos para este identificador. Espera cinco minutos.',
      );
    entry.attempts++;
  }
}
