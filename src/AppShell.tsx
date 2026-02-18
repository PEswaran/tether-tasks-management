import { useState } from "react";
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./LandingPage";

export default function AppShell() {
  const { authStatus } = useAuthenticator();
  const [showAuth, setShowAuth] = useState(false);

  if (authStatus === "authenticated") {
    return (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
  }

  if (showAuth) {
    return <Authenticator />;
  }

  return <LandingPage onSignIn={() => setShowAuth(true)} />;
}
