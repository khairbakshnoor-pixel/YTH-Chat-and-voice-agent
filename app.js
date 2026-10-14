import { RetellClient } from "https://esm.sh/retell-client-js-sdk@latest";

const CHAT_WEBHOOK = "https://services.leadconnectorhq.com/hooks/qaTTJdC7JjpsVDY1grrC/webhook-trigger/799739da-29ba-40e5-b7fe-c4053f379b85";
const RETELL_AGENT_ID = "agent_ab14ae832f0140d4b4c90e236b";
const RETELL_PUBLIC_KEY = "public_key_249af822a5d70f5e84d2b";

const launcher = document.querySelector("#assistant-launcher");
const panel = document.querySelector("#assistant-panel");
const closeButton = document.querySelector("#close-panel");
const actionButtons = [...document.querySelectorAll("[data-action]")];
const backButtons = [...document.querySelectorAll("[data-back]")];
const welcomeView = document.querySelector("#welcome-view");
const chatView = document.querySelector("#chat-view");
const voiceView = document.querySelector("#voice-view");
const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const messages = document.querySelector("#messages");
const chatStatus = document.querySelector("#chat-status");
const sendButton = chatForm.querySelector("button");
const callButton = document.querySelector("#call-button");
const voiceStatus = document.querySelector("#voice-status");
const voiceTitle = document.querySelector("#voice-title");
const voiceError = document.querySelector("#voice-error");
const voiceOrb = document.querySelector("#voice-orb");
const headerStatus = document.querySelector("#header-status");

let activeMode = "home";
let activeCall = null;
let messageCounter = 0;
let leadCapture = { step: "message", message: "", name: "", email: "", phone: "" };
let handoffSent = false;

function setOpen(isOpen) {
  if (isOpen) setMode("home");
  panel.hidden = !isOpen;
  launcher.setAttribute("aria-expanded", String(isOpen));
  launcher.querySelector("span").textContent = isOpen ? "Close" : "Talk to AI";
}

function setMode(mode) {
  activeMode = mode;
  welcomeView.hidden = mode !== "home";
  chatView.hidden = mode !== "chat";
  voiceView.hidden = mode !== "voice";
  if (mode === "chat") messageInput.focus();
  backButtons.forEach((button) => { button.disabled = Boolean(activeCall); });
}

function addMessage(text, kind) {
  const row = document.createElement("div");
  row.className = `message ${kind === "user" ? "user-message" : "assistant-message"}`;

  if (kind !== "user") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "Y";
    row.append(avatar);
  }

  const bubble = document.createElement("p");
  bubble.textContent = text;
  row.append(bubble);
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
}

function getReply(data) {
  if (!data || typeof data !== "object") return "";
  const reply = data.user_facing_reply ?? data.agent_reply;
  return typeof reply === "string" ? reply.trim() : "";
}

async function sendMessage(event) {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message || sendButton.disabled || handoffSent) return;

  messageCounter += 1;
  addMessage(message, "user");
  messageInput.value = "";
  chatStatus.textContent = "";
  sendButton.disabled = true;

  try {
    if (leadCapture.step === "message") {
      leadCapture.message = message;
      leadCapture.step = "name";
      addMessage("I'd be happy to help. What name should I use?", "assistant");
      updateInputForStep();
      return;
    }

    if (leadCapture.step === "name") {
      leadCapture.name = message;
      leadCapture.step = "email";
      addMessage("Thanks. What's the best email address for you?", "assistant");
      updateInputForStep();
      return;
    }

    if (leadCapture.step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message)) {
        addMessage("That email doesn't look quite right. Could you check it and send it again?", "assistant");
        return;
      }
      leadCapture.email = message;
      leadCapture.step = "phone";
      addMessage("Got it. What's the best phone number to reach you?", "assistant");
      updateInputForStep();
      return;
    }

    if (leadCapture.step === "phone") {
      const digitCount = message.replace(/\D/g, "").length;
      if (digitCount < 7 || digitCount > 15) {
        addMessage("Please enter a phone number with 7 to 15 digits.", "assistant");
        return;
      }

      leadCapture.phone = message;
      chatStatus.textContent = "Sending your details...";
      const response = await fetch(CHAT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "website_chat_handoff",
          source: "website_chat",
          conversation_id: getConversationId(),
          message_id: `msg_${Date.now()}_${messageCounter}`,
          message: leadCapture.message,
          name: leadCapture.name,
          contact_name: leadCapture.name,
          first_name: leadCapture.name.split(/\s+/)[0],
          email: leadCapture.email,
          phone: leadCapture.phone,
          handoff: true,
          timestamp: new Date().toISOString(),
        }),
      });

      let responseData = null;
      const responseText = await response.text();
      if (responseText) {
        try { responseData = JSON.parse(responseText); } catch { responseData = { reply: responseText }; }
      }
      if (!response.ok) throw new Error(`Webhook returned ${response.status}`);

      handoffSent = true;
      leadCapture.step = "handoff";
      messageInput.disabled = true;
      const reply = getReply(responseData);
      const firstName = leadCapture.name.split(/\s+/)[0];
      addMessage(reply || `Thanks, ${firstName}. We'll be in touch shortly.`, "assistant");
      chatStatus.textContent = "";
    }
  } catch (error) {
    console.error("Chat webhook request failed:", error);
    chatStatus.textContent = "Couldn't send your details just now. Please try again.";
    messageInput.value = message;
  } finally {
    sendButton.disabled = handoffSent;
    if (!handoffSent) {
      updateInputForStep();
      messageInput.focus();
    }
  }
}

