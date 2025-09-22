package com.emilysashavickynatali.tastebuds

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.Intent

class IntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "IntentModule" // <-- must match JS name
    }

    @ReactMethod
    fun getInitialIntent(promise: Promise) {
        val activity = currentActivity
        if (activity != null) {
            val intent: Intent? = activity.intent
            val extras = intent?.extras
            val result = com.facebook.react.bridge.WritableNativeMap()
            if (extras != null) {
                for (key in extras.keySet()) {
                    result.putString(key, extras.get(key).toString())
                }
            }
            promise.resolve(result)
        } else {
            promise.resolve(null)
        }
    }
}