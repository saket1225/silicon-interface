"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { generateAndStoreAvatar } from "@/lib/avatar";

import { Logo } from "@/components/logo";
import { IdAvatar } from "@/components/profile/id-avatar";
import { Button } from "@/components/ui/button";

// localStorage key the register page drops the flowId into before redirecting
// here. We pull it on mount and use it to finalize via api.registerUsername.
const FLOW_KEY = "silicon-interface:onboarding-flow";
const CARBON_ID_RE = /^[a-z0-9_.-]{3,32}$/;
const TYPE_DELAY_MS = 28;

interface Screen {
  text: (ctx: { carbonId: string; name: string }) => string;
  /** If true, the screen renders the Carbon ID input under the typewriter. */
  pickCarbonId?: boolean;
  /** If true, the screen renders the live profile preview card. */
  preview?: boolean;
  /** Custom continue button label. */
  cta?: string;
}

const SCREENS: Screen[] = [
  {
    text: () =>
      "Welcome to Silicon Interface, you can chat with Silicon and Carbons here. Let me set things up for you…",
  },
  {
    text: () =>
      "Well some context, Carbon is well you all the human elements. And Silicon… well you will know once you talk to one 😉 Let's get you started…",
  },
  {
    text: () =>
      "Choose a Carbon ID for yourself, keep in mind this can't be changed later.",
    pickCarbonId: true,
  },
  {
    text: ({ carbonId }) =>
      `cool meeting you ${carbonId}. Does this base profile look good, don't worry you can always update it with your latest picture in the profile section 😎.`,
    preview: true,
  },
  {
    text: () =>
      "Awesome man! You are all setup, enjoy Silicon Interface. Have some great conversations with Silicons and Carbons",
    cta: "Enter Silicon Interface",
  },
];

/** Strip every non-name char (digits, dashes, underscores, dots) and Title-
 *  Case the result. "saket-dev_12" → "Saketdev". Used to seed the editable
 *  display name from the Carbon ID. */
