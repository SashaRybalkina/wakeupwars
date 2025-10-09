package com.emilysashavickynatali.tastebuds;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String screen = intent.getStringExtra("screen");
        Bundle params = intent.getBundleExtra("params");

        Intent i = new Intent(context, AlarmActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        if (screen != null) {
            i.putExtra("screen", screen);
        }
        if (params != null) {
            i.putExtra("params", params);
        }

        context.startActivity(i);

        context.startService(new Intent(context, AlarmSoundService.class));
    }
}

