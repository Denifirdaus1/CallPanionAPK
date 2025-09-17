package uk.co.callpanion.elderly

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity: FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        ElevenLabsBridge(this, flutterEngine.dartExecutor.binaryMessenger)
    }
}