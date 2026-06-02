"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleNotch, Envelope, Phone, Warning } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { useResendCooldown } from "@/lib/use-resend";
import { findCountry, guessCountryIso2, parseE164, type Country } from "@/lib/country-codes";
import type { LoginChannel, LoginChannelOption } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/auth/otp-input";
import { CountryCodeSelect } from "@/components/auth/country-code-select";
import { ResendRow } from "@/components/auth/resend-row";

type Mode = "text" | "phone";
type Phase = "identify" | "choose" | "code";

// Wraps the real page in a Suspense boundary because `useSearchParams()` in
// the inner component bails out of static prerender otherwise.
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginPageInner />
    </React.Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  // Query params come from a sign-up pivot ("?identifier=…&notice=existing").
  // A "+"-prefixed identifier opens phone mode and pre-fills country + number.
  const search = useSearchParams();
  const initialId = search.get("identifier") ?? "";
  const initialPhone = initialId.startsWith("+") ? parseE164(initialId) : null;
  const noticeExisting = search.get("notice") === "existing";

  const [mode, setMode] = React.useState<Mode>(() =>
    initialId.startsWith("+") ? "phone" : "text",
  );
  const [phase, setPhase] = React.useState<Phase>("identify");

  const [identifier, setIdentifier] = React.useState(() =>
    initialId.startsWith("+") ? "" : initialId,
  );
  const [country, setCountry] = React.useState<Country>(
    () => initialPhone?.country ?? findCountry(guessCountryIso2()) ?? findCountry("US")!,
  );
  const [number, setNumber] = React.useState(() => initialPhone?.number ?? "");

  const [challengeId, setChallengeId] = React.useState("");
  const [options, setOptions] = React.useState<LoginChannelOption[]>([]);
  const [chosenChannel, setChosenChannel] = React.useState<LoginChannel | "">("");
  const [sentTo, setSentTo] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const resend = useResendCooldown();

  const phoneE164 = number ? `+${country.dial}${number.replace(/\D/g, "")}` : "";

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const start = () =>
    wrap(async () => {
      const value = mode === "phone" ? phoneE164 : identifier.trim();
      const r = await api.loginStart(value);
      if (!r.challenge_id) {
        // No account → continue into sign-up, carrying email or phone so the
        // user doesn't re-type, and a notice so register can flag it.
        const params: string[] = ["notice=new"];
        if (value.startsWith("+")) params.push(`phone=${encodeURIComponent(value)}`);
        else if (value.includes("@")) params.push(`email=${encodeURIComponent(value)}`);
        router.push(`/auth/register?${params.join("&")}`);
        return;
      }
      setChallengeId(r.challenge_id);
      if (r.status === "choose_channel" && (r.options?.length ?? 0) > 0) {
        setOptions(r.options ?? []);
        setPhase("choose");
      } else {
        setChosenChannel(r.channel ?? "");
        setSentTo(r.sent_to ?? "");
        setPhase("code");
        resend.send();
      }
    });

  const choose = (channel: LoginChannel) =>
    wrap(async () => {
      const r = await api.loginSelectChannel(challengeId, channel);
      setChosenChannel(channel);
      setSentTo(r.sent_to ?? "");
      setPhase("code");
      resend.send();
    });

  const doResend = () =>
    wrap(async () => {
      const r = chosenChannel
        ? await api.loginSelectChannel(challengeId, chosenChannel)
        : await api.loginStart(mode === "phone" ? phoneE164 : identifier.trim());
      if (r.challenge_id) setChallengeId(r.challenge_id);
      setSentTo(r.sent_to ?? sentTo);
      resend.send();
      toast.success("code resent");
    });

  const verify = (value = code) =>
    wrap(async () => {
      const r = await api.loginVerify(challengeId, value);
      authStore.setTokens(r.access, r.refresh);
      const me = await api.me();
      authStore.setCarbon(me);
      track.loggedIn({ method: "otp" });
      toast.success(`welcome back, @${me.username}`);
      router.replace("/chat");
    });

  const reset = () => {
    setPhase("identify");
    setChallengeId("");
    setOptions([]);
    setChosenChannel("");
    setSentTo("");
    setCode("");
    resend.reset();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  return (
    <div className="stagger-fade-in space-y-7">
      {phase !== "identify" && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />{" "}
          {phase === "choose" ? "use a different account" : "start over"}
        </button>
      )}
      {noticeExisting && phase === "identify" && (
        <div className="notice-fade-in flex items-start gap-2 border border-destructive bg-destructive/10 px-3 py-2 text-xs">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span>
            <span className="font-medium text-destructive">Seems like you already have an account.</span>{" "}
            Log in below.
          </span>
        </div>
      )}
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">welcome back</h1>
        <p className="text-sm text-muted-foreground">
          {phase === "identify" &&
            (mode === "text"
              ? "Enter your username or email to get a one-time code."
              : "Enter your phone number to get a one-time code.")}
          {phase === "choose" && "Where should we send your code?"}
          {phase === "code" &&
            (sentTo ? `Enter the code we sent to ${sentTo}.` : "Enter the code we sent you.")}
        </p>
      </header>

      {phase === "identify" && mode === "text" && (
        <section className="space-y-4">
          <div className="space-y-4">
            <Label htmlFor="identifier">username / email</Label>
            <Input
              id="identifier"
              autoFocus
              placeholder="ada · ada@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && identifier.trim() && start()}
            />
          </div>
          <Button onClick={start} disabled={!identifier.trim() || loading} className="w-full">
            {loading && <CircleNotch className="animate-spin" />}
            Get OTP
          </Button>
          <button
            type="button"
            onClick={() => switchMode("phone")}
            className="flex w-full items-center gap-1.5 text-sm text-black transition-colors hover:underline"
          >
            <Phone className="h-4 w-4" /> Use phone number instead
          </button>
        </section>
      )}

      {phase === "identify" && mode === "phone" && (
        <section className="space-y-4">
          <div className="space-y-4">
            <Label htmlFor="phone">phone number</Label>
            <div className="flex gap-2">
              <CountryCodeSelect value={country.iso2} onChange={setCountry} />
              <Input
                id="phone"
                autoFocus
                inputMode="tel"
                placeholder="555 123 4567"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && number.trim() && start()}
              />
            </div>
          </div>
          <Button onClick={start} disabled={!number.trim() || loading} className="w-full">
            {loading && <CircleNotch className="animate-spin" />}
            Get OTP
          </Button>
          <button
            type="button"
            onClick={() => switchMode("text")}
            className="flex w-full items-center gap-1.5 text-sm text-black transition-colors hover:underline"
          >
            <Envelope className="h-4 w-4" /> Use email / username instead
          </button>
        </section>
      )}

      {phase === "choose" && (
        <section className="space-y-3">
          {options.map((opt) => (
            <button
              key={opt.channel}
              onClick={() => choose(opt.channel)}
              disabled={loading}
              className="flex w-full items-center gap-3 border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
            >
              <span className="grid h-9 w-9 place-items-center bg-accent text-accent-foreground">
                {opt.channel === "email" ? <Envelope className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">
                  {opt.channel === "email" ? "Email" : "Text message"}
                </span>
                <span className="block text-xs text-muted-foreground">{opt.label}</span>
              </span>
              {loading && <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />}
            </button>
          ))}
        </section>
      )}

      {phase === "code" && (
        <section className="space-y-4">
          <div className="space-y-4">
            <Label>verification code</Label>
            <OtpInput value={code} onChange={setCode} autoFocus onComplete={(v) => verify(v)} />
            <ResendRow resend={resend} onResend={doResend} loading={loading} />
          </div>
          <Button onClick={() => verify()} disabled={code.length !== 6 || loading} className="w-full">
            {loading && <CircleNotch className="animate-spin" />}
            log in
          </Button>
        </section>
      )}

      <footer className="border-t pt-5 text-sm text-muted-foreground">
        new here?{" "}
        <Link href="/auth/register" className="font-medium text-black transition-colors hover:underline">
          create an account
        </Link>
      </footer>
    </div>
  );
}
