const form = document.querySelector("#shorten-form");
const urlInput = document.querySelector("#url");
const aliasInput = document.querySelector("#alias");
const expiryInput = document.querySelector("#expires_at");
const submitButton = document.querySelector("#submit-button");
const buttonLabel = document.querySelector(".button-label");
const formError = document.querySelector("#form-error");
const resultCard = document.querySelector("#result-card");
const shortUrl = document.querySelector("#short-url");
const originalUrl = document.querySelector("#original-url");
const copyButton = document.querySelector("#copy-button");
const copyLabel = document.querySelector("#copy-label");
const copyStatus = document.querySelector("#copy-status");
const aliasOrigin = document.querySelector("#alias-origin");

aliasOrigin.textContent = `${window.location.host}/`;

function showFieldError(input, message) {
  const error = document.querySelector(`#${input.id}-error`);
  if (error) error.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearErrors() {
  formError.textContent = "";
  [urlInput, aliasInput, expiryInput].forEach((input) => showFieldError(input, ""));
}

function setLoading(loading) {
  submitButton.disabled = loading;
  buttonLabel.textContent = loading ? "Shortening…" : "Shorten link";
  submitButton.setAttribute("aria-busy", String(loading));
}

function validateForm() {
  clearErrors();
  let valid = true;

  const url = urlInput.value.trim();
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error("invalid");
    }
  } catch {
    showFieldError(urlInput, "Enter a valid URL beginning with http:// or https://.");
    valid = false;
  }

  const alias = aliasInput.value.trim();
  if (alias && !/^[a-zA-Z0-9_-]{3,30}$/.test(alias)) {
    showFieldError(aliasInput, "Use 3–30 letters, numbers, hyphens or underscores.");
    valid = false;
  }

  if (expiryInput.value) {
    const expiryDate = new Date(expiryInput.value);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
      showFieldError(expiryInput, "Choose a date and time in the future.");
      valid = false;
    }
  }

  return valid;
}

[urlInput, aliasInput, expiryInput].forEach((input) => {
  input.addEventListener("input", () => {
    showFieldError(input, "");
    formError.textContent = "";
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  const payload = {
    url: urlInput.value.trim(),
    alias: aliasInput.value.trim(),
    expires_at: expiryInput.value ? new Date(expiryInput.value).toISOString() : null
  };

  setLoading(true);
  formError.textContent = "";
  copyStatus.textContent = "";

  try {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409) {
        showFieldError(aliasInput, data.error || "That alias is already taken. Try another.");
      } else if (response.status === 400 && /url/i.test(data.error || "")) {
        showFieldError(urlInput, data.error);
      } else if (response.status === 400 && /alias/i.test(data.error || "")) {
        showFieldError(aliasInput, data.error);
      } else {
        formError.textContent = data.error || "We couldn't create your link. Please try again.";
      }
      return;
    }

    shortUrl.href = data.short_url;
    shortUrl.textContent = data.short_url;
    originalUrl.textContent = data.original_url || payload.url;
    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch {
    formError.textContent = "Couldn't reach Shortly. Check that the app is running and try again.";
  } finally {
    setLoading(false);
  }
});

copyButton.addEventListener("click", async () => {
  const value = shortUrl.textContent.trim();
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    copyLabel.textContent = "Copied!";
    copyStatus.textContent = "Copied to your clipboard.";
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = value;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    const copied = document.execCommand("copy");
    temporary.remove();
    copyLabel.textContent = copied ? "Copied!" : "Select link";
    copyStatus.textContent = copied ? "Copied to your clipboard." : "Copy wasn't available. Select the link to copy it.";
  }

  window.setTimeout(() => {
    copyLabel.textContent = "Copy link";
  }, 1800);
});
