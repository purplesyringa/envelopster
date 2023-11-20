let animationFrameInterval = null;
let frameOnStartPlaying = 0;
let timeOnStartPlaying = null;
let currentFrame = 0;
let totalDuration = 0;
let isMouseDown = false;
let gl;
let program;
let variables = {blue: {frames: {0: 0, 30: 1}, min: 0, max: 1}};
let currentVariable = "blue";
const vertex = `
	attribute vec2 pos;
	varying vec2 coordVar;

	void main() {
		coordVar = (pos + 1.) / 2.;
		gl_Position = vec4(pos, 0., 1.);
	}
`;
let envelopeFrames = [];
let envelopeLines = [];
let audio = null;

function play() {
	if(animationFrameInterval) {
		document.querySelector("#play_button").innerHTML = "play";
		cancelAnimationFrame(animationFrameInterval);
		animationFrameInterval = null;
		if(audio) {
			audio.pause();
		}
	} else {
		document.querySelector("#play_button").innerHTML = "stop";
		frameOnStartPlaying = currentFrame;
		timeOnStartPlaying = Date.now();
		initShaders();
		if(audio) {
			audio.currentTime = currentFrame / 30;
			audio.play();
			audio.onplaying = () => {
				audio.onplaying = null;
				animationFrameInterval = requestAnimationFrame(showNextFrame);
			};
		} else {
			animationFrameInterval = requestAnimationFrame(showNextFrame);
		}
	}
}

function showNextFrame() {
	currentFrame = frameOnStartPlaying + Math.floor((Date.now() - timeOnStartPlaying) / (1000 / 30));
	if(currentFrame >= totalDuration) {
		currentFrame = totalDuration;
		updateFrame();
		play();
		return;
	}
	updateFrame();
	animationFrameInterval = requestAnimationFrame(showNextFrame);
}

function ffStart() {
	currentFrame = 0;
	updateFrame();
}
function prevFrame() {
	if(currentFrame > 0) {
		currentFrame--;
	}
	updateFrame();
}
function nextFrame() {
	if(currentFrame < totalDuration) {
		currentFrame++;
	}
	updateFrame();
}

function updateTotalDuration() {
	let [mins, secs] = (document.querySelector("#total_duration").value || "0:00").split(":");
	totalDuration = (parseInt(mins) * 60 + parseInt(secs)) * 30;

	for(const node of document.querySelectorAll(".bottom-second")) {
		node.parentNode.removeChild(node);
	}

	for(let sec = 1; sec <= parseInt(mins) * 60 + parseInt(secs); sec++) {
		const node = document.createElement("div");
		node.className = "bottom-second";
		node.innerHTML = `
			<div class="bottom-second-timestamp">${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}</div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
			<div class="bottom-frame"></div>
		`;
		document.querySelector("#bottom").appendChild(node);
	}

	document.querySelector("#wave").width = totalDuration * 12;
	document.querySelector("#wave").style.width = (totalDuration * 12) + "px";

	updateVariable();
}
function updatePosition() {
	let [mins, secs, frame] = document.querySelector("#position").value.split(/[:.]/);
	totalPosition = (parseInt(mins) * 60 + parseInt(secs)) * 30 + parseInt(frame);
}

function updateFrame(scrollIntoView) {
	document.querySelector("#bottom_now").style.left = (currentFrame * 12 - 8 - 1) + "px";
	if(scrollIntoView !== false) {
		document.querySelector("#bottom_now").scrollIntoView();
	}
	const frame = currentFrame % 30;
	let secs = Math.floor(currentFrame / 30);
	const mins = Math.floor(secs / 60);
	secs = (secs % 60).toString().padStart(2, "0");
	document.querySelector("#position").value = `${mins}:${secs}.${frame}`;

	if(currentVariable === "") {
		document.querySelector("#cur_value").value = "";
	} else {
		document.querySelector("#cur_value").value = getVariableValue(currentVariable);
	}

	if(program) {
		for(const variableName of Object.keys(variables)) {
			gl.uniform1f(gl.getUniformLocation(program, variableName), getVariableValue(variableName));
		}
		gl.uniform1f(gl.getUniformLocation(program, "t"), currentFrame / 30);
		gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
	}
}

