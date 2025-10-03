package com.emilysashavickynatali.tastebuds

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.Intent
import android.os.Bundle
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class IntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "IntentModule" // <-- must match JS name
    }

    // Required for NativeEventEmitter on Android to avoid warnings
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: JS subscribes via RCTDeviceEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op
    }

    private fun bundleToWritableMap(bundle: Bundle?): WritableMap {
        val map = Arguments.createMap()
        if (bundle == null) return map
        for (key in bundle.keySet()) {
            val value = bundle.get(key)
            when (value) {
                null -> map.putNull(key)
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Double -> map.putDouble(key, value)
                is Float -> map.putDouble(key, value.toDouble())
                is Boolean -> map.putBoolean(key, value)
                is Long -> map.putDouble(key, value.toDouble())
                is Bundle -> map.putMap(key, bundleToWritableMap(value))
                else -> map.putString(key, value.toString())
            }
        }
        return map
    }

    @ReactMethod
    fun getInitialIntent(promise: Promise) {
        val activity = currentActivity
        if (activity != null) {
            val intent: Intent? = activity.intent
            val extras = intent?.extras
            if (extras == null) {
                promise.resolve(null)
                return
            }

            val result = Arguments.createMap()
            if (extras.containsKey("screen")) {
                result.putString("screen", extras.getString("screen"))
            }
            val paramsBundle = extras.getBundle("params")
            if (paramsBundle != null) {
                result.putMap("params", bundleToWritableMap(paramsBundle))
            }
            // Optionally include other scalars
            for (key in extras.keySet()) {
                if (key == "screen" || key == "params") continue
                val v = extras.get(key)
                when (v) {
                    null -> result.putNull(key)
                    is String -> result.putString(key, v)
                    is Int -> result.putInt(key, v)
                    is Double -> result.putDouble(key, v)
                    is Float -> result.putDouble(key, v.toDouble())
                    is Boolean -> result.putBoolean(key, v)
                    is Long -> result.putDouble(key, v.toDouble())
                    is Bundle -> result.putMap(key, bundleToWritableMap(v))
                    else -> result.putString(key, v.toString())
                }
            }
            promise.resolve(result)
        } else {
            promise.resolve(null)
        }
    }
}

