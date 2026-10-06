import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { syncProfileTimezone } from "./timezone";
import { hasEverAuthenticated, markEverAuthenticated } from "./auth-history";
import { checkNeedsLegalReconsent, recordLegalAcceptance } from "./legal-consent";

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  /** Has THIS DEVICE ever completed a real sign-in or sign-up, regardless
   * of whether `session` is currently set — see lib/auth-history.ts. Lets
   * sign-in.tsx default to Create account for a brand-new install and Sign
   * in for a returning, now-signed-out one. Resolved as part of the same
   * startup bootstrap as `session`, so it's never a flash of the wrong
   * default — see the Stack.Protected `isLoading` gate in app/_layout.tsx. */
  hasSignedInBefore: boolean;
  /** True when this account hasn't actively agreed to the CURRENT Terms /
   * Privacy Policy — see lib/legal-consent.ts and migration
   * 0019_legal_reconsent.sql. app/_layout.tsx blocks the app behind
   * app/legal-update.tsx while this is true. Resolved as part of the
   * startup bootstrap (like hasSignedInBefore) so the real app is never
   * shown even briefly before this is known. */
  needsLegalReconsent: boolean;
  /** Records active agreement to the current policy and clears the gate. */
  acceptLegalUpdate: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within <AuthProvider>");
  return value;
}

/**
 * Bootstraps from whatever session SecureStore already has, then stays
 * current via onAuthStateChange — which fires for every kind of session
 * change (sign-in, sign-out, token refresh), including the setSession() call
 * that app/auth/confirm.tsx makes after parsing an incoming magic-link deep
 * link. One listener here is what makes that screen's job "just call
 * setSession and go back" rather than needing to also push state up itself.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSignedInBefore, setHasSignedInBefore] = useState(false);
  const [needsLegalReconsent, setNeedsLegalReconsent] = useState(false);

  useEffect(() => {
    (async () => {
      // The session and "ever authenticated" reads don't depend on each
      // other, so they run together; the reconsent check needs the
      // session's user id first, so it runs after. All three resolve
      // before isLoading flips false, so the app is never shown — even for
      // a frame — before we know whether it should be gated.
      const [{ data }, everAuthenticated] = await Promise.all([
        supabase.auth.getSession(),
        hasEverAuthenticated(),
      ]);
      setSession(data.session);
      setHasSignedInBefore(everAuthenticated);

      if (data.session) {
        void syncProfileTimezone(data.session.user.id);
        void markEverAuthenticated();
        setNeedsLegalReconsent(await checkNeedsLegalReconsent(data.session.user.id));
      }
      setIsLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      // INITIAL_SESSION fires once automatically as part of the client's
      // own startup, for the SAME session the bootstrap above already
      // awaits in full. Re-running these checks here too — unawaited, with
      // no ordering guarantee against the bootstrap's own awaited call —
      // was a real race: whichever of the two identical checks finished
      // last silently overwrote the other's result in needsLegalReconsent.
      // Found 2026-10-06: the reconsent screen silently failed to appear
      // on a real device, exactly what that race predicts if the
      // unawaited call lost the race and fell back to its fail-open
      // default. Only react here to events that happen AFTER the
      // bootstrap has already finished — a fresh sign-in/sign-up, a token
      // refresh, etc.
      if (event === "INITIAL_SESSION") return;

      if (newSession) {
        // Fire-and-forget on purpose — see syncProfileTimezone: it must
        // never delay or block auth state. A brief flash of the main app
        // before this resolves is an accepted tradeoff for a REAL
        // subsequent event (unlike the initial bootstrap, which does
        // wait) — this is a compliance nicety, not a security boundary.
        void syncProfileTimezone(newSession.user.id);
        void markEverAuthenticated();
        setHasSignedInBefore(true);
        void checkNeedsLegalReconsent(newSession.user.id).then(setNeedsLegalReconsent);
      } else {
        setNeedsLegalReconsent(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        hasSignedInBefore,
        needsLegalReconsent,
        acceptLegalUpdate: async () => {
          if (!session) return;
          await recordLegalAcceptance(session.user.id);
          setNeedsLegalReconsent(false);
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
