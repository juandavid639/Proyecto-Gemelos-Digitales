import { useEffect } from "react";

/**
 * Hook for registering global keyboard shortcuts.
 * Takes an array of { keys, handler, description, enabled } objects.
 *
 * Key format: "ctrl+k", "shift+/", "escape", "j", "1"
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { keys: "ctrl+k", handler: () => setOpen(true), description: "Open palette" },
 *     { keys: "escape", handler: () => setOpen(false) },
 *   ]);
 */
export default function useKeyboardShortcuts(shortcuts, deps = []) {
  useEffect(() => {
    if (!Array.isArray(shortcuts) || shortcuts.length === 0) return;

    const handler = (e) => {
      // Don't trigger while typing in an input/textarea (except Escape)
      const target = e.target;
      const isInput = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        if (!matchesShortcut(e, shortcut.keys)) continue;

        // Escape always works. Other shortcuts skipped in inputs unless
        // explicitly opted in via allowInInput.
        if (isInput && shortcut.keys !== "escape" && !shortcut.allowInInput) {
          continue;
        }

        // Modifier shortcuts (ctrl/cmd) work even in inputs
        const hasModifier = /ctrl\+|cmd\+|meta\+/i.test(shortcut.keys);
        if (isInput && !hasModifier && shortcut.keys !== "escape" && !shortcut.allowInInput) {
          continue;
        }

        e.preventDefault();
        e.stopPropagation();
        try {
          shortcut.handler(e);
        } catch (err) {
          console.warn("Shortcut handler error:", err);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function matchesShortcut(event, keys) {
  const parts = String(keys || "").toLowerCase().split("+").map(s => s.trim());
  const wanted = {
    ctrl: parts.includes("ctrl") || parts.includes("cmd") || parts.includes("meta"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  };
  const keyPart = parts.filter(p => !["ctrl", "cmd", "meta", "shift", "alt"].includes(p))[0];

  const actualCtrl = event.ctrlKey || event.metaKey;
  if (wanted.ctrl !== actualCtrl) return false;
  if (wanted.shift !== event.shiftKey) return false;
  if (wanted.alt !== event.altKey) return false;

  if (!keyPart) return true;

  const key = (event.key || "").toLowerCase();
  if (keyPart === "escape") return key === "escape";
  if (keyPart === "enter") return key === "enter";
  if (keyPart === "space") return key === " ";
  if (keyPart === "/") return key === "/";
  return key === keyPart;
}
