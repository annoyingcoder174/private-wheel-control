const canvas = document.getElementById("wheelCanvas");
const context = canvas.getContext("2d");

const spinButton = document.getElementById("spinButton");
const resultText = document.getElementById("resultText");
const modeBadge = document.getElementById("modeBadge");

const colors = [
    "#6d5dfc",
    "#ff6b6b",
    "#20c997",
    "#f7b731",
    "#45aaf2",
    "#a55eea",
    "#fd9644",
    "#26de81",
    "#eb3b5a",
    "#4b7bec"
];

let names = [];
let wheelMode = "random";
let currentRotation = 0;
let isSpinning = false;

function escapeDisplayName(name) {
    const maximumLength = 20;

    if (name.length <= maximumLength) {
        return name;
    }

    return `${name.slice(0, maximumLength - 3)}...`;
}

function getFontSize() {
    if (names.length >= 20) {
        return 15;
    }

    if (names.length >= 12) {
        return 18;
    }

    if (names.length >= 8) {
        return 21;
    }

    return 25;
}

function drawEmptyWheel(message) {
    const center = canvas.width / 2;

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.beginPath();

    context.arc(
        center,
        center,
        center - 10,
        0,
        Math.PI * 2
    );

    context.fillStyle = "#25263a";
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = "bold 25px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillText(message, center, center);
}

function drawWheel() {
    if (names.length === 0) {
        drawEmptyWheel("No names available");
        return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 12;

    const segmentAngle =
        (Math.PI * 2) / names.length;

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    names.forEach((name, index) => {
        const startAngle =
            index * segmentAngle;

        const endAngle =
            startAngle + segmentAngle;

        const middleAngle =
            startAngle + segmentAngle / 2;

        context.beginPath();
        context.moveTo(centerX, centerY);

        context.arc(
            centerX,
            centerY,
            radius,
            startAngle,
            endAngle
        );

        context.closePath();

        context.fillStyle =
            colors[index % colors.length];

        context.fill();

        context.strokeStyle = "#ffffff";
        context.lineWidth = 3;
        context.stroke();

        context.save();

        context.translate(centerX, centerY);
        context.rotate(middleAngle);

        context.fillStyle = "#ffffff";
        context.font =
            `700 ${getFontSize()}px Arial`;

        context.textAlign = "right";
        context.textBaseline = "middle";

        context.shadowColor =
            "rgba(0, 0, 0, 0.35)";

        context.shadowBlur = 4;

        context.fillText(
            escapeDisplayName(name),
            radius - 38,
            0
        );

        context.restore();
    });
}

async function loadWheel() {
    spinButton.disabled = true;

    try {
        const response = await fetch("/api/wheel");

        if (!response.ok) {
            throw new Error(
                "Could not load the wheel."
            );
        }

        const data = await response.json();

        names = Array.isArray(data.names)
            ? data.names
            : [];

        wheelMode = data.mode;

        modeBadge.classList.toggle(
            "hidden",
            wheelMode !== "controlled"
        );

        drawWheel();

        resultText.textContent =
            names.length >= 2
                ? "The wheel is ready."
                : "Add at least two names in the admin page.";

        spinButton.disabled = names.length < 2;
    } catch (error) {
        console.error(error);

        drawEmptyWheel("Connection error");

        resultText.textContent =
            "Could not connect to the server.";
    }
}

function getWinnerIndex(winnerName) {
    return names.findIndex(
        (name) => name === winnerName
    );
}

function calculateFinalRotation(winnerIndex) {
    const segmentSize = 360 / names.length;

    const selectedSegmentCenter =
        winnerIndex * segmentSize +
        segmentSize / 2;

    /*
      The pointer is located at the top.
  
      Canvas segments begin at the right side, so 270 degrees
      represents the top position.
    */
    const targetPosition =
        270 - selectedSegmentCenter;

    const normalizedCurrent =
        ((currentRotation % 360) + 360) % 360;

    const normalizedTarget =
        ((targetPosition % 360) + 360) % 360;

    let remainingRotation =
        normalizedTarget - normalizedCurrent;

    if (remainingRotation < 0) {
        remainingRotation += 360;
    }

    const fullRotations =
        6 + Math.floor(Math.random() * 3);

    return (
        currentRotation +
        fullRotations * 360 +
        remainingRotation
    );
}

async function requestWinner() {
    const response = await fetch(
        "/api/wheel/spin",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(
            data.message || "Could not spin the wheel."
        );
    }

    return data;
}

async function spinWheel() {
    if (isSpinning || names.length < 2) {
        return;
    }

    isSpinning = true;
    spinButton.disabled = true;

    resultText.textContent = "Selecting result...";

    try {
        /*
          Reload before each spin so changes made from
          the separate admin page are applied immediately.
        */
        const wheelResponse =
            await fetch("/api/wheel");

        if (!wheelResponse.ok) {
            throw new Error(
                "Could not update the wheel."
            );
        }

        const latestWheel =
            await wheelResponse.json();

        names = latestWheel.names;
        wheelMode = latestWheel.mode;

        modeBadge.classList.toggle(
            "hidden",
            wheelMode !== "controlled"
        );

        drawWheel();

        const spinResult = await requestWinner();

        const winnerIndex =
            getWinnerIndex(spinResult.winner);

        if (winnerIndex === -1) {
            throw new Error(
                "The selected winner is not on the wheel."
            );
        }

        const finalRotation =
            calculateFinalRotation(winnerIndex);

        currentRotation = finalRotation;

        canvas.style.transform =
            `rotate(${currentRotation}deg)`;

        resultText.textContent = "Spinning...";

        window.setTimeout(() => {
            resultText.textContent =
                `Winner: ${spinResult.winner}`;

            isSpinning = false;
            spinButton.disabled = false;
        }, 5200);
    } catch (error) {
        console.error(error);

        resultText.textContent =
            error.message || "Something went wrong.";

        isSpinning = false;
        spinButton.disabled = false;
    }
}

spinButton.addEventListener("click", spinWheel);

loadWheel();