function onMouseDownBottom(e) {
	if(e.clientY - e.currentTarget.getBoundingClientRect().top <= 32) {
		isMouseDown = true;
		onMouseMoveBottom(e);
		document.addEventListener("mouseup", onMouseUpBottom);
	}
}
function onMouseMoveBottom(e) {
	if(isMouseDown) {
		currentFrame = Math.round((e.clientX + e.currentTarget.scrollLeft) / 12);
		updateFrame();
	}
}
function onMouseUpBottom() {
	isMouseDown = false;
	document.removeEventListener("mouseup", onMouseUpBottom);
}

function getFrameX(frame) {
	return frame.frame * 12 - 6;
}
function getFrameY(frame) {
	const bottom = document.querySelector("#bottom");
	return (1 - variables[currentVariable].frames[frame.frame]) * (bottom.scrollHeight - 13);
}
function initEnvelopeLine(line) {
	const dx = line.x2 - line.x1;
	const dy = line.y2 - line.y1;
	line.node.style.left = line.x1 + "px";
	line.node.style.top = line.y1 + "px";
	line.node.style.width = Math.sqrt(dx ** 2 + dy ** 2) + "px";
	line.node.style.transform = `rotate(${Math.atan2(dy, dx) / Math.PI * 180}deg)`;
};

function updateVariable() {
	updateFrame();

	const bottom = document.querySelector("#bottom");

	for(const node of document.querySelectorAll(".bottom-dot, .bottom-line")) {
		node.parentNode.removeChild(node);
	}

	if(!variables[currentVariable]) {
		document.querySelector("#min_value").value = "";
		document.querySelector("#max_value").value = "";
		return;
	}

	document.querySelector("#min_value").value = variables[currentVariable].min;
	document.querySelector("#max_value").value = variables[currentVariable].max;

	envelopeFrames = Object.keys(variables[currentVariable].frames)
		.map(frame => parseInt(frame))
		.sort((a, b) => a - b)
		.map(frame => {
			return {frame};
		});

	if(envelopeFrames.length === 0) {
		envelopeLines = [];
		return;
	}

	envelopeLines = [
		{
			x1: getFrameX({frame: 0}) + 6,
			y1: getFrameY(envelopeFrames[0]) + 6,
			x2: getFrameX(envelopeFrames[0]) + 6,
			y2: getFrameY(envelopeFrames[0]) + 6
		}
	];
	for(const frame of envelopeFrames.slice(1)) {
		envelopeLines.push({
			x1: envelopeLines.slice(-1)[0].x2,
			y1: envelopeLines.slice(-1)[0].y2,
			x2: getFrameX(frame) + 6,
			y2: getFrameY(frame) + 6
		});
	}
	envelopeLines.push({
		x1: envelopeLines.slice(-1)[0].x2,
		y1: envelopeLines.slice(-1)[0].y2,
		x2: totalDuration * 12,
		y2: envelopeLines.slice(-1)[0].y2
	});

	for(const line of envelopeLines) {
		const node = document.createElement("div");
		node.className = "bottom-line";
		bottom.appendChild(node);
		line.node = node;
		initEnvelopeLine(line);
	}

	for(const frame of envelopeFrames) {
		createEnvelopeFrameNode(frame);
	}
}

