import { useSignIn } from "@clerk/clerk-react";

export default function LandingPage() {
    const { signIn } = useSignIn();

    const handleSignIn = async () => {
        if (!signIn) return;

        try {
            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: window.location.origin + "/sso-callback",
                redirectUrlComplete: "/",
            });
        } catch (error) {
            console.error("OAuth error:", error);
        }
    };

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                backgroundColor: "#f5f5f5",
                cursor: "default",
            }}
        >
            <button
                style={{
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    backgroundColor: "#4285f4",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                }}
                onClick={handleSignIn}
            >
                <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                    <path fill="#fff" d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" />
                    <path fill="#fff" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                    <path fill="#fff" d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" />
                </svg>
                Sign in with Google
            </button>
        </div>
    );
}
