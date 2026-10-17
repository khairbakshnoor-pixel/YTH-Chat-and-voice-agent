(() => {
  'use strict';

  const triggers = document.querySelectorAll('[data-open-chat]');
  const notice = document.getElementById('chat-notice');
  const status = document.getElementById('chat-status');
  const widgetScript = document.getElementById('retell-widget');
  let opening = false;
  let widgetFailed = false;

  function showNotice(message) {
    status.textContent = message;
    notice.hidden = false;
  }

  document.getElementById('dismiss-notice').addEventListener('click', () => {
    notice.hidden = true;
  });

  widgetScript.addEventListener('error', () => {
    widgetFailed = true;
  });

  // Retell renders inside an open shadow root. Keep lookups scoped to its
  // own mount, and use accessible labels rather than generated CSS classes.
  function findWidgetElement(selector) {
    const root = document.getElementById('retell-widget-root');
    if (!root) return null;

    function search(container) {
      const match = container.querySelector(selector);
      if (match) return match;
      for (const element of container.querySelectorAll('*')) {
        if (element.shadowRoot) {
          const shadowMatch = search(element.shadowRoot);
          if (shadowMatch) return shadowMatch;
        }
      }
      return null;
    }

    return search(root);
  }

  function openWidget() {
    const alreadyOpen = findWidgetElement('button[aria-label="Minimize window"]');
    if (alreadyOpen) {
      const input = findWidgetElement('textarea, input[type="text"], [contenteditable="true"]');
      (input || alreadyOpen).focus();
      return true;
    }

    const launcher = findWidgetElement('button[aria-label="Open Assistant"], button[aria-label="Return to active call"]');
    if (!launcher) return false;
    launcher.click();
    return true;
  }

  async function openAssistant() {
    if (opening) return;
    notice.hidden = true;
    if (openWidget()) return;

    opening = true;
    triggers.forEach(button => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    });
    showNotice('Opening your YTH assistant…');

    try {
      const deadline = Date.now() + 15000;
      while (!widgetFailed && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (openWidget()) {
          notice.hidden = true;
          return;
        }
      }
      showNotice('The assistant couldn’t load. Check your connection, then refresh the page to try again.');
    } finally {
      opening = false;
      triggers.forEach(button => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      });
    }
  }

  triggers.forEach(button => button.addEventListener('click', openAssistant));
})();
