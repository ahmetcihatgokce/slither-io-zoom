(() => {
    "use strict";

    // Let the wheel move in either direction far beyond the old canvas limits,
    // while keeping the scale finite and away from zero in the game renderer.
    const maxLogZoom = Math.log(512);
    const wheelSensitivity = Math.log(1.12) / 120;
    let logZoom = 0;
    let currentPlayer = null;
    let nativeScale;
    let renderScale;
    let zoomedRedraw;

    // This runs before Slither's classic script initializes the global.
    // Network handlers and input continue to read and write the native scale.
    if (Object.getOwnPropertyDescriptor(window, "gsc")?.configurable === false) {
        return;
    }
    Object.defineProperty(window, "gsc", {
        configurable: true,
        enumerable: true,
        get() {
            return renderScale ?? nativeScale;
        },
        set(value) {
            if (renderScale === undefined) {
                nativeScale = value;
            }
        }
    });

    function activePlayer() {
        return window.playing && !window.choosing_skin ? window.slither : null;
    }

    function syncPlayer(player) {
        if (player !== currentPlayer) {
            currentPlayer = player;
            logZoom = 0;
        }
    }

    function wrapRedraw() {
        const originalRedraw = window.redraw;
        if (originalRedraw === zoomedRedraw) {
            return;
        }

        zoomedRedraw = function (...args) {
            syncPlayer(activePlayer());
            if (logZoom === 0) {
                return originalRedraw.apply(this, args);
            }

            // The game's own zoom easing runs inside redraw and writes to gsc.
            // Hold the selected scale throughout that draw, including culling.
            renderScale = nativeScale * Math.exp(logZoom);
            try {
                return originalRedraw.apply(this, args);
            } finally {
                renderScale = undefined;
            }
        };
        window.redraw = zoomedRedraw;
    }

    document.addEventListener("wheel", (event) => {
        const player = activePlayer();
        syncPlayer(player);
        if (!player || event.ctrlKey || typeof window.redraw !== "function" ||
            !Number.isFinite(nativeScale) || nativeScale <= 0) {
            return;
        }

        const delta = event.wheelDelta || -event.deltaY *
            (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 120 : 1);
        if (!Number.isFinite(delta) || delta === 0) {
            return;
        }

        // Preserve 1.0.1's wheel direction: up zooms out, down zooms in.
        const step = Math.max(-200, Math.min(200, delta)) * wheelSensitivity;
        logZoom = Math.max(-maxLogZoom, Math.min(maxLogZoom, logZoom - step));
        wrapRedraw();
        event.preventDefault();
    }, { passive: false });

    document.addEventListener("keydown", (event) => {
        if (event.key === "0" && !event.ctrlKey && !event.altKey && !event.metaKey &&
            !event.target?.closest?.("input, textarea, [contenteditable]") && activePlayer()) {
            logZoom = 0;
        }
    });
})();