function nameFromCarbonId(cid: string): string {
  if (!cid) return "";
  const cleaned = cid.replace(/[^a-zA-Z]/g, "");
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

export default function OnboardingPage() {
  return (
    <React.Suspense fallback={null}>
      <OnboardingInner />
    </React.Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const [flowId, setFlowId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(0);
  const [carbonId, setCarbonId] = React.useState("");
  const [name, setName] = React.useState("");
  const [bio, setBio] = React.useState("");
  // Whether the user has manually typed a name. If false, we keep auto-
  // syncing it from the carbon_id.
  const [nameDirty, setNameDirty] = React.useState(false);
  const [revealed, setRevealed] = React.useState("");
  const [typingDone, setTypingDone] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);
  // Availability check for step 2.
  const [avail, setAvail] = React.useState<{
    for: string; ok: boolean; reason: string;
  } | null>(null);

  // Pull flowId once on mount. If absent, kick back to register.
  React.useEffect(() => {
    const f = window.sessionStorage.getItem(FLOW_KEY);
    if (!f) {
      router.replace("/auth/register");
      return;
    }
    setFlowId(f);
  }, [router]);

  const screen = SCREENS[step];
  const target = React.useMemo(
    () => screen.text({ carbonId, name }),
    [screen, carbonId, name],
  );

  // Typewriter for the current screen. Restarts whenever `target` (and thus
  // the step) changes.
  React.useEffect(() => {
    setRevealed("");
    setTypingDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setRevealed(target.slice(0, i));
      if (i >= target.length) {
        window.clearInterval(id);
        setTypingDone(true);
      }
    }, TYPE_DELAY_MS);
    return () => window.clearInterval(id);
  }, [target]);

  // Auto-sync name from Carbon ID until the user edits it.
  React.useEffect(() => {
    if (!nameDirty) setName(nameFromCarbonId(carbonId));
  }, [carbonId, nameDirty]);

  // Debounced availability check.
  const cid = carbonId.trim().toLowerCase();
  const formatValid = CARBON_ID_RE.test(cid);
  React.useEffect(() => {
    if (!cid || !formatValid) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.carbonIdAvailable(cid);
        setAvail({ for: cid, ok: r.valid && r.available, reason: r.reason });
      } catch {
        /* keep prior */
      }
    }, 280);
    return () => clearTimeout(t);
  }, [cid, formatValid]);

  const carbonIdReady =
    formatValid && avail?.for === cid && avail.ok;

  const skipTyping = () => {
    setRevealed(target);
    setTypingDone(true);
  };

  const next = async () => {
    if (step === 2 && !carbonIdReady) return;
    if (step === 3) {
      if (!flowId) return;
      setFinalizing(true);
      try {
        const session = await api.registerUsername(
          flowId,
          cid,
        );
        authStore.setSession(session);
        // Patch the optional name + bio.
        if (name && name !== session.carbon.name) {
          await api.patchMe({ name }).catch(() => undefined);
        }
        if (bio) {
          await api.patchMe({ tagline: bio }).catch(() => undefined);
        }
        // Generate + persist the glyph avatar in the background — never blocks.
        void generateAndStoreAvatar(session.carbon.carbon_id);
        window.sessionStorage.removeItem(FLOW_KEY);
        setStep((s) => s + 1);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : String(e));
      } finally {
        setFinalizing(false);
      }
      return;
    }
    if (step === SCREENS.length - 1) {
      router.replace("/chat");
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="bg-dots flex min-h-screen flex-col">
      <header className="px-6 pt-6">
        <Logo size={26} withWordmark />
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg space-y-8">
          <div className="label-mono text-[10px] text-muted-foreground">
            step {step + 1} of {SCREENS.length}
          </div>

          <div
            onClick={skipTyping}
            className="min-h-[140px] cursor-text whitespace-pre-wrap text-lg leading-relaxed"
            title="click to skip"
          >
            {revealed}
            {!typingDone && (
              <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-foreground align-middle" />
            )}
          </div>

          {/* Step 2 — pick Carbon ID */}
          {screen.pickCarbonId && typingDone && (
            <div className="space-y-2">
              <div className="flex items-center border border-input bg-transparent transition-colors focus-within:border-ring">
                <span className="pl-3 text-2xl text-muted-foreground">@</span>
                <input
                  autoFocus
                  value={carbonId}
                  onChange={(e) => setCarbonId(e.target.value.toLowerCase())}
                  placeholder="your-carbon-id"
                  className="h-14 w-full min-w-0 bg-transparent px-2 text-2xl font-medium tracking-tight outline-none placeholder:text-muted-foreground"
                />
                <span className="px-3 label-mono text-[10px]">
                  {formatValid
                    ? avail?.for === cid
                      ? avail.ok
                        ? "available"
                        : (avail.reason || "taken")
                      : "checking…"
                    : carbonId
                      ? "3-32 chars: a-z 0-9 _ . -"
                      : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, digits, _ . - · 3 to 32 characters · permanent
              </p>
            </div>
          )}

          {/* Step 3 — profile preview */}
          {screen.preview && typingDone && (
            <div className="flex flex-col items-center gap-4 border bg-card p-6">
              <IdAvatar seed={carbonId || "?"} src={null} size={132} />
              <div className="w-full space-y-3">
                <div className="space-y-1">
                  <label className="label-mono text-[10px] text-muted-foreground">
                    name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameDirty(true);
                    }}
                    className="w-full border border-input bg-transparent px-3 py-2 text-base font-medium outline-none transition-colors focus:border-ring"
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label-mono text-[10px] text-muted-foreground">
                    bio
                  </label>
                  <input
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={160}
                    placeholder="a line about you (optional)"
                    className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label-mono text-[10px] text-muted-foreground">
                    carbon id
                  </label>
                  <div className="font-mono text-xs text-muted-foreground">
                    {carbonId}
                  </div>
                </div>
              </div>
            </div>
          )}

          {typingDone && (
            <Button
              onClick={next}
              disabled={
                (step === 2 && !carbonIdReady) || finalizing || (step === 3 && !flowId)
              }
              className="w-full"
            >
              {finalizing
                ? "setting up your account…"
                : (screen.cta ?? "Continue")}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
