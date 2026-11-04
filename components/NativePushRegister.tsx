"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export function NativePushRegister() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function setup() {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
          perm = await PushNotifications.requestPermissions();
        }
        
        if (perm.receive === 'granted') {
          await PushNotifications.register();
          
          PushNotifications.addListener('registration', async (token) => {
            console.log('Push registration success, token: ' + token.value);
            // Send token to your server
            await fetch('/api/push/native-subscribe', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() })
            }).catch(console.error);
          });

          PushNotifications.addListener('registrationError', (error) => {
            console.error('Error on registration: ' + JSON.stringify(error));
          });
          
        }
      } catch (e) {
        console.error("Push setup failed", e);
      }
    }
    
    setup();
  }, []);

  return null;
}
