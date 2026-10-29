
(() => {
  "use strict";

  const voiceButtons = [
    ...document.querySelectorAll("[data-open-voice]")
  ];

  const choiceButtons = [
    ...document.querySelectorAll("[data-open-assistant-choice]")
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

  const chatDialog = document.getElementById("yth-chat");
  const chatMount = document.querySelector(".ghl-chat-mount");
  const chatClose = document.querySelector("[data-close-chat]");

  const closeChoice = document.querySelector(
    "[data-close-assistant-choice]"
  );

  const notice = document.getElementById("chat-notice");
  const status = document.getElementById("chat-status");

  const dismiss = document.getElementById(
    "dismiss-notice"
  );

  let opening = false;
  let widgetFailed = false;
  let voiceWidgetScript;
  let chatWidgetScript;
  let chatWidgetLoading = false;
  let voiceLauncherObserver;

  function openAssistantChoice() {
    if (choiceDialog && !choiceDialog.open) {
      choiceDialog.showModal();
    }
  }

  function closeAssistantChoice() {
    if (choiceDialog?.open) {
      choiceDialog.close();
    }
  }

  choiceButtons.forEach(button => {
    button.addEventListener("click", openAssistantChoice);
  });

  chatLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      openAssistantChoice();
    });
  });

  closeChoice?.addEventListener("click", closeAssistantChoice);

  function loadChatWidget() {
    if (!chatMount || chatWidgetScript || chatWidgetLoading) return;

    chatWidgetLoading = true;
    chatWidgetScript = document.createElement("script");
    chatWidgetScript.src =
      "https://widgets.leadconnectorhq.com/loader.js";
    chatWidgetScript.dataset.resourcesUrl =
      "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
    chatWidgetScript.dataset.widgetId = "6ad27f6acc8a6767ee65d462";
    chatWidgetScript.addEventListener("load", () => {
      chatWidgetLoading = false;
    }, { once: true });
    chatWidgetScript.addEventListener("error", () => {
      chatWidgetLoading = false;
      chatWidgetScript = undefined;
      showNotice(
        "Chat assistant could not load. Please refresh the page and try again."
      );
    }, { once: true });
    chatMount.append(chatWidgetScript);
  }

  chatChoice?.addEventListener("click", () => {
    closeAssistantChoice();

    if (chatDialog && !chatDialog.open) {
      chatDialog.show();
      loadChatWidget();
    }
  });

  chatClose?.addEventListener("click", () => {
    chatDialog?.close();
  });

  chatDialog?.addEventListener("click", event => {
    if (event.target === chatDialog) {
      chatDialog.close();
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
    hideVoiceLauncher();

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

  function hideVoiceLauncher() {
    const launcher = findRetellElement(
      'button[aria-label="Open Assistant"], ' +
      'button[aria-label="Return to active call"]'
    );

    if (launcher) {
      launcher.style.display = "none";
      launcher.setAttribute("aria-hidden", "true");
      launcher.tabIndex = -1;
    }

    const root = document.getElementById("retell-widget-root");

    if (root && !voiceLauncherObserver) {
      voiceLauncherObserver = new MutationObserver(hideVoiceLauncher);
      voiceLauncherObserver.observe(root, {
        childList: true,
        subtree: true
      });
    }
  }

  // Start voice conversation
  async function startVoice() {
    if (opening) return;

    closeAssistantChoice();

    if (notice) notice.hidden = true;

    if (openVoiceWidget()) return;

    if (!voiceWidgetScript) {
      voiceWidgetScript = document.createElement("script");
      voiceWidgetScript.id = "retell-widget";
      voiceWidgetScript.type = "module";
      voiceWidgetScript.src =
        "https://dashboard.retellai.com/retell-widget-v2.js";
      voiceWidgetScript.dataset.voicePublicKey =
        "public_key_249af822a5d70f5e84d2b";
      voiceWidgetScript.dataset.voiceAgentId =
        "agent_ab14ae832f0140d4b4c90e236b";
      voiceWidgetScript.dataset.title = "YTH Voice Assistant";
      voiceWidgetScript.dataset.logoUrl = "./yth-mark.svg";
      voiceWidgetScript.dataset.botName = "YTH Voice Assistant";
      voiceWidgetScript.dataset.fabText = "Talk With Us";
      voiceWidgetScript.dataset.fabIconUrl = "./yth-mark.svg";
      voiceWidgetScript.dataset.popupMessage =
        "Prefer talking? Start a voice conversation.";
      voiceWidgetScript.dataset.showAiPopup = "false";
      voiceWidgetScript.dataset.themeColor = "#123f45";
      voiceWidgetScript.dataset.componentColor = "#14766f";
      voiceWidgetScript.dataset.autoOpen = "false";
      voiceWidgetScript.addEventListener("error", () => {
        widgetFailed = true;
      }, { once: true });
      document.head.append(voiceWidgetScript);
    }

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
        "Please refresh the page and choose voice again."
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
