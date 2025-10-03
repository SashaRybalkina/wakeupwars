package com.emilysashavickynatali.tastebuds;

import android.app.Activity;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.content.Intent;

public class AlarmActivity extends Activity {

    private MediaPlayer mediaPlayer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        setContentView(R.layout.activity_alarm);

        // Play alarm sound (looping)
        mediaPlayer = MediaPlayer.create(this, android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI);
        mediaPlayer.setLooping(true);
        mediaPlayer.start();

        // Dismiss button
        Button dismissButton = findViewById(R.id.dismissButton);
        dismissButton.setOnClickListener(v -> {
            mediaPlayer.stop();
            stopService(new Intent(this, AlarmSoundService.class));
        
            Intent i = new Intent(AlarmActivity.this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
            // Forward screen + params to RN
            String screen = getIntent().getStringExtra("screen");
            Bundle params = getIntent().getBundleExtra("params");
        
            if (screen != null) {
                i.putExtra("screen", screen);
            }
            if (params != null) {
                i.putExtra("params", params);
            }
        
            startActivity(i);
            finish();
        });        
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mediaPlayer != null) {
            mediaPlayer.release();
        }
    }
}

