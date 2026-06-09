"use client";

import * as React from "react";

import { useCooldown } from "./use-cooldown";
import { safeSession } from "./safe-storage";

interface ResendOptions {
  /** Cooldown after the first (initial) send, in seconds. */
  initial?: number;
  /** Cooldown after every subsequent send, in seconds. */
  escalated?: number;
  /** Max number of resends (not counting the initial send) before lockout. */
  max?: number;
  /**
   * Stable key to persist the cooldown deadline + send count across a refresh.
   * Without it, reloading the OTP screen resets the countdown and the lockout,
   * letting a user dodge the throttle by hitting reload. Use a key unique to
   * the flow + target (e.g. "resend:login" or "resend:register-phone").
   */
  persistKey?: string;
}

/**
 * Resend throttle for OTP flows. The first send arms a short cooldown; every
 * resend after that arms a longer one. After `max` resends the flow locks out
 * until reset. Call `send()` once for the initial code and once per resend.
 */
export function useResendCooldown({
  initial = 20,
  escalated = 60,
  max = 10,
  persistKey,
}: ResendOptions = {}) {
  const cdKey = persistKey ? `${persistKey}:until` : undefined;
  const sendsKey = persistKey ? `${persistKey}:sends` : undefined;
  const cd = useCooldown(cdKey);
  // Persist the send count alongside the deadline so a refresh keeps both the
  // countdown AND the escalation/lockout state. Lazy init (client-only).
  const [sends, setSends] = React.useState<number>(() => {
    if (!sendsKey) return 0;
    const raw = safeSession.get(sendsKey);
    const v = raw ? Number(raw) : 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  });

  const resends = Math.max(0, sends - 1);
  const lockedOut = resends >= max;

  const send = React.useCallback(() => {
    cd.start(sends === 0 ? initial : escalated);
    setSends((s) => {
      const n = s + 1;
      if (sendsKey) safeSession.set(sendsKey, String(n));
      return n;
    });
  }, [cd, sends, initial, escalated, sendsKey]);

  const reset = React.useCallback(() => {
    setSends(0);
    if (sendsKey) safeSession.remove(sendsKey);
    if (cdKey) safeSession.remove(cdKey);
  }, [sendsKey, cdKey]);

  return {
    remaining: cd.remaining,
    active: cd.active,
    sends,
    resends,
    max,
    lockedOut,
    /** Arm a cooldown for an initial send or a resend. */
    send,
    /** Clear the resend counter (e.g. when the user edits the target). */
    reset,
  };
}
