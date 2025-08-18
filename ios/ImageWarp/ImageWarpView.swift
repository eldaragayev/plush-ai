import ExpoModulesCore
import MetalKit
import CoreImage
import UIKit

final class ImageWarpView: ExpoView, MTKViewDelegate {
  let mtkView = MTKView()
  private var deviceRef: MTLDevice!
  private var commandQueue: MTLCommandQueue!
  private var ciContext: CIContext!

  private var baseImage: CIImage?
  private var fittedImage: CIImage? // preview-sized for speed
  private var imageAspectFitRect: CGRect = .zero

  // Props
  var centerPx: CGPoint = .zero          // in view coords
  var radiusPx: CGFloat = 100
  var scaleVal: CGFloat = 0.2            // -1..+1 typical
  var mode: String = "pinch"             // "pinch" | "bump"

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    deviceRef = MTLCreateSystemDefaultDevice()
    mtkView.device = deviceRef
    mtkView.framebufferOnly = false
    mtkView.delegate = self
    mtkView.enableSetNeedsDisplay = true
    mtkView.isPaused = true
    addSubview(mtkView)

    commandQueue = deviceRef.makeCommandQueue()
    ciContext = CIContext(mtlDevice: deviceRef)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    mtkView.frame = bounds
    mtkView.setNeedsDisplay()
  }

  func setImage(_ uiImage: UIImage) {
    guard let ci = CIImage(image: uiImage) else { return }
    baseImage = ci
    fittedImage = makePreviewCIImage(from: ci, target: bounds.size)
    imageAspectFitRect = aspectFitRect(imageSize: ci.extent.size, container: bounds.size)
    mtkView.setNeedsDisplay()
  }

  private func makePreviewCIImage(from ci: CIImage, target: CGSize) -> CIImage {
    guard target.width > 0, target.height > 0 else { return ci }
    let fit = aspectFitRect(imageSize: ci.extent.size, container: target)
    let scaleX = fit.size.width / ci.extent.size.width
    let scaleY = fit.size.height / ci.extent.size.height
    return ci.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
              .transformed(by: CGAffineTransform(translationX: fit.origin.x, y: fit.origin.y))
  }

  private func aspectFitRect(imageSize: CGSize, container: CGSize) -> CGRect {
    let rw = container.width / imageSize.width
    let rh = container.height / imageSize.height
    let scale = min(rw, rh)
    let w = imageSize.width * scale
    let h = imageSize.height * scale
    let x = (container.width - w) / 2
    let y = (container.height - h) / 2
    return CGRect(x: x, y: y, width: w, height: h)
  }

  func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

  func mtkView(_ view: MTKView, drawable: CAMetalDrawable) {
    guard let commandBuffer = commandQueue.makeCommandBuffer(),
          let base = baseImage else { return }

    // Use preview image (already aspect-fitted) for interactive render
    let preview = fittedImage ?? makePreviewCIImage(from: base, target: bounds.size)

    // Map center/radius from view coords into CI coords (origin bottom-left)
    let ciCenter = CGPoint(
      x: centerPx.x,
      y: bounds.height - centerPx.y
    )

    let filter: CIFilter
    if mode == "bump" {
      let f = CIFilter(name: "CIBumpDistortion")!
      f.setValue(preview, forKey: kCIInputImageKey)
      f.setValue(CIVector(x: ciCenter.x, y: ciCenter.y), forKey: kCIInputCenterKey)
      f.setValue(radiusPx, forKey: kCIInputRadiusKey)
      f.setValue(scaleVal, forKey: kCIInputScaleKey)
      filter = f
    } else {
      let f = CIFilter(name: "CIPinchDistortion")!
      f.setValue(preview, forKey: kCIInputImageKey)
      f.setValue(CIVector(x: ciCenter.x, y: ciCenter.y), forKey: kCIInputCenterKey)
      f.setValue(radiusPx, forKey: kCIInputRadiusKey)
      f.setValue(scaleVal, forKey: kCIInputScaleKey)
      filter = f
    }

    guard let output = filter.outputImage else { return }

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    ciContext.render(
      output,
      to: drawable.texture,
      commandBuffer: commandBuffer,
      bounds: CGRect(origin: .zero, size: bounds.size),
      colorSpace: colorSpace
    )
    commandBuffer.present(drawable)
    commandBuffer.commit()
  }

  // Export full-res (recompute at base image resolution)
  func exportJPEG(quality: CGFloat = 0.9) -> URL? {
    guard let base = baseImage else { return nil }
    // Convert center/radius from view space to base image space
    let fit = imageAspectFitRect
    let sx = base.extent.width / fit.width
    let sy = base.extent.height / fit.height
    let cxInFit = centerPx.x - fit.origin.x
    let cyInFit = (bounds.height - centerPx.y) - fit.origin.y
    let ciCenter = CGPoint(x: cxInFit * sx, y: cyInFit * sy)
    let radiusInImage = radiusPx * max(sx, sy)

    let filter: CIFilter
    if mode == "bump" {
      let f = CIFilter(name: "CIBumpDistortion")!
      f.setValue(base, forKey: kCIInputImageKey)
      f.setValue(CIVector(x: ciCenter.x, y: ciCenter.y), forKey: kCIInputCenterKey)
      f.setValue(radiusInImage, forKey: kCIInputRadiusKey)
      f.setValue(scaleVal, forKey: kCIInputScaleKey)
      filter = f
    } else {
      let f = CIFilter(name: "CIPinchDistortion")!
      f.setValue(base, forKey: kCIInputImageKey)
      f.setValue(CIVector(x: ciCenter.x, y: ciCenter.y), forKey: kCIInputCenterKey)
      f.setValue(radiusInImage, forKey: kCIInputRadiusKey)
      f.setValue(scaleVal, forKey: kCIInputScaleKey)
      filter = f
    }

    guard let out = filter.outputImage else { return nil }
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let cg = ciContext.createCGImage(out, from: out.extent, format: .RGBA8, colorSpace: colorSpace) else { return nil }
    let ui = UIImage(cgImage: cg)
    guard let data = ui.jpegData(compressionQuality: quality) else { return nil }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("warp-\(UUID().uuidString).jpg")
    do {
      try data.write(to: url)
      return url
    } catch {
      return nil
    }
  }
}
