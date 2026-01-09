import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import LandingPage from "../features/auth/LandingPage";
import GameWrapper from "./GameWrapper";
import SSOCallback from "../features/auth/SSOCallback";

const PUBLISHABLE_KEY = import.meta.env.VITE_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    throw new Error("Missing Publishable Key");
}

export default function AppWrapper() {
    // Check if we're on the SSO callback route
    const isSSOCallback = window.location.pathname === "/sso-callback";

    return (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
            {isSSOCallback ? (
                <SSOCallback />
            ) : (
                <>
                    <SignedOut>
                        <LandingPage />
                    </SignedOut>
                    <SignedIn>
                        <GameWrapper />
                    </SignedIn>
                </>
            )}
        </ClerkProvider>
    );
}
