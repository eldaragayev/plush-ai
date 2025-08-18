import ExpoModulesCore
import UIKit

public class ImageWarpModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ImageWarp")

    View(ImageWarpView.self) {
      Prop("source") { (view, uri: String?) in
        guard let uri = uri,
              let url = URL(string: uri),
              let img = UIImage(contentsOfFile: url.isFileURL ? url.path : uri) else { return }
        view.setImage(img)
      }
      Prop("center") { (view, c: [Double]) in
        if c.count == 2 { view.centerPx = CGPoint(x: c[0], y: c[1]); view.mtkView.setNeedsDisplay() }
      }
      Prop("radius") { (view, r: Double) in view.radiusPx = r.cgFloat; view.mtkView.setNeedsDisplay() }
      Prop("scale")  { (view, s: Double) in view.scaleVal = s.cgFloat; view.mtkView.setNeedsDisplay() }
      Prop("mode")   { (view, m: String)  in view.mode = m; view.mtkView.setNeedsDisplay() }
    }

    AsyncFunction("saveAsync") { (viewTag: Int) -> String in
      guard let view = appContext?.uiManager?.findView(by: viewTag, type: ImageWarpView.self),
            let url = view.exportJPEG() else {
        throw GenericException("Export failed")
      }
      return url.absoluteString
    }
  }
}

fileprivate extension Double { var cgFloat: CGFloat { CGFloat(self) } }
