let pMapper;
let shapes = [];
let activeShapeIndex = 0;
let blink = false;
let showCode = true;
let showMediaList = false;
let sourceAllocations = { s0: null, s1: null, s2: null, s3: null, s4: null, s5: null, s6: null, s7: null };
let nextSourceIndex = 0;

class HydraShape {
    constructor(pMapper, existingSurface = null) {
        this.hydraCode = "osc().out()";
        this.cursorPos = this.hydraCode.length;
        this.hc = document.createElement("canvas");
        this.hc.width = 800; this.hc.height = 800;
        this.hc.style.display = "none";
        document.body.appendChild(this.hc);

        this.hydra = new Hydra({
            makeGlobal: false,
            canvas: this.hc,
            detectAudio: false,
            precision: "highp"
        });

        this.pg = createGraphics(400, 400);
        this.pg.textAlign(CENTER, CENTER);
        this.pg.textSize(24);
        this.pg.textFont("monospace");

        if (existingSurface) {
            this.polyMap = existingSurface;
        } else {
            this.polyMap = pMapper.createPolyMap(6);
        }

        this.runCode();
    }

    runCode() {
        try {
            const keys = Object.keys(this.hydra.synth);
            const funcStr = `
                const { ${keys.join(', ')} } = this.hydra.synth;
                const images = window.images;
                const videos = window.videos;
                ${this.hydraCode};
            `;
            eval(funcStr);
        } catch (e) {
            console.error("Hydra eval error:", e);
        }
    }

    draw() {
        this.pg.clear();
        this.pg.drawingContext.drawImage(this.hydra.canvas, 0, 0, this.pg.width, this.pg.height);
        this.polyMap.displayTexture(this.pg);
    }
}

function applyMapData(mapData, hydraCodes) {
    shapes.forEach(shape => {
        if (shape.hc && shape.hc.parentNode) shape.hc.parentNode.removeChild(shape.hc);
    });
    shapes = [];

    // Reset pMapper surfaces and lines
    pMapper.surfaces = [];

    // Dynamically recreate the exact surface types encoded in the map JSON
    if (mapData && mapData.surfaces) {
        mapData.surfaces.forEach(s => {
            if (s.type === "POLY") pMapper.createPolyMap(s.points ? s.points.length : 4);
            else if (s.type === "TRI") pMapper.createTriMap(300, 300);
            else if (s.type === "QUAD") pMapper.createQuadMap(300, 300);
            else if (s.type === "BEZ") pMapper.createBezierMap();
        });
    }

    // Wrap the newly created pMapper surfaces inside our HydraShapes
    for (let i = 0; i < pMapper.surfaces.length; i++) {
        let shape = new HydraShape(pMapper, pMapper.surfaces[i]);
        shape.hydraCode = hydraCodes ? (hydraCodes[i] || "osc(40, 0.1, 1.2).out()") : "osc(40, 0.1, 1.2).out()";
        shape.cursorPos = shape.hydraCode.length;
        shape.runCode();
        shapes.push(shape);
    }

    // Fallback if map was totally empty
    if (shapes.length === 0) shapes.push(new HydraShape(pMapper));
    activeShapeIndex = min(activeShapeIndex, max(0, shapes.length - 1));

    // Finally, tell pMapper to lock in the saved pin coordinates
    if (mapData) {
        let blob = new Blob([JSON.stringify(mapData)], { type: "application/json" });
        pMapper.load(URL.createObjectURL(blob));
    }
}

function setup() {
    createCanvas(windowWidth, windowHeight, WEBGL);

    // create mapper object
    pMapper = createProjectionMapper(this);

    setInterval(() => blink = !blink, 500);

    // Try loading initial maps if they exist
    loadJSON("maps/map.json", (mapData) => {
        loadJSON("assets/hydra.json", (hydraData) => {
            applyMapData(mapData, Object.values(hydraData));
        }, (err) => {
            applyMapData(mapData, null);
        });
    }, (err) => {
        applyMapData(null, null);
    });

    // Setup Shape Menu bindings
    let cancelBtn = document.getElementById("cancelShapeBtn");
    let createBtn = document.getElementById("createShapeBtn");
    if (cancelBtn) cancelBtn.onclick = () => document.getElementById("shapeMenu").style.display = "none";
    if (createBtn) createBtn.onclick = () => createCustomShape();
}

