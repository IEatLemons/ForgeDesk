import AppKit
import ApplicationServices
import Foundation

typealias JSON = [String: Any]

struct HelperSettings {
  var enabled = false
  var showOnHover = false
  var autoRehideMs = 5000
  var hiddenItemKeys = Set<String>()
  var alwaysHiddenItemKeys = Set<String>()
  var orderedItemKeys = [String]()

  static func from(_ value: Any?) -> HelperSettings {
    guard let data = value as? JSON else {
      return HelperSettings()
    }

    var settings = HelperSettings()
    settings.enabled = data["enabled"] as? Bool ?? false
    settings.showOnHover = data["showOnHover"] as? Bool ?? false
    settings.autoRehideMs = max(1000, min(60000, data["autoRehideMs"] as? Int ?? 5000))
    settings.hiddenItemKeys = Set((data["hiddenItemKeys"] as? [String] ?? []).filter { !$0.isEmpty })
    settings.alwaysHiddenItemKeys = Set((data["alwaysHiddenItemKeys"] as? [String] ?? []).filter { !$0.isEmpty })
    settings.orderedItemKeys = (data["orderedItemKeys"] as? [String] ?? []).filter { !$0.isEmpty }
    return settings
  }
}

struct MenuBarSnapshotItem {
  let key: String
  let displayName: String
  let bundleIdentifier: String
  let ownerName: String
  let title: String
  let section: String
  let canMove: Bool
  let frame: CGRect

  var dictionary: JSON {
    [
      "key": key,
      "displayName": displayName,
      "bundleIdentifier": bundleIdentifier,
      "ownerName": ownerName,
      "title": title,
      "section": section,
      "canMove": canMove,
      "frame": [
        "x": frame.origin.x,
        "y": frame.origin.y,
        "width": frame.size.width,
        "height": frame.size.height
      ]
    ]
  }
}

