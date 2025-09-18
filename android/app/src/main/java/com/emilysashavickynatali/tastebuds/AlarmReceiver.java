package com.emilysashavickynatali.tastebuds;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // This runs when the alarm goes off
        Toast.makeText(context, "Alarm Triggered!", Toast.LENGTH_LONG).show();
    }
}