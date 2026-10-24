"use client";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setIsNative(true);
      authenticate();
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  async function authenticate() {
    // If the plugin is missing or biometrics cannot be queried, never lock the user out.
    let available = false;
    try {
      const result = await NativeBiometric.isAvailable();
      available = !!result.isAvailable;
    } catch (err) {
      console.error("Biometric check unavailable", err);
    }
    if (!available) {
      setIsAuthenticated(true);
      return;
    }
    try {
      await NativeBiometric.verifyIdentity({
        reason: "Unlock Wetin Dey",
        title: "Authentication Required",
        subtitle: "Please verify your identity to continue",
      });
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Biometric auth failed", err);
    }
  }

  if (!isAuthenticated && isNative) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Wetin Dey</h1>
        <p className="mb-8 text-gray-400">Authentication required to view your feed.</p>
        <button onClick={authenticate} className="rounded-full bg-green-600 px-8 py-3 font-semibold text-white">
          Unlock with FaceID / Fingerprint
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
