package expo.modules.tartancamerainfo

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TartanCameraInfoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TartanCameraInfo")

    Function("frameRates") {
      val manager = appContext.reactContext?.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        ?: return@Function emptyList<Double>()
      val rates = mutableSetOf<Double>()
      for (id in manager.cameraIdList) {
        val characteristics = manager.getCameraCharacteristics(id)
        if (characteristics.get(CameraCharacteristics.LENS_FACING) != CameraCharacteristics.LENS_FACING_BACK) continue
        characteristics.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
          ?.forEach { rates.add(it.upper.toDouble()) }
        characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
          ?.highSpeedVideoFpsRanges
          ?.forEach { rates.add(it.upper.toDouble()) }
      }
      rates.sorted()
    }
  }
}
