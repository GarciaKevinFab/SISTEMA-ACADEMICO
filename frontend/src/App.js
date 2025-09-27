// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./router/AppRouter";
import { ensureFreshToken } from "./lib/api";

function App() {
  // Precalienta el access token si solo tienes refresh
  useEffect(() => {
    ensureFreshToken();
  }, []);

  // Soporte para test: reduce motion
  useEffect(() => {
    if (
      process.env.REACT_APP_TEST_MODE === "true" ||
      window.location.search.includes("test=true")
    ) {
      document.body.classList.add("reduce-motion");
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
