"use client";

import * as React from "react";
import { CircleNotch, Play } from "@phosphor-icons/react/dist/ssr";

import { ApiError } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  title: string;
  description?: string;
  controls: React.ReactNode;
  run: () => Promise<unknown>;
  method: string;
  path: string;
}

export function EndpointCard({ title, description, controls, run, method, path }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  // `ok` marks an outcome; `status` holds the real HTTP status when we have it.
  // The API client only surfaces the status on *failure* (via ApiError) — on
  // success it returns just the parsed body — so we can't assert "200" for a
  // success that was really a 201/204. We show "ok" for success instead of
  // fabricating 200, and the actual error status on failure.
  const [outcome, setOutcome] = React.useState<{ ok: boolean; status: number | null } | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setOutcome(null);
    try {
      const r = await run();
      setResult(r);
      setOutcome({ ok: true, status: null });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setOutcome({ ok: false, status: e.status });
        setResult(e.body);
      } else {
        setError(String(e));
        setOutcome({ ok: false, status: null });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {method} {path}
          </span>
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-2">{controls}</div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRun} disabled={loading} size="sm">
            {loading ? <CircleNotch className="animate-spin" /> : <Play />}
            run
          </Button>
          {outcome !== null && (
            <span
              className={
                "rounded px-2 py-0.5 text-xs font-mono " +
                (outcome.ok
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive")
              }
            >
              {outcome.status ?? (outcome.ok ? "ok" : "error")}
            </span>
          )}
        </div>
        {error && (
          <pre className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </pre>
        )}
        {result !== null && (
          <pre className="max-h-96 overflow-auto rounded border bg-muted p-3 font-mono text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