function createEnvelopeFrameNode(frame) {
	const bottom = document.querySelector("#bottom");
	const rect = bottom.getBoundingClientRect();

	const node = document.createElement("div");
	node.className = "bottom-dot";
	node.style.left = getFrameX(frame) + "px";
	node.style.top = getFrameY(frame) + "px";
	node.ondblclick = e => {
		e.stopPropagation();
		delete variables[currentVariable].frames[frame.frame];

		// Remove node
		node.parentNode.removeChild(node);

		// Join lines
		const i = envelopeFrames.indexOf(frame);
		envelopeFrames.splice(i, 1);
		envelopeLines[i].node.parentNode.removeChild(envelopeLines[i].node);
		const oldLine = envelopeLines[i];
		envelopeLines.splice(i, 1);
		envelopeLines[i].x1 = oldLine.x1;
		envelopeLines[i].y1 = oldLine.y1;
		initEnvelopeLine(envelopeLines[i]);

		if(envelopeLines.length === 1) {
			envelopeLines[0].node.parentNode.removeChild(node);
			envelopeLines.splice(0, 1);
		} else {
			// Fix horizontal first & last envelopeLines
			envelopeLines[0].y1 = envelopeLines[0].y2;
			initEnvelopeLine(envelopeLines[0]);
			envelopeLines.slice(-1)[0].y2 = envelopeLines.slice(-1)[0].y1;
			initEnvelopeLine(envelopeLines.slice(-1)[0]);
		}

		requestAnimationFrame(() => updateFrame(false));
	};
	node.onmousedown = e => {
		e.stopPropagation();

		node.classList.add("dragging");

		const offsetX = e.clientX;
		const offsetY = e.clientY - e.currentTarget.getBoundingClientRect().top;

		const startFrame = frame.frame;

		function onMouseMove(e) {
			const i = envelopeFrames.indexOf(frame);
			const leftLimit = i === 0 ? 0 : envelopeFrames[i - 1].frame + 1;
			const rightLimit = i === envelopeFrames.length - 1 ? totalDuration - 1 : envelopeFrames[i + 1].frame - 1;

			// Modify X value
			const oldFrame = frame.frame;
			let newFrame = Math.floor((e.clientX + bottom.scrollLeft - offsetX) / 12) + startFrame;
			if(!(leftLimit <= newFrame && newFrame <= rightLimit)) {
				newFrame = oldFrame;
			}
			frame.frame = newFrame;
			node.style.left = getFrameX(frame) + "px";
			envelopeLines[i].x2 = getFrameX(frame) + 6;
			envelopeLines[i + 1].x1 = getFrameX(frame) + 6;

			// Modify Y value
			const value = Math.max(Math.min(1 - (e.clientY - rect.top - offsetY) / (bottom.scrollHeight - 13), 1), 0);
			delete variables[currentVariable].frames[oldFrame];
			variables[currentVariable].frames[newFrame] = value;
			node.style.top = getFrameY(frame) + "px";

			// Fix lines
			envelopeLines[i].y2 = getFrameY(frame) + 6;
			envelopeLines[i + 1].y1 = getFrameY(frame) + 6;
			initEnvelopeLine(envelopeLines[i]);
			initEnvelopeLine(envelopeLines[i + 1]);

			// Fix horizontal first & last envelopeLines
			envelopeLines[0].y1 = envelopeLines[0].y2;
			initEnvelopeLine(envelopeLines[0]);
			envelopeLines.slice(-1)[0].y2 = envelopeLines.slice(-1)[0].y1;
			initEnvelopeLine(envelopeLines.slice(-1)[0]);
		}
		function onMouseUp() {
			updateFrame(false);
			node.classList.remove("dragging");
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		}

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	};
	bottom.appendChild(node);
	frame.node = node;
}

function onDoubleClickBottom(e) {
	const rect = e.currentTarget.getBoundingClientRect();
	const height = e.currentTarget.scrollHeight;

	const varContent = variables[currentVariable];

	const frame = Math.round((e.clientX + e.currentTarget.parentNode.scrollLeft) / 12);
	const value = 1 - (e.clientY - rect.top - 6) / (height - 13);
	if(value > 1) {
		return;
	}
	if(varContent) {
		varContent.frames[frame] = value;
		const idx = envelopeFrames.findIndex(f => f.frame === frame);
		if(idx > -1) {
			// Rerender frame
			const obj = envelopeFrames[idx];
			obj.node.style.top = getFrameY(obj) + "px";
			// Rerender lines
			envelopeLines[idx].y2 = getFrameY(obj) + 6;
			if(idx === 0) {
				envelopeLines[idx].y1 = envelopeLines[idx].y2;
			}
			envelopeLines[idx + 1].y1 = getFrameY(obj) + 6;
			if(idx + 1 === envelopeLines.length - 1) {
				envelopeLines[idx + 1].y2 = envelopeLines[idx + 1].y1;
			}
			initEnvelopeLine(envelopeLines[idx]);
			initEnvelopeLine(envelopeLines[idx + 1]);
		} else {
			const obj = {frame};
			envelopeFrames.push(obj);
			envelopeFrames.sort((a, b) => a.frame - b.frame);
			createEnvelopeFrameNode(obj);

			// Find an old line (if any)
			let leftLine = envelopeLines[envelopeFrames.indexOf(obj)];
			if(!leftLine) {
				// It's the first node
				const node = document.createElement("div");
				node.className = "bottom-line";
				document.querySelector("#bottom").appendChild(node);
				leftLine = {node};
				envelopeLines.push(leftLine);
			}

			leftLine.x2 = getFrameX(obj) + 6;
			leftLine.y2 = getFrameY(obj) + 6;
			if(leftLine.x1 === undefined) {
				leftLine.x1 = 0;
				leftLine.y1 = leftLine.y2;
			}

			// Create right line
			const node = document.createElement("div");
			node.className = "bottom-line";
			document.querySelector("#bottom").appendChild(node);
			const rightLine = {node};
			envelopeLines.push(rightLine);

			rightLine.x1 = leftLine.x2;
			rightLine.y1 = leftLine.y2;

			// Sort lines
			envelopeLines.sort((a, b) => a.x1 === b.x1 ? a.x2 - b.x2 : a.x1 - b.x1);

			const idx = envelopeLines.indexOf(rightLine);
			if(idx === envelopeLines.length - 1) {
				rightLine.x2 = totalDuration * 12;
				rightLine.y2 = rightLine.y1;
			} else {
				rightLine.x2 = envelopeLines[idx + 1].x1;
				rightLine.y2 = envelopeLines[idx + 1].y1;
			}

			// Init lines
			initEnvelopeLine(leftLine);
			initEnvelopeLine(rightLine);
		}
	}

	requestAnimationFrame(() => updateFrame(false));
}