function createCustomShape() {
    let menu = document.getElementById("shapeMenu");
    menu.style.display = "none";

    let type = document.getElementById("shapeType").value;

    if (type === "POLY") {
        let pts = parseInt(document.getElementById("polyPoints").value) || 6;
        pMapper.createPolyMap(pts);
    } else if (type === "TRI") {
        pMapper.createTriMap(300, 300);
    } else if (type === "QUAD") {
        pMapper.createQuadMap(300, 300);
    } else if (type === "BEZ") {
        pMapper.createBezierMap();
    }

    if (pMapper.surfaces.length > 0) {
        let newSurface = pMapper.surfaces[pMapper.surfaces.length - 1];
        let shape = new HydraShape(pMapper, newSurface);
        shapes.push(shape);
        activeShapeIndex = shapes.length - 1;
        showCode = true;
    }
}

function saveMappingState() {
    pMapper.save("maps/map.json");
    let codes = shapes.map(s => s.hydraCode);
    saveJSON(codes, "assets/hydra.json");
}

function loadMappingState() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = true;
    input.onchange = e => {
        let files = e.target.files;
        if (files.length === 0) return;

        let mapData = null;
        let hydraCodes = null;
        let filesRead = 0;

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            let reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    let data = JSON.parse(evt.target.result);
                    if (data.surfaces) {
                        mapData = data;
                    } else if (Array.isArray(data) || typeof data === 'object') {
                        hydraCodes = Object.values(data);
                    }
                } catch (err) {
                    console.error("Error parsing submitted JSON", err);
                }

                filesRead++;
                if (filesRead === files.length) {
                    if (mapData) {
                        applyMapData(mapData, hydraCodes);
                    } else if (hydraCodes) {
                        // Apply ONLY Hydra codes to existing shapes
                        for (let j = 0; j < Math.min(shapes.length, hydraCodes.length); j++) {
                            shapes[j].hydraCode = hydraCodes[j] || "osc(40, 0.1, 1.2).out()";
                            shapes[j].cursorPos = shapes[j].hydraCode.length;
                            shapes[j].runCode();
                        }
                    }
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function draw() {
    background(0);

    let codeHTML = "";

    for (let i = 0; i < shapes.length; i++) {
        let shape = shapes[i];
        let isActive = (i === activeShapeIndex);
        shape.draw();

        if (showCode) {
            // Calculate screen coordinates from WebGL origin
            let screenX = shape.polyMap.x + windowWidth / 2;
            let screenY = shape.polyMap.y + windowHeight / 2;

            shape.cursorPos = min(max(0, shape.cursorPos || 0), shape.hydraCode.length);

            // Build the cursor span with opacity based on blink state
            let cursorOpacity = (isActive && blink) ? 1 : 0;
            let cursorSpan = `<span style="opacity: ${isActive ? cursorOpacity : 0}; margin-left: -1px; margin-right: -1px;">|</span>`;

            // Encode the string for HTML nicely, replacing newlines with <br>
            let startText = shape.hydraCode.substring(0, shape.cursorPos).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
            let endText = shape.hydraCode.substring(shape.cursorPos).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
            let displayText = startText + cursorSpan + endText;

            let bgColor = isActive ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.8)";
            let textColor = isActive ? "rgb(200, 255, 200)" : "rgb(150, 150, 150)";
            let zIndex = isActive ? 10 : 5;

            codeHTML += `
                <div style="
                    position: absolute; 
                    left: ${screenX}px; 
                    top: ${screenY}px; 
                    transform: translate(-50%, -50%); /* Center the text around the map origin */
                    background-color: ${bgColor};
                    color: ${textColor};
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 16px;
                    z-index: ${zIndex};
                    white-space: pre-wrap; /* Preserve spaces and wraps */
                    text-align: center;
                ">${displayText}</div>
            `;
        }
    }

    let codeLayer = document.getElementById("codeLayer");
    if (codeLayer) codeLayer.innerHTML = codeHTML;

    let hud = document.getElementById("mediaHud");
    if (hud) {
        if (showMediaList) {
            hud.style.display = "block";
            let html = "<strong>Loaded Media:</strong><br><br>";
            for (let i = 0; i < 8; i++) {
                let slot = 's' + i;
                let filename = sourceAllocations[slot] || "Empty";
                html += `${slot}: ${filename}<br>`;
            }
            hud.innerHTML = html;
        } else {
            hud.style.display = "none";
        }
    }

    handleContinuousKeys();
}

