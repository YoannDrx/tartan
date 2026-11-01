import AVFoundation
import ExpoModulesCore

public class TartanCameraInfoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TartanCameraInfo")

    Function("frameRates") { () -> [Double] in
      guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
        return []
      }
      let rates = device.formats.flatMap { format in
        format.videoSupportedFrameRateRanges.map { $0.maxFrameRate.rounded() }
      }
      return Array(Set(rates)).sorted()
    }
  }
}
