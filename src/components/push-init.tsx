"use client";

import * as React from "react";

import { registerPushWorker } from "@/lib/push";

/**
 * Registers the push service worker on load so an existing subscription keeps
 * delivering and sw.js updates propagate. Never prompts — permission is asked
 * only when the user flips the settings toggle.
 */
export function PushInit() {
  React.useEffect(() => {
    void registerPushWorker();
  }, []);
  return null;
}
