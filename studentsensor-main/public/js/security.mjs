/**
 * Client-side security utilities
 */

/**
 * Escape HTML to prevent XSS attacks
 */
export function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape HTML attributes
 */
export function escapeAttr(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Safe HTML insertion (use textContent instead of innerHTML when possible)
 */
export function safeSetText(element, text) {
  if (!element) return;
  element.textContent = text || "";
}

/**
 * Safe HTML insertion with escaping
 */
export function safeSetHtml(element, html) {
  if (!element) return;
  // Only allow safe HTML - escape everything
  element.textContent = html || "";
}
