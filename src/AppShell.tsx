import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import App from "./App";
import LandingPage from "./features/auth/pages/LandingPage";
import ContactPage from "./features/auth/pages/ContactPage";
import Login from "./features/auth/pages/Login";

function PublicLanding() {
  const navigate = useNavigate();

  return (
    <LandingPage
      onSignIn={() => navigate("/login")}
      onGetStarted={() => navigate("/contact")}
    />
  );
}

function PublicContact() {
  const navigate = useNavigate();
  return <ContactPage onBack={() => navigate("/")} />;
}

type PublicLoginProps = {
  onSignedIn?: () => void;
};

function PublicLogin({ onSignedIn }: PublicLoginProps) {
  return <Login onSignedIn={onSignedIn} />;
}

export default function AppShell() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");

  useEffect(() => {
    let active = true;

    async function refreshAuthState() {
      try {
        const session = await fetchAuthSession();
        const hasTokens = Boolean(session.tokens?.idToken || session.tokens?.accessToken);

        if (active) {
          setAuthState(hasTokens ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (active) {
          setAuthState("unauthenticated");
        }
      }
    }

    refreshAuthState();

    const cancel = Hub.listen("auth", ({ payload }) => {
      const event = payload?.event;
      if (event === "signedIn" || event === "signedOut" || event === "tokenRefresh" || event === "tokenRefresh_failure") {
        refreshAuthState();
      }
    });

    return () => {
      active = false;
      cancel();
    };
  }, []);

  if (authState === "checking") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/contact" element={<PublicContact />} />
        <Route
          path="/login"
          element={
            authState === "authenticated"
              ? <Navigate to="/auth-redirect" replace />
              : <PublicLogin />
          }
        />
        <Route
          path="/*"
          element={
            authState === "authenticated"
              ? <App />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
