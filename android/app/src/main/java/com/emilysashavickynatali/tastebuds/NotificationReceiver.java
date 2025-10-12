package com.emilysashavickynatali.tastebuds;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class NotificationReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d("NotificationReceiver", "Notification tapped");

        String screen = intent.getStringExtra("screen");
        Bundle params = intent.getBundleExtra("params");

        WritableMap map = Arguments.createMap();
        if (screen != null) map.putString("screen", screen);
        if (params != null) map.putMap("params", Arguments.fromBundle(params));

        ReactInstanceManager reactInstanceManager = ((ReactApplication) context.getApplicationContext())
                .getReactNativeHost()
                .getReactInstanceManager();

        ReactContext reactContext = reactInstanceManager.getCurrentReactContext();

        if (reactContext != null) {
            Log.d("NotificationReceiver", "React context ready, emitting NewIntent");
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("NewIntent", map);
        } else {
            Log.d("NotificationReceiver", "React context null, waiting for initialization...");
            reactInstanceManager.addReactInstanceEventListener(new ReactInstanceManager.ReactInstanceEventListener() {
                @Override
                public void onReactContextInitialized(ReactContext context) {
                    Log.d("NotificationReceiver", "React context initialized, emitting NewIntent");
                    context
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("NewIntent", map);
                    reactInstanceManager.removeReactInstanceEventListener(this);
                }
            });

            if (!reactInstanceManager.hasStartedCreatingInitialContext()) {
                reactInstanceManager.createReactContextInBackground();
            }
        }
    }
}