package com.emilysashavickynatali.tastebuds;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import java.util.Map;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

public class AlarmModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public AlarmModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        // This is how JS will reference this module
        return "AlarmModule";
    }

    @ReactMethod
    public void setAlarm(double timestamp, String screen, ReadableMap params, Promise promise) {
        try {
            AlarmManager alarmManager = (AlarmManager) reactContext.getSystemService(Context.ALARM_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + reactContext.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    reactContext.startActivity(intent);

                    promise.reject("PERMISSION_DENIED", "Exact alarm permission required");
                    return;
                }
            }

            // Pass data to the receiver
            Intent intent = new Intent(reactContext, AlarmReceiver.class);
            intent.putExtra("screen", screen);
            android.os.Bundle bundle = new android.os.Bundle();
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
                // Add more types as needed
            }
            intent.putExtra("params", bundle);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT |
                            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0)
            );

            long triggerAtMillis = (long) timestamp;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }

            promise.resolve("Alarm set successfully");
        } catch (Exception e) {
            promise.reject("ALARM_ERROR", e);
        }
    }
}