function updateVariableName() {
	const newName = document.querySelector("#variable_name").value;
	if(currentVariable === "" && newName !== "") {
		variables[newName] = variables[""] || {frames: {}, min: 0, max: 1};
		currentVariable = newName;
		updateVariable();
	} else if(currentVariable !== "") {
		variables[newName] = variables[currentVariable];
		if(currentVariable !== newName) {
			delete variables[currentVariable];
		}
	}
	currentVariable = newName;
}

function updateMinMax() {
	if(currentVariable === "") {
		document.querySelector("#min_value").value = "";
		document.querySelector("#max_value").value = "";
	} else {
		variables[currentVariable].min = parseFloat(document.querySelector("#min_value").value);
		variables[currentVariable].max = parseFloat(document.querySelector("#max_value").value);
	}
	updateVariable();
}

function updateCurrentValue() {
	const varContent = variables[currentVariable];
	const value = parseFloat(document.querySelector("#cur_value").value);
	const normalizedValue = (value - varContent.min) / (varContent.max - varContent.min);
	if(varContent) {
		varContent.frames[currentFrame] = normalizedValue;
		updateVariable();
	}
}

function prevVariable() {
	delete variables[""]; // just in case

	const names = Object.keys(variables);
	const idx = names.indexOf(currentVariable);
	if(idx === -1) {
		currentVariable = names.slice(-1)[0];
		document.querySelector("#variable_name").value = currentVariable;
		updateVariable();
	} else if(idx > 0) {
		currentVariable = names[idx - 1];
		document.querySelector("#variable_name").value = currentVariable;
		updateVariable();
	}
}

function nextVariable() {
	delete variables[""]; // just in case

	const names = Object.keys(variables);
	const idx = names.indexOf(currentVariable);
	if(idx === -1) {
		return;
	} else if(idx < names.length - 1) {
		currentVariable = names[idx + 1];
		document.querySelector("#variable_name").value = currentVariable;
		updateVariable();
	} else if(idx === names.length - 1) {
		currentVariable = "";
		document.querySelector("#variable_name").value = "";
		updateVariable();
	}
}

function getVariableValue(name) {
	const varContent = variables[name];
	const frames = Object.keys(varContent.frames).map(f => parseInt(f)).sort((a, b) => a - b);
	let normalizedValue;
	if(frames.length === 0) {
		normalizedValue = 0;
	} else if(currentFrame <= frames[0]) {
		normalizedValue = varContent.frames[frames[0]];
	} else if(currentFrame >= frames.slice(-1)[0]) {
		normalizedValue = varContent.frames[frames.slice(-1)[0]];
	} else {
		let i = 0;
		while(i < frames.length && frames[i] < currentFrame) {
			i++;
		}
		const bx = frames[i - 1];
		const by = varContent.frames[bx];
		const dx = frames[i] - frames[i - 1];
		const dy = varContent.frames[bx + dx] - varContent.frames[bx];
		normalizedValue = by + dy / dx * (currentFrame - bx);
	}
	return normalizedValue * (varContent.max - varContent.min) + varContent.min;
}

