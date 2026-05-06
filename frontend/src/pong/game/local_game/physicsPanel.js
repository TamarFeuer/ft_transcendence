export function createPhysicsPanel(physics, defaultPhysics, sliderConfigs, makeValueFormatter, highImpactKeys, highImpactHints, arenaMeshes) {
    const gameContainer = document.getElementById("gameContainer") || document.getElementById("app-root");
    if (!gameContainer) return null;

    const panel = document.createElement("div");
    panel.id = "localPhysicsPanel";
    panel.style.position = "absolute";
    panel.style.left = "16px";
    panel.style.bottom = "16px";
    panel.style.zIndex = "35";
    panel.style.width = "320px";
    panel.style.maxHeight = "65vh";
    panel.style.overflowY = "auto";
    panel.style.padding = "12px";
    panel.style.border = "1px solid rgba(56, 189, 248, 0.5)";
    panel.style.borderRadius = "12px";
    panel.style.background = "rgba(2, 6, 23, 0.8)";
    panel.style.backdropFilter = "blur(6px)";
    panel.style.pointerEvents = "auto";
    panel.style.color = "#e2e8f0";
    panel.style.fontFamily = "monospace";
    panel.style.fontSize = "12px";
    panel.style.userSelect = "none";

    const title = document.createElement("div");
    title.textContent = "Local Physics";
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    title.style.letterSpacing = "0.04em";
    panel.appendChild(title);

    const focusHint = document.createElement("div");
    focusHint.textContent = "Highlighted rows strongly affect side-spin and high arcs";
    focusHint.style.fontSize = "11px";
    focusHint.style.color = "#fde68a";
    focusHint.style.marginBottom = "8px";
    panel.appendChild(focusHint);

    const dragBar = document.createElement("div");
    dragBar.textContent = "Drag";
    dragBar.style.cursor = "move";
    dragBar.style.marginBottom = "10px";
    dragBar.style.padding = "6px 8px";
    dragBar.style.background = "rgba(30, 41, 59, 0.9)";
    dragBar.style.border = "1px solid rgba(148, 163, 184, 0.45)";
    dragBar.style.borderRadius = "8px";
    dragBar.style.textAlign = "center";
    panel.appendChild(dragBar);

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const onDragMove = (event) => {
        if (!isDragging) return;
        panel.style.left = `${Math.max(0, event.clientX - dragOffsetX)}px`;
        panel.style.top = `${Math.max(0, event.clientY - dragOffsetY)}px`;
        panel.style.bottom = "auto";
    };

    const onDragUp = () => {
        isDragging = false;
    };

    dragBar.addEventListener("pointerdown", (event) => {
        const rect = panel.getBoundingClientRect();
        isDragging = true;
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        dragBar.setPointerCapture(event.pointerId);
    });

    dragBar.addEventListener("pointermove", onDragMove);
    dragBar.addEventListener("pointerup", onDragUp);
    dragBar.addEventListener("pointercancel", onDragUp);

    sliderConfigs.forEach((config) => {
        const row = document.createElement("div");
        row.style.marginBottom = "8px";
        const isHighImpact = highImpactKeys.has(config.key);
        if (isHighImpact) {
            row.style.padding = "6px";
            row.style.borderRadius = "8px";
            row.style.border = "1px solid rgba(251, 191, 36, 0.6)";
            row.style.background = "rgba(120, 53, 15, 0.22)";
        }

        const topLine = document.createElement("div");
        topLine.style.display = "flex";
        topLine.style.justifyContent = "space-between";
        topLine.style.alignItems = "center";

        const label = document.createElement("label");
        label.textContent = isHighImpact ? `${config.label} *` : config.label;
        label.style.color = isHighImpact ? "#fde68a" : "#93c5fd";
        label.style.fontWeight = isHighImpact ? "700" : "400";

        const value = document.createElement("span");
        const format = makeValueFormatter(config.step);
        value.textContent = format(physics[config.key]);

        if (isHighImpact) {
            const hint = document.createElement("div");
            hint.textContent = highImpactHints[config.key] || "High-impact control";
            hint.style.fontSize = "10px";
            hint.style.color = "#fde68a";
            hint.style.opacity = "0.85";
            hint.style.marginBottom = "4px";
            row.appendChild(hint);
        }

        topLine.appendChild(label);
        topLine.appendChild(value);

        const input = document.createElement("input");
        input.type = "range";
        input.min = String(config.min);
        input.max = String(config.max);
        input.step = String(config.step);
        input.value = String(physics[config.key]);
        input.style.width = "100%";

        input.addEventListener("input", () => {
            const parsed = Number(input.value);
            physics[config.key] = parsed;
            value.textContent = format(parsed);

            if (config.key === "netHeight" && arenaMeshes?.net) {
                arenaMeshes.net.scaling.y = parsed;
                arenaMeshes.net.position.y = physics.tableTopY + parsed / 2;
            }
        });

        row.appendChild(topLine);
        row.appendChild(input);
        panel.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Reset Defaults";
    resetBtn.style.padding = "6px 8px";
    resetBtn.style.borderRadius = "6px";
    resetBtn.style.border = "1px solid rgba(34, 197, 94, 0.5)";
    resetBtn.style.background = "rgba(20, 83, 45, 0.8)";
    resetBtn.style.color = "#dcfce7";
    resetBtn.style.cursor = "pointer";

    resetBtn.addEventListener("click", () => {
        sliderConfigs.forEach((config) => {
            physics[config.key] = defaultPhysics[config.key];
        });

        const allInputs = panel.querySelectorAll("input[type='range']");
        allInputs.forEach((element, index) => {
            const cfg = sliderConfigs[index];
            const format = makeValueFormatter(cfg.step);
            element.value = String(defaultPhysics[cfg.key]);
            const valueLabel = element.previousSibling?.lastChild;
            if (valueLabel && valueLabel.nodeType === Node.ELEMENT_NODE) {
                valueLabel.textContent = format(defaultPhysics[cfg.key]);
            }
        });
    });

    actions.appendChild(resetBtn);
    panel.appendChild(actions);

    gameContainer.appendChild(panel);
    return panel;
}