final class HelperAppDelegate: NSObject, NSApplicationDelegate {
  private var mainItem: NSStatusItem?
  private var hiddenItem: NSStatusItem?
  private var alwaysHiddenItem: NSStatusItem?
  private var settings = HelperSettings()
  private var sectionVisible = false
  private var rehideTimer: Timer?
  private var mouseMonitor: Any?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
    createStatusItems()
    startInputLoop()
    sendEvent("ready", params: statusPayload())
  }

  func applicationWillTerminate(_ notification: Notification) {
    if let mouseMonitor {
      NSEvent.removeMonitor(mouseMonitor)
    }
  }

  private func createStatusItems() {
    mainItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    hiddenItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    alwaysHiddenItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

    configure(item: mainItem, title: "FD", tooltip: "ForgeDesk Menu Bar", action: #selector(toggleHiddenSection))
    configure(item: hiddenItem, title: "H", tooltip: "ForgeDesk Hidden Menu Bar Items", action: #selector(toggleHiddenSection))
    configure(item: alwaysHiddenItem, title: "A", tooltip: "ForgeDesk Always Hidden Menu Bar Items", action: #selector(hideHiddenSection))
  }

  private func configure(item: NSStatusItem?, title: String, tooltip: String, action: Selector) {
    guard let button = item?.button else {
      return
    }

    button.title = title
    button.toolTip = tooltip
    button.target = self
    button.action = action
  }

  private func startInputLoop() {
    DispatchQueue.global(qos: .utility).async { [weak self] in
      while let line = readLine() {
        DispatchQueue.main.async {
          self?.handle(line: line)
        }
      }

      DispatchQueue.main.async {
        NSApp.terminate(nil)
      }
    }
  }

  private func handle(line: String) {
    guard let data = line.data(using: .utf8) else {
      return
    }

    do {
      guard let envelope = try JSONSerialization.jsonObject(with: data) as? JSON else {
        sendError(id: nil, message: "Invalid JSON-RPC message")
        return
      }

      let id = envelope["id"] as? String
      guard let method = envelope["method"] as? String else {
        sendError(id: id, message: "Missing method")
        return
      }

      switch method {
      case "status.get":
        sendResult(id: id, result: statusPayload())
      case "permission.requestAccessibility":
        requestAccessibility()
        sendResult(id: id, result: statusPayload())
      case "items.refresh":
        sendResult(id: id, result: statusPayload())
      case "settings.apply":
        settings = HelperSettings.from(envelope["params"])
        configureMouseMonitor()
        performBestEffortLayout()
        sendResult(id: id, result: statusPayload())
      case "section.show":
        showHiddenSection()
        sendResult(id: id, result: statusPayload())
      case "section.hide":
        hideHiddenSection()
        sendResult(id: id, result: statusPayload())
      case "section.toggle":
        toggleHiddenSection()
        sendResult(id: id, result: statusPayload())
      case "helper.shutdown":
        sendResult(id: id, result: ["ok": true])
        NSApp.terminate(nil)
      default:
        sendError(id: id, message: "Unknown method: \(method)")
      }
    } catch {
      sendError(id: nil, message: error.localizedDescription)
    }
  }

  private func requestAccessibility() {
    let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    _ = AXIsProcessTrustedWithOptions([promptKey: true] as CFDictionary)

    if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
      NSWorkspace.shared.open(url)
    }
  }

  private func configureMouseMonitor() {
    if let mouseMonitor {
      NSEvent.removeMonitor(mouseMonitor)
      self.mouseMonitor = nil
    }

    guard settings.enabled && settings.showOnHover else {
      return
    }

    mouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved]) { [weak self] event in
      guard let self else {
        return
      }

      DispatchQueue.main.async {
        let topEdge = NSScreen.screens.map { $0.frame.maxY }.max() ?? 0
        if abs(event.locationInWindow.y - topEdge) < 8 || event.locationInWindow.y >= topEdge - 2 {
          self.showHiddenSection()
        }
      }
    }
  }

  private func statusPayload() -> JSON {
    [
      "accessibilityTrusted": AXIsProcessTrusted(),
      "sectionVisible": sectionVisible,
      "items": snapshotItems().map { $0.dictionary }
    ]
  }

  private func snapshotItems() -> [MenuBarSnapshotItem] {
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let rawList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [JSON] else {
      return []
    }

    let processID = getpid()
    let items = rawList.compactMap { windowInfo -> MenuBarSnapshotItem? in
      guard
        let ownerPID = windowInfo[kCGWindowOwnerPID as String] as? pid_t,
        ownerPID != processID,
        let bounds = windowInfo[kCGWindowBounds as String] as? JSON,
        let frame = CGRect(dictionaryRepresentation: bounds as CFDictionary)
      else {
        return nil
      }

      guard isLikelyMenuBarItem(frame: frame) else {
        return nil
      }

      let title = windowInfo[kCGWindowName as String] as? String ?? ""
      let ownerName = windowInfo[kCGWindowOwnerName as String] as? String ?? ""
      let app = NSRunningApplication(processIdentifier: ownerPID)
      let bundleIdentifier = app?.bundleIdentifier ?? ""
      let key = stableKey(bundleIdentifier: bundleIdentifier, title: title, ownerName: ownerName)
      let section = sectionName(for: key)
      let displayName = bestDisplayName(bundleIdentifier: bundleIdentifier, title: title, ownerName: ownerName, appName: app?.localizedName)
      let canMove = !bundleIdentifier.hasPrefix("com.apple.controlcenter") && !displayName.isEmpty

      return MenuBarSnapshotItem(
        key: key,
        displayName: displayName,
        bundleIdentifier: bundleIdentifier,
        ownerName: ownerName,
        title: title,
        section: section,
        canMove: canMove,
        frame: frame
      )
    }

    let order = Dictionary(uniqueKeysWithValues: settings.orderedItemKeys.enumerated().map { ($0.element, $0.offset) })

    return items.sorted { left, right in
      let leftOrder = order[left.key] ?? Int.max
      let rightOrder = order[right.key] ?? Int.max

      if leftOrder != rightOrder {
        return leftOrder < rightOrder
      }

      if left.frame.minX != right.frame.minX {
        return left.frame.minX < right.frame.minX
      }

      return left.displayName.localizedStandardCompare(right.displayName) == .orderedAscending
    }
  }

  private func isLikelyMenuBarItem(frame: CGRect) -> Bool {
    guard frame.width >= 6, frame.width <= 420, frame.height >= 8, frame.height <= 42 else {
      return false
    }

    if frame.minY <= 60 {
      return true
    }

    return NSScreen.screens.contains { screen in
      abs(frame.minY - screen.frame.minY) <= 4 || abs(frame.maxY - screen.frame.maxY) <= 4
    }
  }

  private func sectionName(for key: String) -> String {
    if settings.alwaysHiddenItemKeys.contains(key) {
      return "always-hidden"
    }

    if settings.hiddenItemKeys.contains(key) {
      return "hidden"
    }

    return "visible"
  }

  private func bestDisplayName(bundleIdentifier: String, title: String, ownerName: String, appName: String?) -> String {
    if let appName, !appName.isEmpty {
      return appName
    }

    if !ownerName.isEmpty {
      return ownerName
    }

    if !title.isEmpty {
      return title
    }

    if !bundleIdentifier.isEmpty {
      return bundleIdentifier
    }

    return "Unknown"
  }

  private func stableKey(bundleIdentifier: String, title: String, ownerName: String) -> String {
    let value = "\(bundleIdentifier)|\(title)|\(ownerName)"
    var hash: UInt64 = 1469598103934665603

    for byte in value.utf8 {
      hash ^= UInt64(byte)
      hash &*= 1099511628211
    }

    return String(format: "%016llx", hash)
  }

  @objc private func toggleHiddenSection() {
    sectionVisible ? hideHiddenSection() : showHiddenSection()
  }

  @objc private func showHiddenSection() {
    sectionVisible = true
    rehideTimer?.invalidate()
    sendEvent("sectionChanged", params: statusPayload())

    if settings.autoRehideMs > 0 {
      rehideTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(settings.autoRehideMs) / 1000.0, repeats: false) { [weak self] _ in
        self?.hideHiddenSection()
      }
    }
  }

  @objc private func hideHiddenSection() {
    sectionVisible = false
    rehideTimer?.invalidate()
    rehideTimer = nil
    performBestEffortLayout()
    sendEvent("sectionChanged", params: statusPayload())
  }

  private func performBestEffortLayout() {
    guard settings.enabled, AXIsProcessTrusted() else {
      return
    }

    let items = snapshotItems().filter { $0.canMove }
    let shouldTuck: (MenuBarSnapshotItem) -> Bool = { item in
      item.section == "always-hidden" || (item.section == "hidden" && !self.sectionVisible)
    }

    for item in items where shouldTuck(item) {
      let target = CGPoint(x: 8, y: item.frame.midY)
      drag(item: item, to: target)
    }
  }

  private func drag(item: MenuBarSnapshotItem, to target: CGPoint) {
    let start = CGPoint(x: item.frame.midX, y: item.frame.midY)
    guard start != target, let source = CGEventSource(stateID: .hidSystemState) else {
      return
    }

    let events: [(CGEventType, CGPoint, useconds_t)] = [
      (.mouseMoved, start, 10000),
      (.leftMouseDown, start, 50000),
      (.leftMouseDragged, target, 50000),
      (.leftMouseUp, target, 10000)
    ]

    for (type, point, delay) in events {
      guard let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left) else {
        continue
      }

      event.flags = [.maskCommand]
      event.post(tap: .cghidEventTap)
      usleep(delay)
    }
  }

  private func sendResult(id: String?, result: Any) {
    guard let id else {
      return
    }

    writeJSON(["id": id, "result": result])
  }

  private func sendError(id: String?, message: String) {
    var payload: JSON = ["error": ["message": message]]

    if let id {
      payload["id"] = id
    } else {
      payload["method"] = "error"
      payload["params"] = ["message": message]
    }

    writeJSON(payload)
  }

  private func sendEvent(_ method: String, params: Any) {
    writeJSON(["method": method, "params": params])
  }

  private func writeJSON(_ payload: Any) {
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload),
          let line = String(data: data, encoding: .utf8)
    else {
      return
    }

    FileHandle.standardOutput.write((line + "\n").data(using: .utf8)!)
  }
}

let app = NSApplication.shared
let delegate = HelperAppDelegate()
app.delegate = delegate
app.run()
