import { useState } from "react";
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./LandingPage";
import ContactPage from "./ContactPage";

type View = "landing" | "auth" | "contact";

export default function AppShell() {
  const { authStatus } = useAuthenticator();
  const [view, setView] = useState<View>("landing");

  if (authStatus === "configuring") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (authStatus === "authenticated") {
    return (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
  }

  if (view === "auth") {
    return (
      <Authenticator>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Authenticator>
    );
  }

  if (view === "contact") {
    return <ContactPage onBack={() => setView("landing")} />;
  }

  return (
    <LandingPage
      onSignIn={() => setView("auth")}
      onGetStarted={() => setView("contact")}
    />
  );
}
