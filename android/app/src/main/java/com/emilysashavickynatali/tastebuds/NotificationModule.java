package com.emilysashavickynatali.tastebuds;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import java.util.Map;

public class NotificationModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private static final String CHANNEL_ID = "wakeupwars_channel";

    public NotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "WakeUpWars Notifications";
            String description = "Notifications from WakeUpWars app";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);

            NotificationManager notificationManager = reactContext.getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    @NonNull
    @Override
    public String getName() {
        return "NotificationModule";
    }

    @ReactMethod
    public void showNotification(String title, String message, String screen, ReadableMap params, Promise promise) {
        try {
            Intent intent = new Intent(reactContext, NotificationReceiver.class);
            intent.putExtra("screen", screen);
            
            Bundle bundle = new Bundle();
            if (params != null) {
                for (Map.Entry<String, Object> entry : params.toHashMap().entrySet()) {
                    Object value = entry.getValue();
                    String key = entry.getKey();
                    if (value instanceof String) {
                        bundle.putString(key, (String) value);
                    } else if (value instanceof Integer) {
                        bundle.putInt(key, (Integer) value);
                    } else if (value instanceof Double) {
                        bundle.putDouble(key, (Double) value);
                    } else if (value instanceof Boolean) {
                        bundle.putBoolean(key, (Boolean) value);
                    }
                }
            }
            intent.putExtra("params", bundle);
            
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    (int) System.currentTimeMillis(), // unique ID
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT |
                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0)
            );
            
            NotificationCompat.Builder builder = new NotificationCompat.Builder(reactContext, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);
            
            NotificationManagerCompat.from(reactContext).notify((int) System.currentTimeMillis(), builder.build());            

            promise.resolve("Notification shown");
        } catch (Exception e) {
            promise.reject("NOTIFICATION_ERROR", e);
        }
    }
}