let keyRepeatDelay = 30; // frames before repeat starts
let keyRepeatRate = 3;   // frames between repeats
let keyHoldFrames = {};

function handleContinuousKeys() {
    let menu = document.getElementById("shapeMenu");
    if (menu && menu.style.display === "block") return;

    let welcome = document.getElementById("welcomeMenu");
    if (welcome && welcome.style.display !== "none") return;

    let shape = shapes.length > 0 ? shapes[activeShapeIndex] : null;
    if (!shape) return;

    const continuousKeys = [LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW, BACKSPACE];

    continuousKeys.forEach(code => {
        if (keyIsDown(code)) {
            if (!keyHoldFrames[code]) keyHoldFrames[code] = 0;

            let frames = keyHoldFrames[code];
            // Fire immediately on frame 0, then wait for delay, then fire every rate frames
            if (frames === 0 || (frames > keyRepeatDelay && frames % keyRepeatRate === 0)) {
                executeContinuousAction(code, shape);
            }
            keyHoldFrames[code]++;
        } else {
            keyHoldFrames[code] = 0;
        }
    });
}

function executeContinuousAction(code, shape) {
    if (shape.cursorPos === undefined) shape.cursorPos = shape.hydraCode.length;

    if (code === LEFT_ARROW) {
        shape.cursorPos = max(0, shape.cursorPos - 1);
    } else if (code === RIGHT_ARROW) {
        shape.cursorPos = min(shape.hydraCode.length, shape.cursorPos + 1);
    } else if (code === UP_ARROW) {
        let text = shape.hydraCode;
        let pos = shape.cursorPos;
        let lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        let col = pos - lineStart;

        if (lineStart > 0) {
            let prevLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;
            let prevLineLength = (lineStart - 1) - prevLineStart;
            shape.cursorPos = prevLineStart + min(col, prevLineLength);
        } else {
            shape.cursorPos = 0;
        }
    } else if (code === DOWN_ARROW) {
        let text = shape.hydraCode;
        let pos = shape.cursorPos;
        let lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        let lineEnd = text.indexOf('\n', pos);
        if (lineEnd === -1) lineEnd = text.length;
        let col = pos - lineStart;

        if (lineEnd < text.length) {
            let nextLineStart = lineEnd + 1;
            let nextLineEnd = text.indexOf('\n', nextLineStart);
            if (nextLineEnd === -1) nextLineEnd = text.length;
            let nextLineLength = nextLineEnd - nextLineStart;
            shape.cursorPos = nextLineStart + min(col, nextLineLength);
        } else {
            shape.cursorPos = text.length;
        }
    } else if (code === BACKSPACE) {
        if (shape.cursorPos > 0) {
            shape.hydraCode = shape.hydraCode.substring(0, shape.cursorPos - 1) + shape.hydraCode.substring(shape.cursorPos);
            shape.cursorPos--;
        }
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function keyTyped() {
    let menu = document.getElementById("shapeMenu");
    if (menu && menu.style.display === "block") return;

    let welcome = document.getElementById("welcomeMenu");
    if (welcome && welcome.style.display !== "none") return;

    if (!keyIsDown(CONTROL) && !keyIsDown(ALT)) {
        if (shapes.length > 0) {
            let shape = shapes[activeShapeIndex];
            if (shape.cursorPos === undefined) shape.cursorPos = shape.hydraCode.length;

            shape.hydraCode = shape.hydraCode.substring(0, shape.cursorPos) + key + shape.hydraCode.substring(shape.cursorPos);
            shape.cursorPos += key.length;
        }
    }
}

function keyPressed() {
    let menu = document.getElementById("shapeMenu");
    if (menu && menu.style.display === "block") return;

    let welcome = document.getElementById("welcomeMenu");
    if (welcome && welcome.style.display !== "none") return;

    let shape = shapes.length > 0 ? shapes[activeShapeIndex] : null;
    if (shape && shape.cursorPos === undefined) shape.cursorPos = shape.hydraCode.length;

    // Enter character
    if (keyCode === ENTER || keyCode === RETURN) {
        if (shape) {
            shape.hydraCode = shape.hydraCode.substring(0, shape.cursorPos) + '\n' + shape.hydraCode.substring(shape.cursorPos);
            shape.cursorPos++;
        }
        return false;
    }

    // Delete handling (remove shape)
    if (keyCode === DELETE || keyCode === 46) {
        if (shape) {

            // Remove the hidden canvas from DOM
            if (shape.hc && shape.hc.parentNode) {
                shape.hc.parentNode.removeChild(shape.hc);
            }

            // Remove from pMapper surfaces so its control points aren't drawn
            let surfIndex = pMapper.surfaces.indexOf(shape.polyMap);
            if (surfIndex !== -1) {
                pMapper.surfaces.splice(surfIndex, 1);
            }

            shapes.splice(activeShapeIndex, 1);
            if (activeShapeIndex >= shapes.length) {
                activeShapeIndex = max(0, shapes.length - 1);
            }
        }
        return false;
    }

    // Tab handling
    if (keyCode === TAB) {
        if (shapes.length > 0) {
            activeShapeIndex = (activeShapeIndex + 1) % shapes.length;
        }
        return false;
    }

    if (keyIsDown(CONTROL) && !keyIsDown(SHIFT)) {
        switch (key.toLowerCase()) {
            case "c":
                pMapper.toggleCalibration();
                return false;
            case "f":
                let fs = fullscreen();
                fullscreen(!fs);
                return false;
            case "l":
                loadMappingState();
                return false;
            case "m":
                saveMappingState();
                return false;
        }
    }

    if (keyIsDown(CONTROL) && keyIsDown(SHIFT)) {
        switch (key.toLowerCase()) {
            case "e":
                if (shapes.length > 0) {
                    shapes[activeShapeIndex].runCode();
                }
                break;
            case "s":
                showCode = !showCode;
                break;
            case "m":
                let menu = document.getElementById("shapeMenu");
                if (menu) {
                    menu.style.display = menu.style.display === "block" ? "none" : "block";
                }
                return false;
            case "k":
                document.getElementById('fileInput').click();
                return false;
            case "i":
                showMediaList = !showMediaList;
                return false;
        }
    }
}

function mousePressed() {
    // Check if the user clicked on any shape to select it for live coding
    for (let i = shapes.length - 1; i >= 0; i--) {
        if (shapes[i].polyMap.isMouseOver()) {
            activeShapeIndex = i;
            showCode = true;
            break;
        }
    }
}

// Store dom elements for videos so we can pipe them to hydra initVideo
const videoElements = {};

function loadMediaToHydra(fileType, dataUrl, filename) {
    if (shapes.length === 0) return;

    let shape = shapes[activeShapeIndex];
    let sourceSlot = 's' + nextSourceIndex;
    sourceAllocations[sourceSlot] = filename;
    nextSourceIndex = (nextSourceIndex + 1) % 8;

    try {
        if (fileType === 'image') {
            shape.hydra.synth[sourceSlot].initImage(dataUrl);
        } else if (fileType === 'video') {
            // Provide a DOM video element for Hydra to use
            if (!videoElements[filename]) {
                let vid = document.createElement("video");
                vid.autoplay = true;
                vid.loop = true;
                vid.muted = true;
                vid.style.display = "none";
                document.body.appendChild(vid);
                videoElements[filename] = vid;
            }
            videoElements[filename].src = dataUrl;
            videoElements[filename].play();
            shape.hydra.synth[sourceSlot].init({ src: videoElements[filename], dynamic: true });
        }
    } catch (e) {
        console.error("Hydra init source error:", e);
    }
}
