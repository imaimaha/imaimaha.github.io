// usage: swift enc.swift <frames_dir> <out.mp4> <fps> <first> <last> <bitrate> <poster.jpg> <posterFrame> [width]
// PNG の連番から H.264 の MP4（音なし）と、ポスター画像（JPEG）を作る
import AVFoundation
import AppKit

let a = CommandLine.arguments
let dir = a[1], out = a[2], fps = Int32(a[3])!, first = Int(a[4])!, last = Int(a[5])!, bitrate = Int(a[6])!
let posterPath = a[7], posterFrame = Int(a[8])!
let files = (first...last).map { String(format: "%@/%04d.png", dir, $0) }
guard let img0 = NSImage(contentsOfFile: files[0]), let rep0 = img0.representations.first else { fatalError("no frame") }
var W = rep0.pixelsWide, H = rep0.pixelsHigh
if a.count > 9, let tw = Int(a[9]) { H = Int((Double(H) * Double(tw) / Double(W)).rounded()); W = tw }
W -= W % 2; H -= H % 2
try? FileManager.default.removeItem(atPath: out)
let writer = try! AVAssetWriter(outputURL: URL(fileURLWithPath: out), fileType: .mp4)
let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: bitrate, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                                    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2, AVVideoAllowFrameReorderingKey: true]]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
writer.add(input)
writer.shouldOptimizeForNetworkUse = true
writer.startWriting(); writer.startSession(atSourceTime: .zero)
let cs = CGColorSpaceCreateDeviceRGB()
for (i, f) in files.enumerated() {
  guard let im = NSImage(contentsOfFile: f), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  while !input.isReadyForMoreMediaData { usleep(2000) }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb!),
                      space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
  CVPixelBufferUnlockBaseAddress(pb!, [])
  adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
  if first + i == posterFrame {
    let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
    try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.72])!.write(to: URL(fileURLWithPath: posterPath))
  }
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status != .completed { print("failed", writer.error as Any); exit(1) }
print("ok", W, H, files.count)
