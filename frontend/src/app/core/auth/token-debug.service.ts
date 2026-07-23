import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

interface SafeTokenDebugMetadata {
  readonly present: boolean;
  readonly length?: number;
  readonly segmentCount?: number;
  readonly isJwt?: boolean;
  readonly expiresAt?: string;
  readonly isExpired?: boolean;
  readonly secondsUntilExpiry?: number;
  readonly tokenType?: string;
  readonly claimKeys?: string[];
}

@Injectable({ providedIn: 'root' })
export class TokenDebugService {
  /**
   * Decode JWT and log safe metadata only. Never print token contents or claim values.
   */
  debugToken(token: string | undefined, label: string): void {
    if (!environment.enableDebugLogs) {
      return;
    }

    console.debug(`[TokenDebug] ${label}`, this.describeToken(token));
  }

  /**
   * Compare two tokens without exposing either token or decoded personal claims.
   */
  compareTokens(
    token1: string | undefined,
    token2: string | undefined,
    label1: string,
    label2: string
  ): void {
    if (!environment.enableDebugLogs) {
      return;
    }

    console.debug(`[TokenDebug] Comparing: ${label1} vs ${label2}`, {
      bothMissing: !token1 && !token2,
      bothPresent: !!token1 && !!token2,
      tokensMatch: !!token1 && !!token2 && token1 === token2,
      [label1]: this.describeToken(token1),
      [label2]: this.describeToken(token2)
    });
  }

  private describeToken(token: string | undefined): SafeTokenDebugMetadata {
    if (!token) {
      return { present: false };
    }

    const parts = token.split('.');
    const metadata: SafeTokenDebugMetadata = {
      present: true,
      length: token.length,
      segmentCount: parts.length,
      isJwt: parts.length === 3
    };

    if (parts.length !== 3) {
      return metadata;
    }

    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + (4 - (payload.length % 4 || 4)), '=');
      const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
      const exp = typeof claims.exp === 'number' ? claims.exp : undefined;
      const tokenType = claims.typ ?? claims.token_use ?? claims.token_type ?? 'access';

      if (!exp) {
        return {
          ...metadata,
          tokenType: String(tokenType),
          claimKeys: Object.keys(claims).sort()
        };
      }

      const expiresAt = new Date(exp * 1000);
      const secondsUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      return {
        ...metadata,
        expiresAt: expiresAt.toISOString(),
        isExpired: secondsUntilExpiry <= 0,
        secondsUntilExpiry,
        tokenType: String(tokenType),
        claimKeys: Object.keys(claims).sort()
      };
    } catch {
      return metadata;
    }
  }
}
