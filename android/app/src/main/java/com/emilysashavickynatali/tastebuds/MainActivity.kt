package com.emilysashavickynatali.tastebuds

import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.os.Bundle as AndroidBundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.ReactApplication

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {
        override fun getLaunchOptions(): Bundle? {
          val intent = intent
          val bundle = Bundle()

          if (intent != null && intent.hasExtra("screen")) {
            bundle.putString("screen", intent.getStringExtra("screen"))
            if (intent.hasExtra("params")) {
              bundle.putBundle("params", intent.getBundleExtra("params"))
            }
          }

          return bundle
        }
      }
    )
  }

  override fun onNewIntent(intent: Intent?) {
      super.onNewIntent(intent)
      setIntent(intent)
      // Emit NewIntent to JS so app can navigate when already running
      try {
          val app = application as ReactApplication
          val reactContext = app.reactNativeHost.reactInstanceManager.currentReactContext
          if (reactContext != null && intent != null) {
              val payload = Arguments.createMap()
              if (intent.hasExtra("screen")) {
                  payload.putString("screen", intent.getStringExtra("screen"))
              }
              val params = intent.getBundleExtra("params")
              if (params != null) {
                  payload.putMap("params", bundleToWritableMap(params))
              }
              reactContext
                  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                  .emit("NewIntent", payload)
          }
      } catch (_: Exception) {
          // best-effort; avoid crashing if context not ready
      }
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  // Helper to convert Android Bundle to WritableMap (mirror of IntentModule)
  private fun bundleToWritableMap(bundle: AndroidBundle?): com.facebook.react.bridge.WritableMap {
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
              is AndroidBundle -> map.putMap(key, bundleToWritableMap(value))
              else -> map.putString(key, value.toString())
          }
      }
      return map
  }
}


