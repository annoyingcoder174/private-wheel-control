const loginPanel =
    document.getElementById("loginPanel");

const settingsPanel =
    document.getElementById("settingsPanel");

const loginForm =
    document.getElementById("loginForm");

const settingsForm =
    document.getElementById("settingsForm");

const passwordInput =
    document.getElementById("passwordInput");

const namesInput =
    document.getElementById("namesInput");

const winnerField =
    document.getElementById("winnerField");

const winnerSelect =
    document.getElementById("winnerSelect");

const loginMessage =
    document.getElementById("loginMessage");

const settingsMessage =
    document.getElementById("settingsMessage");

const logoutButton =
    document.getElementById("logoutButton");

const TOKEN_STORAGE_KEY = "wheelAdminToken";

function getToken() {
    return sessionStorage.getItem(
        TOKEN_STORAGE_KEY
    );
}

function saveToken(token) {
    sessionStorage.setItem(
        TOKEN_STORAGE_KEY,
        token
    );
}

function removeToken() {
    sessionStorage.removeItem(
        TOKEN_STORAGE_KEY
    );
}

function getAuthorizationHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
    };
}

function showLogin() {
    loginPanel.classList.remove("hidden");
    settingsPanel.classList.add("hidden");
}

function showSettings() {
    loginPanel.classList.add("hidden");
    settingsPanel.classList.remove("hidden");
}

function getNamesFromTextarea() {
    return namesInput.value
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean);
}

function getSelectedMode() {
    const selectedRadio =
        document.querySelector(
            'input[name="wheelMode"]:checked'
        );

    return selectedRadio
        ? selectedRadio.value
        : "random";
}

function updateWinnerOptions(
    preferredWinner = null
) {
    const names = getNamesFromTextarea();
    const previousValue =
        preferredWinner || winnerSelect.value;

    winnerSelect.innerHTML = "";

    names.forEach((name) => {
        const option =
            document.createElement("option");

        option.value = name;
        option.textContent = name;

        winnerSelect.appendChild(option);
    });

    if (names.includes(previousValue)) {
        winnerSelect.value = previousValue;
    }
}

function updateModeDisplay() {
    const mode = getSelectedMode();

    winnerField.classList.toggle(
        "hidden",
        mode !== "controlled"
    );

    winnerSelect.required =
        mode === "controlled";
}

async function loadSettings() {
    const response = await fetch(
        "/api/admin/settings",
        {
            headers: getAuthorizationHeaders()
        }
    );

    if (response.status === 401) {
        removeToken();
        showLogin();
        return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(
            data.message || "Could not load settings."
        );
    }

    namesInput.value =
        data.state.names.join("\n");

    const modeRadio =
        document.querySelector(
            `input[name="wheelMode"][value="${data.state.mode}"]`
        );

    if (modeRadio) {
        modeRadio.checked = true;
    }

    updateWinnerOptions(
        data.state.selectedWinner
    );

    updateModeDisplay();
    showSettings();
}

loginForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        loginMessage.textContent =
            "Logging in...";

        try {
            const response = await fetch(
                "/api/admin/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        password: passwordInput.value
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Login failed."
                );
            }

            saveToken(data.token);

            passwordInput.value = "";
            loginMessage.textContent = "";

            await loadSettings();
        } catch (error) {
            loginMessage.textContent =
                error.message;
        }
    }
);

settingsForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const names = getNamesFromTextarea();
        const mode = getSelectedMode();

        settingsMessage.textContent =
            "Saving...";

        try {
            const response = await fetch(
                "/api/admin/settings",
                {
                    method: "PUT",
                    headers:
                        getAuthorizationHeaders(),
                    body: JSON.stringify({
                        names,
                        mode,
                        selectedWinner:
                            mode === "controlled"
                                ? winnerSelect.value
                                : null
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Could not save settings."
                );
            }

            settingsMessage.textContent =
                "Settings saved successfully.";
        } catch (error) {
            settingsMessage.textContent =
                error.message;
        }
    }
);

namesInput.addEventListener(
    "input",
    () => {
        updateWinnerOptions();
    }
);

document
    .querySelectorAll(
        'input[name="wheelMode"]'
    )
    .forEach((radio) => {
        radio.addEventListener(
            "change",
            updateModeDisplay
        );
    });

logoutButton.addEventListener(
    "click",
    async () => {
        try {
            await fetch("/api/admin/logout", {
                method: "POST",
                headers: getAuthorizationHeaders()
            });
        } catch (error) {
            console.error(error);
        }

        removeToken();
        showLogin();
    }
);

async function initializeAdmin() {
    if (!getToken()) {
        showLogin();
        return;
    }

    try {
        await loadSettings();
    } catch (error) {
        console.error(error);

        removeToken();
        showLogin();

        loginMessage.textContent =
            "Your session expired. Please log in again.";
    }
}

initializeAdmin();