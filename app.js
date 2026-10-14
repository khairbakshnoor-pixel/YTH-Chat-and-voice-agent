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
const leadForm = document.querySelector("#lead-form");
const leadNameInput = document.querySelector("#lead-name");
const leadPhoneInput = document.querySelector("#lead-phone");
const leadEmailInput = document.querySelector("#lead-email");
const leadStatus = document.querySelector("#lead-status");
const chatChoice = document.querySelector('[data-action="chat"]');
const chatChoiceHint = document.querySelector("#chat-choice-hint");
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
let leadCapture = { message: "", name: "", email: "", phone: "" };
let intakeSubmitted = false;
let chatStarted = false;
let handoffStarted = false;

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
  if (!message || sendButton.disabled || !intakeSubmitted || handoffStarted) return;

  leadCapture.message = message;
  messageCounter += 1;
  addMessage(message, "user");
  messageInput.value = "";
  chatStatus.textContent = "";
  sendButton.disabled = true;

  try {
    const response = await fetch(CHAT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "website_chat_handoff",
        source: "website_chat",
        conversation_id: getConversationId(),
        message_id: `msg_${Date.now()}_${messageCounter}`,
        message,
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
      try { responseData = JSON.parse(responseText); } catch { responseData = null; }
    }
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);

    handoffStarted = true;
    chatForm.hidden = true;
    const reply = getReply(responseData);
    if (reply) addMessage(reply, "assistant");
    else chatStatus.textContent = "Connecting you with our team...";
  } catch (error) {
    console.error("Chat webhook request failed:", error);
    chatStatus.textContent = "Couldn't send your message just now. Please try again.";
    messageInput.value = message;
  } finally {
    sendButton.disabled = handoffStarted;
    messageInput.disabled = handoffStarted;
    if (!handoffStarted) messageInput.focus();
  }
}

async function submitLead(event) {
  event.preventDefault();
  if (intakeSubmitted) return;

  leadCapture.name = leadNameInput.value.trim();
  leadCapture.phone = leadPhoneInput.value.trim();
  leadCapture.email = leadEmailInput.value.trim();
  const digitCount = leadCapture.phone.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) {
    chatStatus.textContent = "Please enter a valid phone number.";
    leadPhoneInput.focus();
    return;
  }

  const leadSubmitButton = leadForm.querySelector("button[type='submit']");
  leadSubmitButton.disabled = true;
  leadStatus.textContent = "Submitting...";

  try {
    const response = await fetch(CHAT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "website_chat_lead",
        source: "website_chat",
        conversation_id: getConversationId(),
        message_id: `lead_${Date.now()}`,
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

    intakeSubmitted = true;
    chatChoice.disabled = false;
    chatChoiceHint.textContent = "Continue the conversation";
    leadStatus.textContent = "Thanks. Select Chat agent to continue.";
    leadForm.querySelectorAll("input").forEach((input) => { input.disabled = true; });
    leadSubmitButton.querySelector("span").textContent = "Submitted";
  } catch (error) {
    console.error("Chat webhook request failed:", error);
    leadStatus.textContent = "Couldn't submit your details. Please try again.";
    leadSubmitButton.disabled = false;
  }
}

function beginChat() {
  if (!intakeSubmitted) return;
  if (!chatStarted) {
    messages.replaceChildren();
    addMessage(`Hi ${leadCapture.name.split(/\s+/)[0]}, how can I help you today?`, "assistant");
    chatStarted = true;
  }
  chatStatus.textContent = handoffStarted ? "Connecting you with our team..." : "";
  chatForm.hidden = handoffStarted;
  messageInput.disabled = handoffStarted;
  sendButton.disabled = handoffStarted;
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
  if (action === "chat") {
    if (!intakeSubmitted) return;
    beginChat();
  }
  setMode(action === "chat" ? "chat" : "voice");
  if (action === "talk") toggleCall();
}));
backButtons.forEach((button) => button.addEventListener("click", () => setMode("home")));
chatForm.addEventListener("submit", sendMessage);
leadForm.addEventListener("submit", submitLead);
callButton.addEventListener("click", toggleCall);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    if (activeCall) return;
    setOpen(false);
    launcher.focus();
  }
});