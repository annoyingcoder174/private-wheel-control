const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "change-this-password";

const DATA_DIRECTORY = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIRECTORY, "state.json");
const PUBLIC_DIRECTORY = path.join(__dirname, "public");

const activeSessions = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIRECTORY));

function createDefaultState() {
    return {
        names: [
            "Alice",
            "Bob",
            "Charlie",
            "David",
            "Emma"
        ],
        mode: "random",
        selectedWinner: null
    };
}

function ensureStateFileExists() {
    if (!fs.existsSync(DATA_DIRECTORY)) {
        fs.mkdirSync(DATA_DIRECTORY, {
            recursive: true
        });
    }

    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(createDefaultState(), null, 2),
            "utf8"
        );
    }
}

function readState() {
    ensureStateFileExists();

    try {
        const rawData = fs.readFileSync(STATE_FILE, "utf8");
        const parsedState = JSON.parse(rawData);

        return {
            names: Array.isArray(parsedState.names)
                ? parsedState.names
                : [],
            mode:
                parsedState.mode === "controlled"
                    ? "controlled"
                    : "random",
            selectedWinner:
                typeof parsedState.selectedWinner === "string"
                    ? parsedState.selectedWinner
                    : null
        };
    } catch (error) {
        console.error("Could not read state:", error);

        const defaultState = createDefaultState();
        writeState(defaultState);

        return defaultState;
    }
}

function writeState(state) {
    ensureStateFileExists();

    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify(state, null, 2),
        "utf8"
    );
}

function sanitizeNames(inputNames) {
    if (!Array.isArray(inputNames)) {
        return [];
    }

    const cleanedNames = inputNames
        .map((name) =>
            typeof name === "string" ? name.trim() : ""
        )
        .filter(Boolean)
        .slice(0, 100);

    return [...new Set(cleanedNames)];
}

function createSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

function getSessionToken(request) {
    const authorizationHeader =
        request.headers.authorization;

    if (
        !authorizationHeader ||
        !authorizationHeader.startsWith("Bearer ")
    ) {
        return null;
    }

    return authorizationHeader.slice(7);
}

function requireAdmin(request, response, next) {
    const token = getSessionToken(request);

    if (!token || !activeSessions.has(token)) {
        return response.status(401).json({
            success: false,
            message: "Unauthorized."
        });
    }

    next();
}

app.get("/admin", (request, response) => {
    response.sendFile(
        path.join(PUBLIC_DIRECTORY, "admin.html")
    );
});

app.post("/api/admin/login", (request, response) => {
    const { password } = request.body;

    if (
        typeof password !== "string" ||
        password !== ADMIN_PASSWORD
    ) {
        return response.status(401).json({
            success: false,
            message: "Incorrect password."
        });
    }

    const token = createSessionToken();

    activeSessions.set(token, {
        createdAt: Date.now()
    });

    response.json({
        success: true,
        token
    });
});

app.post(
    "/api/admin/logout",
    requireAdmin,
    (request, response) => {
        const token = getSessionToken(request);

        activeSessions.delete(token);

        response.json({
            success: true
        });
    }
);

app.get(
    "/api/admin/settings",
    requireAdmin,
    (request, response) => {
        response.json({
            success: true,
            state: readState()
        });
    }
);

app.put(
    "/api/admin/settings",
    requireAdmin,
    (request, response) => {
        const names = sanitizeNames(request.body.names);

        if (names.length < 2) {
            return response.status(400).json({
                success: false,
                message: "Please provide at least two names."
            });
        }

        const mode =
            request.body.mode === "controlled"
                ? "controlled"
                : "random";

        let selectedWinner = null;

        if (mode === "controlled") {
            if (
                typeof request.body.selectedWinner !== "string" ||
                !names.includes(request.body.selectedWinner)
            ) {
                return response.status(400).json({
                    success: false,
                    message:
                        "Please select a valid winner for controlled mode."
                });
            }

            selectedWinner = request.body.selectedWinner;
        }

        const nextState = {
            names,
            mode,
            selectedWinner
        };

        writeState(nextState);

        response.json({
            success: true,
            message: "Settings saved.",
            state: nextState
        });
    }
);

app.get("/api/wheel", (request, response) => {
    const state = readState();

    response.json({
        names: state.names,
        mode: state.mode
    });
});

app.post("/api/wheel/spin", (request, response) => {
    const state = readState();

    if (state.names.length < 2) {
        return response.status(400).json({
            success: false,
            message: "The wheel needs at least two names."
        });
    }

    let winner;

    if (
        state.mode === "controlled" &&
        state.selectedWinner &&
        state.names.includes(state.selectedWinner)
    ) {
        winner = state.selectedWinner;
    } else {
        const randomIndex = crypto.randomInt(
            0,
            state.names.length
        );

        winner = state.names[randomIndex];
    }

    response.json({
        success: true,
        winner,
        mode: state.mode
    });
});

app.use((error, request, response, next) => {
    console.error(error);

    response.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

ensureStateFileExists();

app.listen(PORT, () => {
    console.log(
        `Wheel: http://localhost:${PORT}`
    );

    console.log(
        `Admin: http://localhost:${PORT}/admin`
    );
});