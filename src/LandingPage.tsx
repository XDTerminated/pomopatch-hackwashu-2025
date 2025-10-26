import { useSignIn } from "@clerk/clerk-react";
import { useState } from "react";

export default function LandingPage() {
  const { signIn } = useSignIn();
  const [isHovered, setIsHovered] = useState(false);

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
      className="flex flex-col justify-center items-center min-h-screen w-full"
      style={{
        cursor: "auto",
        backgroundImage: "url(/Sprites/UI/summer.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div className="flex flex-col items-center gap-16">
        <img
          src="/Sprites/UI/logo.png"
          alt="Logo"
          className="w-[675px] h-auto image-pixelated"
          style={{ cursor: "auto" }}
        />
        <button
        className="relative border-none bg-transparent p-0 flex items-center justify-center"
        style={{ cursor: "pointer", width: "300px", height: "80px", marginTop: "-20px" }}
        onClick={handleSignIn}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={isHovered ? "/Sprites/UI/submitButton3.png" : "/Sprites/UI/submitButton.png"}
          alt="Sign in with Google"
          className="image-pixelated absolute inset-0 object-contain"
          style={{ width: "100%", height: "100%", cursor: "pointer" }}
        />
        <span
          className="relative flex items-center gap-4 text-white font-bold text-xl pointer-events-none whitespace-nowrap z-10"
          style={{ cursor: "pointer", marginTop: isHovered ? "6px" : "-24px" }}
        >
          <img
            src="/Sprites/UI/google.png"
            alt="Google"
            className="image-pixelated w-6 h-6"
          />
          Sign in with Google
        </span>
      </button>
      </div>
    </div>
  );
}