function updateInputForStep() {
  const settings = {
    message: { placeholder: "Write a message...", inputMode: "text", autocomplete: "off", maxLength: "1000" },
    name: { placeholder: "Your name", inputMode: "text", autocomplete: "name", maxLength: "100" },
    email: { placeholder: "Your email address", inputMode: "email", autocomplete: "email", maxLength: "254" },
    phone: { placeholder: "Your phone number", inputMode: "tel", autocomplete: "tel", maxLength: "30" },
  }[leadCapture.step];
  if (!settings) return;
  messageInput.placeholder = settings.placeholder;
  messageInput.inputMode = settings.inputMode;
  messageInput.autocomplete = settings.autocomplete;
  messageInput.maxLength = Number(settings.maxLength);
}

function beginChat() {
  leadCapture = { step: "message", message: "", name: "", email: "", phone: "" };
  handoffSent = false;
  messages.replaceChildren();
  addMessage("Hi there, how can I help you today?", "assistant");
  chatStatus.textContent = "";
  messageInput.disabled = false;
  sendButton.disabled = false;
  updateInputForStep();
}

function getConversationId() {
  let id = sessionStorage.getItem("assistant-conversation-id");
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? `conversation_${Date.now()}`;
    sessionStorage.setItem("assistant-conversation-id", id);
  }
  return id;
}

function resetCallUi() {
  activeCall = null;
  callButton.disabled = false;
  callButton.classList.remove("is-ending");
  callButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z" /></svg><span>Start talking</span>';
  voiceOrb.classList.remove("is-live");
  voiceTitle.textContent = "Talk to our AI";
  voiceStatus.textContent = "A quick voice conversation, right here.";
  headerStatus.textContent = "Online · Ready to help";
}

async function toggleCall() {
  voiceError.textContent = "";

  if (activeCall) {
    callButton.disabled = true;
    try {
      await activeCall.end();
    } catch (error) {
      console.error("Could not end Retell call:", error);
    }
    resetCallUi();
    return;
  }

  callButton.disabled = true;
  voiceStatus.textContent = "Connecting... allow microphone access when asked.";

  try {
    const client = new RetellClient({ key: RETELL_PUBLIC_KEY });
    activeCall = client.createWebCall({
      agent_id: RETELL_AGENT_ID,
      hooks: {
        onStatus(status) {
          if (status === "live") {
            voiceTitle.textContent = "You're connected";
            voiceStatus.textContent = "Go ahead, we're listening.";
            voiceOrb.classList.add("is-live");
            callButton.disabled = false;
            callButton.classList.add("is-ending");
            callButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" /></svg><span>End conversation</span>';
            headerStatus.textContent = "Voice conversation live";
          }
          if (status === "ended") resetCallUi();
        },
        onEnd() { resetCallUi(); },
        onError(error) {
          console.error("Retell call failed:", error);
          voiceError.textContent = "Call couldn't start. Check microphone permission and try again.";
          resetCallUi();
        },
      },
    });
    callButton.disabled = false;
  } catch (error) {
    console.error("Retell SDK could not start:", error);
    voiceError.textContent = "Call couldn't start. Check microphone permission and try again.";
    resetCallUi();
  }
}

launcher.addEventListener("click", () => setOpen(panel.hidden));
closeButton.addEventListener("click", () => setOpen(false));
actionButtons.forEach((button) => button.addEventListener("click", () => {
  const action = button.dataset.action;
  if (action === "chat") beginChat();
  setMode(action === "chat" ? "chat" : "voice");
  if (action === "talk") toggleCall();
}));
backButtons.forEach((button) => button.addEventListener("click", () => setMode("home")));
chatForm.addEventListener("submit", sendMessage);
callButton.addEventListener("click", toggleCall);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    if (activeCall) return;
    setOpen(false);
    launcher.focus();
  }
});