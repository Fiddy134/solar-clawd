// AppleScripts the mod runs on macOS: iTerm2's background and front, and
// what plays.

// Sets (or, given an empty path, clears) the background image of the one
// iTerm2 session whose id is the first argument, and answers the size of its
// window in points: "ok <width> <height>".
export const SET_BACKGROUND = [
  'on run argv',
  'set targetId to item 1 of argv',
  'set imagePath to item 2 of argv',
  'tell application id "com.googlecode.iterm2"',
  'repeat with w in windows',
  'repeat with t in tabs of w',
  'repeat with s in sessions of t',
  'if (id of s) is targetId then',
  'set background image of s to imagePath',
  'set b to bounds of w',
  'return "ok " & ((item 3 of b) - (item 1 of b)) & " " & ((item 4 of b) - (item 2 of b)) & " " & (frontmost as text)',
  'end if',
  'end repeat',
  'end repeat',
  'end repeat',
  'end tell',
  'return "missing"',
  'end run',
].flatMap(line => ['-e', line])

// Whether iTerm2 is the app in front.
export const ITERM_FRONTMOST = ['-e', 'tell application id "com.googlecode.iterm2" to return frontmost as text']

// "title - artist" of what Spotify or Music plays, or nothing. Neither app is
// started: each is asked only while it already runs, through `run script`
// so its terms are not looked up unless it does.
export const NOW_PLAYING = [
  'set out to ""',
  'try',
  'repeat with appId in {"com.spotify.client", "com.apple.Music"}',
  'if out is "" and application id appId is running then',
  'set out to run script "tell application id \\"" & appId & "\\"\nif player state is playing then return name of current track & \\" - \\" & artist of current track\nreturn \\"\\"\nend tell"',
  'end if',
  'end repeat',
  'end try',
  'return out',
].flatMap(line => ['-e', line])

// The scale of the main screen (2 on a Retina display), for
// `osascript -l JavaScript`: the pixels in a point.
export const SCREEN_SCALE = [
  '-e',
  [
    'ObjC.import("AppKit"); ObjC.import("CoreGraphics");',
    // The front Ghostty window, as the window server lists them front to
    // back (it asks no permission for bounds), and the screen its middle is
    // on; the main screen where there is none. The window server's y runs
    // down from the top of the first screen, AppKit's up from its bottom.
    'var screens = $.NSScreen.screens, top = screens.objectAtIndex(0).frame.size.height, scale = $.NSScreen.mainScreen.backingScaleFactor;',
    'var list = ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1 | 16, 0));',
    'for (var i = 0; i < list.count; i++) { var w = list.objectAtIndex(i);',
    '  if (ObjC.unwrap(w.objectForKey("kCGWindowOwnerName")) !== "Ghostty" || ObjC.unwrap(w.objectForKey("kCGWindowLayer")) !== 0) continue;',
    '  var b = w.objectForKey("kCGWindowBounds"), x = ObjC.unwrap(b.objectForKey("X")) + ObjC.unwrap(b.objectForKey("Width")) / 2, y = top - ObjC.unwrap(b.objectForKey("Y")) - ObjC.unwrap(b.objectForKey("Height")) / 2;',
    '  for (var j = 0; j < screens.count; j++) { var f = screens.objectAtIndex(j).frame;',
    '    if (x >= f.origin.x && x < f.origin.x + f.size.width && y >= f.origin.y && y < f.origin.y + f.size.height) scale = screens.objectAtIndex(j).backingScaleFactor; }',
    '  break; }',
    'scale',
  ].join(' '),
]
