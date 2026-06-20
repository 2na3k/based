import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const ROOT = process.cwd();
const DIST_DIR = join(ROOT, "dist", "macos");
const APP_DIR = join(DIST_DIR, "based..app");
const CONTENTS_DIR = join(APP_DIR, "Contents");
const MACOS_DIR = join(CONTENTS_DIR, "MacOS");
const RESOURCES_DIR = join(CONTENTS_DIR, "Resources");
const BUNDLED_APP_DIR = join(RESOURCES_DIR, "app");
const ICONSET_DIR = join(DIST_DIR, "based.iconset");
const APP_ICON_PATH = join(RESOURCES_DIR, "AppIcon.icns");
const LAUNCHER_SOURCE = join(DIST_DIR, "basedLauncher.swift");
const LAUNCHER_BINARY = join(MACOS_DIR, "based.");
const INSTALL_TARGET = "/Applications/based..app";

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown status"}`));
    });
  });
}

async function writeInfoPlist() {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>based.</string>
  <key>CFBundleDisplayName</key>
  <string>based.</string>
  <key>CFBundleIdentifier</key>
  <string>app.based.local</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>based.</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;
  await writeFile(join(CONTENTS_DIR, "Info.plist"), plist);
}

async function writeLauncher() {
  const source = `import AppKit
import Foundation
import WebKit

let port = "37839"
let host = "127.0.0.1"
let resources = Bundle.main.resourceURL!
let appDir = resources.appendingPathComponent("app")
let server = appDir.appendingPathComponent("server.js")
let candidates = [
  ProcessInfo.processInfo.environment["BUN_PATH"],
  "/opt/homebrew/bin/bun",
  "/usr/local/bin/bun"
].compactMap { $0 }

guard let bun = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
  fputs("Bun was not found. Install Bun or set BUN_PATH.\\n", stderr)
  exit(1)
}

let process = Process()
process.executableURL = URL(fileURLWithPath: bun)
process.arguments = [server.path]
process.currentDirectoryURL = appDir
var environment = ProcessInfo.processInfo.environment
environment["NODE_ENV"] = "production"
environment["HOSTNAME"] = host
environment["PORT"] = port
process.environment = environment

do {
  try process.run()
} catch {
  fputs("Could not start based.: \\(error)\\n", stderr)
  exit(1)
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let configuration = WKWebViewConfiguration()
    let preferences = WKWebpagePreferences()
    preferences.allowsContentJavaScript = true
    configuration.defaultWebpagePreferences = preferences

    let webView = WKWebView(frame: .zero, configuration: configuration)
    self.webView = webView

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "based."
    window.center()
    window.contentView = webView
    window.delegate = self
    window.makeKeyAndOrderFront(nil)
    self.window = window

    NSApp.activate(ignoringOtherApps: true)
    loadWhenReady(attemptsRemaining: 40)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  func applicationWillTerminate(_ notification: Notification) {
    process.terminate()
  }

  private func loadWhenReady(attemptsRemaining: Int) {
    guard attemptsRemaining > 0 else { return }
    let url = URL(string: "http://\\(host):\\(port)")!
    var request = URLRequest(url: url)
    request.timeoutInterval = 1

    URLSession.shared.dataTask(with: request) { _, response, _ in
      let isReady = (response as? HTTPURLResponse)?.statusCode == 200
      DispatchQueue.main.async {
        if isReady {
          self.webView?.load(URLRequest(url: url))
        } else {
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            self.loadWhenReady(attemptsRemaining: attemptsRemaining - 1)
          }
        }
      }
    }.resume()
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
`;
  await writeFile(LAUNCHER_SOURCE, source);
  await run("swiftc", [LAUNCHER_SOURCE, "-O", "-o", LAUNCHER_BINARY]);
}

async function writeIcon() {
  await rm(ICONSET_DIR, { recursive: true, force: true });
  await mkdir(ICONSET_DIR, { recursive: true });
  const logo = join(ROOT, "public", "logo.svg");
  const targets = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024],
  ] as const;
  await Promise.all(
    targets.map(([fileName, size]) => sharp(logo).resize(size, size).png().toFile(join(ICONSET_DIR, fileName))),
  );
  await run("iconutil", ["-c", "icns", ICONSET_DIR, "-o", APP_ICON_PATH]);
  await rm(ICONSET_DIR, { recursive: true, force: true });
}

async function installApp() {
  await rm("/Applications/Based.app", { recursive: true, force: true });
  await rm(INSTALL_TARGET, { recursive: true, force: true });
  await cp(APP_DIR, INSTALL_TARGET, { recursive: true });
}

await rm(join(DIST_DIR, "Based.app"), { recursive: true, force: true });
await rm(APP_DIR, { recursive: true, force: true });
await mkdir(MACOS_DIR, { recursive: true });
await mkdir(RESOURCES_DIR, { recursive: true });
await cp(join(ROOT, ".next", "standalone"), BUNDLED_APP_DIR, { recursive: true });
await cp(join(ROOT, ".next", "static"), join(BUNDLED_APP_DIR, ".next", "static"), { recursive: true });
await cp(join(ROOT, "public"), join(BUNDLED_APP_DIR, "public"), { recursive: true });
await writeInfoPlist();
await writeIcon();
await writeLauncher();
await installApp();

console.log(`Built ${APP_DIR}`);
console.log(`Installed ${INSTALL_TARGET}`);
