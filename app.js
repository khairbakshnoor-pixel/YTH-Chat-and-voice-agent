
(() => {
  "use strict";

  // GHL text chat loads from index.html.
  // Retell is used only for the voice assistant.

  const voiceButtons = [
    ...document.querySelectorAll("[data-open-voice]")
  ];

  const chatLinks = [
    ...document.querySelectorAll('a[href="#yth-chat"]')
  ];

  const choiceDialog = document.getElementById(
    "assistant-choice"
  );

  const chatChoice = document.querySelector(
    "[data-start-chat]"
  );

  const closeChoice = document.querySelector(
    "[data-close-assistant-choice]"
  );

  const notice = document.getElementById("chat-notice");
  const status = document.getElementById("chat-status");

  const dismiss = document.getElementById(
    "dismiss-notice"
  );

  const widgetScript = document.getElementById(
    "retell-widget"
  );

  let opening = false;
  let widgetFailed = false;

  function closeAssistantChoice() {
    if (choiceDialog?.open) {
      choiceDialog.close();
    }
  }

  chatLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      if (choiceDialog && !choiceDialog.open) {
        choiceDialog.showModal();
      }
    });
  });

  closeChoice?.addEventListener("click", closeAssistantChoice);

  chatChoice?.addEventListener("click", () => {
    closeAssistantChoice();

    const chatCard = document.getElementById("yth-chat");

    if (chatCard) {
      chatCard.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      chatCard.focus({ preventScroll: true });
    }
  });

  // Show voice notification
  function showNotice(message) {
    if (!notice || !status) return;

    status.textContent = message;
    notice.hidden = false;
  }

  // Dismiss notification
  dismiss?.addEventListener("click", () => {
    notice.hidden = true;
  });

  // Detect Retell script error
  widgetScript?.addEventListener("error", () => {
    widgetFailed = true;
  });

  // Find Retell elements inside shadow DOM
  function findRetellElement(selector) {
    const mount = document.getElementById(
      "retell-widget-root"
    );

    if (!mount) return null;

    function search(root) {
      const match = root.querySelector(selector);

      if (match) return match;

      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) {
          const nested = search(element.shadowRoot);

          if (nested) return nested;
        }
      }

      return null;
    }

    return search(mount);
  }

  // Open Retell Voice Assistant
  function openVoiceWidget() {
    const alreadyOpen = findRetellElement(
      'button[aria-label="Minimize window"]'
    );

    if (alreadyOpen) {
      alreadyOpen.focus();
      return true;
    }

    const launcher = findRetellElement(
      'button[aria-label="Open Assistant"], ' +
      'button[aria-label="Return to active call"]'
    );

    if (!launcher) return false;

    launcher.click();
    return true;
  }

  // Start voice conversation
  async function startVoice() {
    if (opening) return;

    closeAssistantChoice();

    if (notice) notice.hidden = true;

    if (openVoiceWidget()) return;

    opening = true;

    for (const button of voiceButtons) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }

    showNotice("Opening your YTH voice assistant...");

    try {
      const deadline = Date.now() + 15000;

      while (!widgetFailed && Date.now() < deadline) {
        await new Promise(resolve =>
          setTimeout(resolve, 250)
        );

        if (openVoiceWidget()) {
          if (notice) notice.hidden = true;
          return;
        }
      }

      showNotice(
        "Voice assistant could not load. " +
        "Refresh the page or use the Talk to YTH " +
        "button at the bottom corner."
      );

    } finally {
      opening = false;

      for (const button of voiceButtons) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  }

  // Connect all voice buttons
  voiceButtons.forEach(button => {
    button.addEventListener("click", startVoice);
  });

})();
