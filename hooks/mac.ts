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
