
const form = document.querySelector("#shorten-form");
const urlInput = document.querySelector("#url");
const aliasInput = document.querySelector("#alias");
const expiryInput = document.querySelector("#expires-at");
const errorMessage = document.querySelector("#form-error");
const submitButton = document.querySelector("#submit-button");
const buttonLabel = document.querySelector("#button-label");
const buttonSpinner = document.querySelector("#button-spinner");
const resultCard = document.querySelector("#result-card");
const shortUrl = document.querySelector("#short-url");
const originalUrl = document.querySelector("#original-url");
const expiryInfo = document.querySelector("#expiry-info");
const copyButton = document.querySelector("#copy-button");
const createAnotherButton = document.querySelector("#create-another");
const aliasPrefix = document.querySelector("#alias-prefix");

aliasPrefix.textContent = `${window.location.host}/`;

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

function setLoading(loading) {
    submitButton.disabled = loading;
    urlInput.disabled = loading;
    aliasInput.disabled = loading;
    expiryInput.disabled = loading;
    buttonLabel.textContent = loading ? "Creating link..." : "Shorten link";
    buttonSpinner.hidden = !loading;
}

function formatExpiry(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;
    resultCard.hidden = true;

    if (!form.reportValidity()) return;

    const url = urlInput.value.trim();
    const alias = aliasInput.value.trim();
    const localExpiry = expiryInput.value;

    if (localExpiry && new Date(localExpiry).getTime() <= Date.now()) {
        showError("Pick a date and time in the future.");
        return;
    }

    const payload = { url };

    if (alias) payload.alias = alias;

    if (localExpiry) {
        payload.expires_at = new Date(localExpiry).toISOString();
    }

    setLoading(true);

    try {
        const response = await fetch("/api/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || "Couldn't create your link. Please try again.");
            return;
        }

        shortUrl.textContent = data.short_url;
        shortUrl.href = data.short_url;
        originalUrl.textContent = data.original_url;

        expiryInfo.hidden = !data.expires_at;
        expiryInfo.textContent = data.expires_at
            ? `Expires ${formatExpiry(data.expires_at)}`
            : "This link never expires.";

        resultCard.hidden = false;
        resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
        showError("Couldn't reach Shortly. Check that the server is running and try again.");
    } finally {
        setLoading(false);
    }
});

copyButton.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(shortUrl.href);
        copyButton.textContent = "Copied!";
    } catch {
        const range = document.createRange();
        range.selectNodeContents(shortUrl);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copyButton.textContent = "Select and copy";
    }

    window.setTimeout(() => {
        copyButton.textContent = "Copy link";
    }, 1800);
});

createAnotherButton.addEventListener("click", () => {
    form.reset();
    resultCard.hidden = true;
    errorMessage.hidden = true;
    urlInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
});