function uploadWave() {
	const input = document.createElement("input");
	input.type = "file";
	input.style.position = "fixed";
	input.style.left = "-100000px";
	input.style.top = "0";
	input.onchange = () => {
		const file = input.files[0];
		if(file) {
			const url = URL.createObjectURL(file);

			const wave = document.querySelector("#wave");
			wave.width = wave.width; // clean

			document.querySelector("#wave_status").innerHTML = "Uploading...";

			if(audio) {
				audio.pause();
			}
			audio = new Audio();
			audio.src = url;

			audio.oncanplaythrough = () => {
				document.querySelector("#wave_status").innerHTML = "Loading...";

				const fr = new FileReader();
				fr.onload = async () => {
					document.querySelector("#wave_status").innerHTML = "Parsing...";

					const rate = 48000;
					const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, rate * audio.duration, rate);
					const buf = (await new Promise(resolve => audioCtx.decodeAudioData(fr.result, resolve))).getChannelData(0);
					const levels = [];
					for(let pos = 0; pos < totalDuration * 12; pos++) {
						const offsetFrom = Math.floor(pos / 12 / 30 * rate);
						const offsetTo = Math.floor((pos + 1) / 12 / 30 * rate);
						const total = Array.from(buf.slice(offsetFrom, offsetTo)).map(n => n ** 2).reduce((a, b) => a + b, 0);
						levels.push(Math.sqrt(total / (offsetTo - offsetFrom)));
					}

					const maxLevel = levels.reduce((a, b) => Math.max(a, b), 0) * 1.1;

					// When the audio loaded to memory, redraw wave on canvas
					wave.width = wave.width; // clean
					const ctx = wave.getContext("2d");
					ctx.strokeStyle = "#ffffff";
					for(let i = 0; i < levels.length; i++) {
						ctx.beginPath();
						const height = Math.max(levels[i] / maxLevel * wave.height, 1);
						ctx.moveTo(i + 0.5, (wave.height - height) / 2);
						ctx.lineTo(i + 0.5, (wave.height + height) / 2);
						ctx.stroke();
					}

					document.querySelector("#wave_status").innerHTML = "";
				};
				fr.readAsArrayBuffer(file);
			};
		}
	};
	document.body.appendChild(input);
	input.click();
}

function doExport() {
	prompt("Save the text below:", JSON.stringify({
		totalDuration,
		variables,
		fragment: document.querySelector("#code").value
	}));
}
function doImport() {
	const data = JSON.parse(prompt("Paste saved text:"));
	totalDuration = data.totalDuration;
	document.querySelector("#total_duration").value = `${Math.floor(totalDuration / 30 / 60)}:${(totalDuration / 30 % 60).toString().padStart(2, "0")}`;
	let [mins, secs] = (document.querySelector("#total_duration").value || "0:00").split(":");
	variables = data.variables;
	currentVariable = Object.keys(variables)[0] || "";
	document.querySelector("#variable_name").value = currentVariable;
	document.querySelector("#code").value = data.fragment;
	currentFrame = 0;
	initShaders();
	updateTotalDuration();
	updateFrame();
	updateVariable();
}



const canvas = document.querySelector("#canvas");

window.onresize = () => {
	setViewport();
	updateVariable();
};

function setViewport() {
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width;
	canvas.height = rect.height;
	gl.viewport(0, 0, rect.width, rect.height);
}

function createShader(code, type) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, code);
	gl.compileShader(shader);
	return shader;
}

function initShaders() {
	program = gl.createProgram();

	const vertexShader = createShader(vertex, gl.VERTEX_SHADER);
	gl.attachShader(program, vertexShader);

	const fragmentShader = createShader(document.querySelector("#code").value, gl.FRAGMENT_SHADER);
	gl.attachShader(program, fragmentShader);

	gl.linkProgram(program);
	gl.useProgram(program);

	const vertexPosAttrib = gl.getAttribLocation(program, "pos");
	gl.enableVertexAttribArray(vertexPosAttrib);
	gl.vertexAttribPointer(vertexPosAttrib, 2, gl.FLOAT, false, 0, 0);
}

function initGl() {
	gl = canvas.getContext("experimental-webgl");
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	setViewport();
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
}

initGl();
updateTotalDuration();
initShaders();
updateFrame();
updateVariableName();