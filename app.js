
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
  const chatSuggestions = document.querySelector(".chat-suggestions");
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
  let chatWidgetLayoutObserver;
  let observedChatWidgetRoot;
  let observedChatPaneRoot;
  let voiceLauncherObserver;
  let voiceBrandingObserver;
  const observedVoiceShadowRoots = new WeakSet();

  function configureChatWidgetLayout() {
    const widget = chatMount?.querySelector("chat-widget");
    const widgetRoot = widget?.shadowRoot;

    if (!widgetRoot) return;

    if (chatWidgetLayoutObserver &&
        observedChatWidgetRoot !== widgetRoot) {
      chatWidgetLayoutObserver?.observe(widgetRoot, {
        childList: true,
        subtree: true
      });
      observedChatWidgetRoot = widgetRoot;
    }

    if (!widgetRoot.getElementById("yth-chat-layout")) {
      const style = document.createElement("style");
      style.id = "yth-chat-layout";
      style.textContent =
        ':host{display:block!important;width:100%!important;' +
        'height:100%!important;min-height:0!important}' +
        ':host>div{display:block!important;width:100%!important;' +
        'height:100%!important;min-height:0!important}' +
        'div[data-active="true"]{display:flex!important;' +
        'flex-direction:column!important;width:100%!important;' +
        'height:100%!important;min-height:0!important}' +
        '#lc_text-widget{display:flex!important;flex:1 1 auto!important;' +
        'flex-direction:column!important;justify-content:flex-start!important;' +
        'width:100%!important;height:100%!important;min-height:0!important}' +
        '#lc_text-widget--box{display:flex!important;flex:1 1 auto!important;' +
        'width:100%!important;height:100%!important;min-height:0!important}' +
        '#lc_text-widget--box>.lc_text-widget--header-wrapper{' +
        'flex:0 0 auto!important}' +
        '#lc_text-widget--box>chat-pane{display:flex!important;' +
        'flex:1 1 auto!important;min-height:0!important;height:auto!important}';
      widgetRoot.append(style);
    }

    const paneRoot = widgetRoot.querySelector("chat-pane")?.shadowRoot;

    if (!paneRoot) return false;

    if (chatWidgetLayoutObserver &&
        observedChatPaneRoot !== paneRoot) {
      chatWidgetLayoutObserver.observe(paneRoot, {
        childList: true,
        subtree: true
      });
      observedChatPaneRoot = paneRoot;
    }

    if (!paneRoot.getElementById("yth-chat-layout")) {
      const style = document.createElement("style");
      style.id = "yth-chat-layout";
      style.textContent =
        ':host{display:flex!important;flex-direction:column!important;' +
        'flex:1 1 auto!important;min-height:0!important;height:100%!important}' +
        'chat-conversation{display:block!important;flex:1 1 auto!important;' +
        'min-height:0!important;height:100%!important}' +
        '.footer{flex:0 0 auto!important}' +
        '.chat-suggestions{display:grid;grid-template-columns:' +
        'repeat(2,minmax(0,1fr));gap:7px;padding:10px 12px;' +
        'background:#fff;border-top:1px solid #e0e8e2}' +
        '.chat-suggestions[hidden]{display:none}' +
        '.chat-suggestion{min-height:32px;padding:6px 10px;color:#123f45;' +
        'background:#f7faf7;border:1px solid #dce3dc;border-radius:999px;' +
        'font:11px/1.25 "Segoe UI",Arial,sans-serif;cursor:pointer}' +
        '.chat-suggestion:hover{background:#d4ee9d;border-color:#d4ee9d}';
      paneRoot.append(style);
    }

    const chatFooter = paneRoot.querySelector(".footer");
    if (!chatFooter) return false;

    if (chatSuggestions &&
        chatSuggestions.parentElement !== paneRoot) {
      chatFooter.before(chatSuggestions);
      chatSuggestions.hidden = false;
    }

    chatWidgetLayoutObserver?.disconnect();
    chatWidgetLayoutObserver = undefined;
    observedChatWidgetRoot = undefined;
    observedChatPaneRoot = undefined;

    return true;
  }

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

  function findChatElements(selector) {
    const matches = [];

    function search(root) {
      matches.push(...root.querySelectorAll(selector));

      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) {
          search(element.shadowRoot);
        }
      }
    }

    if (chatMount) search(chatMount);
    return matches;
  }

  function sendChatSuggestion(message) {
    const editors = findChatElements(
      'textarea, input:not([type="hidden"]), [contenteditable="true"]'
    ).filter(element =>
      !element.disabled && element.getClientRects().length > 0
    );
    const editor = editors.find(element =>
      /message|chat|reply/i.test(
        `${element.getAttribute("placeholder") || ""} ` +
        `${element.getAttribute("aria-label") || ""}`
      )
    ) || editors[editors.length - 1];

    if (!editor) {
      showNotice(
        "Chat assistant is still loading. Please try your suggestion again."
      );
      return false;
    }

    editor.focus();

    if (editor instanceof HTMLInputElement ||
        editor instanceof HTMLTextAreaElement) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(editor),
        "value"
      )?.set;

      if (valueSetter) {
        valueSetter.call(editor, message);
      } else {
        editor.value = message;
      }
    } else {
      editor.textContent = message;
    }

    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      composed: true,
      inputType: "insertText",
      data: message
    }));

    const sendButton = findChatElements(
      'button[type="submit"], button[aria-label], button[title]'
    ).find(button =>
      button.type === "submit" ||
      /send/i.test(
        `${button.getAttribute("aria-label") || ""} ` +
        `${button.getAttribute("title") || ""}`
      )
    );

    if (sendButton && !sendButton.disabled) {
      sendButton.click();
    } else {
      editor.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        composed: true
      }));
      editor.dispatchEvent(new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        composed: true
      }));
    }

    return true;
  }

  chatSuggestions?.querySelectorAll("[data-chat-suggestion]").forEach(
    button => {
      button.addEventListener("click", () => {
        if (sendChatSuggestion(button.dataset.chatSuggestion)) {
          chatSuggestions.hidden = true;
        }
      });
    }
  );

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
    chatWidgetLayoutObserver = new MutationObserver(
      configureChatWidgetLayout
    );
    chatWidgetLayoutObserver.observe(chatMount, {
      childList: true,
      subtree: true
    });
    chatWidgetScript = document.createElement("script");
    chatWidgetScript.src =
      "https://widgets.leadconnectorhq.com/loader.js";
    chatWidgetScript.dataset.resourcesUrl =
      "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
    chatWidgetScript.dataset.widgetId = "6ad27f6acc8a6767ee65d462";
    chatWidgetScript.addEventListener("load", () => {
      chatWidgetLoading = false;
      configureChatWidgetLayout();
      customElements.whenDefined("chat-widget").then(
        configureChatWidgetLayout
      );
      customElements.whenDefined("chat-pane").then(
        configureChatWidgetLayout
      );
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
      if (root.host && voiceBrandingObserver &&
          !observedVoiceShadowRoots.has(root)) {
        observedVoiceShadowRoots.add(root);
        voiceBrandingObserver.observe(root, {
          childList: true,
          subtree: true
        });
      }

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

  function hideVoiceBranding() {
    const subtitle = findRetellElement('[class*="brandSubtitle"]');

    if (subtitle?.textContent.trim() === "Your RetellAI assistant") {
      subtitle.style.setProperty("display", "none", "important");
    }

    const attributionLink = findRetellElement(
      'a[href*="retellai.com"]'
    );
    const attribution = attributionLink?.parentElement;

    if (attribution?.textContent.replace(/\s+/g, " ").trim() ===
        "Powered by Retell") {
      attribution.style.setProperty("display", "none", "important");
    }
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
    hideVoiceBranding();

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

    if (root && !voiceBrandingObserver) {
      voiceBrandingObserver = new MutationObserver(hideVoiceLauncher);
    }

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
        "agent_2b5727c8a6c38664748b2d28cc";
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
