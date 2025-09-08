let musicData = [];
let abcContents = [];
let synthControls = [];

// Function to get transpose value from URL parameter
function getTranspose() {
  const urlParams = new URLSearchParams(window.location.search);
  const tParam = urlParams.get("t");
  return tParam ? parseInt(tParam, 10) : 0;
}

// Function to get voices value from URL parameter
function getVoices() {
  const urlParams = new URLSearchParams(window.location.search);
  const vParam = urlParams.get("v");
  return vParam ? vParam.toUpperCase() : "SATB";
}

// Function to filter ABC content by voices
function filterABCByVoices(abcContent, voices) {
  const lines = abcContent.split('\n');
  const filteredLines = [];
  let skipNextLine = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip this line if marked from previous iteration
    if (skipNextLine) {
      skipNextLine = false;
      continue;
    }
    
    // Filter %%staves line
    if (line.startsWith('%%staves')) {
      const stavesMatch = line.match(/%%staves\s*\[(.*?)\]/);
      if (stavesMatch) {
        const stavesContent = stavesMatch[1];
        const groups = stavesContent.split(') (');
        const filteredGroups = [];
        
        groups.forEach(group => {
          const cleanGroup = group.replace(/[\(\)]/g, '');
          const voicesInGroup = cleanGroup.split(' ').filter(v => v.trim());
          const filteredVoicesInGroup = voicesInGroup.filter(voice => 
            voices.includes(voice.trim())
          );
          
          if (filteredVoicesInGroup.length > 0) {
            filteredGroups.push(`(${filteredVoicesInGroup.join(' ')})`);
          }
        });
        
        if (filteredGroups.length > 0) {
          filteredLines.push(`%%staves [${filteredGroups.join(' ')}]`);
        }
      } else {
        filteredLines.push(line);
      }
    }
    // Filter voice lines (V:S, V:A, etc.)
    else if (line.match(/^V:[SATB]/)) {
      const voiceMatch = line.match(/^V:([SATB])/);
      if (voiceMatch && voices.includes(voiceMatch[1])) {
        filteredLines.push(line);
        // Include the next line (the actual music content for this voice)
        if (i + 1 < lines.length) {
          filteredLines.push(lines[i + 1]);
          i++; // Skip the next line in the main loop since we already processed it
        }
      } else {
        // Skip this voice line and the next line (music content)
        skipNextLine = true;
      }
    }
    // Keep all other lines
    else {
      filteredLines.push(line);
    }
  }
  
  return filteredLines.join('\n');
}

// Function to update transpose display
function updateTransposeDisplay() {
  const display = document.getElementById("transpose-display");
  if (display) {
    const currentTranspose = getTranspose();
    display.textContent = currentTranspose > 0 ? `+${currentTranspose}` : currentTranspose.toString();
  }
}

// Function to update voices display
function updateVoicesDisplay() {
  const currentVoices = getVoices();
  ['S', 'A', 'T', 'B'].forEach(voice => {
    const button = document.getElementById(`voice-${voice}`);
    if (button) {
      if (currentVoices.includes(voice)) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  });
}

// Function to update URL voices parameter
function updateVoices(newVoices) {
  const url = new URL(window.location);
  if (newVoices === "SATB") {
    url.searchParams.delete("v");
  } else {
    url.searchParams.set("v", newVoices);
  }
  window.history.replaceState({}, "", url);
  updateVoicesDisplay();
  rerenderAllABC();
}

// Function to toggle voice
function toggleVoice(voice) {
  const currentVoices = getVoices();
  let newVoices;
  
  if (currentVoices.includes(voice)) {
    newVoices = currentVoices.replace(voice, '');
  } else {
    newVoices = currentVoices + voice;
  }
  
  // Sort voices in SATB order
  const sortedVoices = ['S', 'A', 'T', 'B'].filter(v => newVoices.includes(v)).join('');
  updateVoices(sortedVoices || 'SATB');
}

// Function to update URL parameter and rerender
function updateTranspose(newValue) {
  const url = new URL(window.location);
  if (newValue === 0) {
    url.searchParams.delete("t");
  } else {
    url.searchParams.set("t", newValue);
  }
  window.history.replaceState({}, "", url);
  updateTransposeDisplay();
  rerenderAllABC();
}

// Function to transpose up
function transposeUp() {
  const currentTranspose = getTranspose();
  updateTranspose(currentTranspose + 1);
}

// Function to transpose down
function transposeDown() {
  const currentTranspose = getTranspose();
  updateTranspose(currentTranspose - 1);
}

// Function to create header link
function createHeaderLink(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Function to fetch file content
async function fetchFile(path) {
  const response = await fetch(path);
  return await response.text();
}

// Function to process text content
function processTextContent(text) {
  // Handle word breaks by adding word joiners
  text = text.replace(/(\S)([\|·])(\S)/g, "$1\u2060$2\u2060$3");

  // Convert markdown-style **text** to HTML <strong> tags
  text = text.replace(/\*\*(?!\s)([^\*]+)(?<!\s)\*\*/g, "<strong>$1</strong>");

  // Convert markdown-style *text* to HTML <em> tags
  text = text.replace(/\*(?!\s)([^\*]+)(?<!\s)\*/g, "<em>$1</em>");

  return text;
}

// Function to render ABC notation
function renderABC(elementId, abcString, transpose = 0, voices = "SATB") {
  const element = document.getElementById(elementId);
  const filteredAbc = filterABCByVoices(abcString, voices);
  const visualObj = ABCJS.renderAbc(elementId, filteredAbc, {
    staffwidth: document.getElementById("content").offsetWidth,
    visualTranspose: transpose,
  })[0];

  // Find the SVG and make it scale properly
  const svg = element.querySelector("svg");
  if (svg) {
    const box = svg.getBBox();
    const padding = 0; // Add some padding for "zoom out" effect
    svg.setAttribute(
      "viewBox",
      `${box.x} ${box.y} ${box.x + box.width + padding} ${box.y + box.height}`,
    );
    svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
    svg.setAttribute("width", document.getElementById("content").offsetWidth);
    svg.setAttribute("height", box.height);
    element.style.height = `${box.height}px`;
  }

  return visualObj;
}

// Function to rerender all ABC notations
function rerenderAllABC() {
  let transpose = getTranspose();
  let voices = getVoices();
  const updatePromises = [];
  
  musicData.forEach((item, i) => {
    if (item.type === "psalm" && abcContents[i]) {
      const visualObj = renderABC(`abc${i}`, abcContents[i], transpose, voices);
      updatePromises.push(
        createAudioPlayer(visualObj, `audio${i}`, transpose).then((synthControl) => {
          synthControls[i] = synthControl;
        })
      );
    }
  });
  
  Promise.all(updatePromises);
}

// Function to create audio player
async function createAudioPlayer(visualObj, containerId, transpose = 0) {
  const synthControl = new ABCJS.synth.SynthController();
  synthControl.load(`#${containerId}`, null, {
    displayPlay: true,
    displayProgress: true,
  });

  const createSynth = new ABCJS.synth.CreateSynth();
  await createSynth.init({ visualObj });
  await synthControl.setTune(visualObj, false, {
    chordsOff: true,
    midiTranspose: transpose,
  });

  return synthControl;
}

// Function to create and populate sections
async function createSections() {
  const contentDiv = document.getElementById("content");
  const tocDiv = document.getElementById("toc");

  // Load playlist data
  const playlistResponse = await fetch("./playlist.json");
  musicData = await playlistResponse.json();

  const fetchPromises = [];

  let transpose = getTranspose();
  let voices = getVoices();

  for (let i = 0; i < musicData.length; i++) {
    const item = musicData[i];

    if (item.type === "heading") {
      if (item.title) {
        // Create heading
        const headingElement = document.createElement(`h${item.level || 2}`);
        const headingId = createHeaderLink(item.title);
        headingElement.innerHTML = `${processTextContent(item.title)}<a href="#${headingId}" class="header-link">#</a>`;
        headingElement.id = headingId;
        contentDiv.appendChild(headingElement);

        // Add to table of contents
        const tocHeading = document.createElement("a");
        tocHeading.href = `#${headingId}`;
        tocHeading.innerHTML = processTextContent(item.title);
        tocHeading.style.fontWeight = "bold";
        tocDiv.appendChild(tocHeading);
      }

      if (item.text) {
        const textDiv = document.createElement("div");
        textDiv.innerHTML = processTextContent(item.text);
        contentDiv.appendChild(textDiv);
      }
    } else if (item.type === "psalm") {
      const section = document.createElement("div");
      section.className = "music-section";

      // Create and add title if it exists
      if (item.title) {
        const title = document.createElement("h3");
        title.className = "section-title";
        const titleId = createHeaderLink(item.title);
        title.innerHTML = `${processTextContent(item.title)}<a href="#${titleId}" class="header-link">#</a>`;
        title.id = titleId;
        section.appendChild(title);

        // Add to table of contents
        const tocLink = document.createElement("a");
        tocLink.href = `#${titleId}`;
        tocLink.innerHTML = processTextContent(item.title);
        tocDiv.appendChild(tocLink);
      }

      // Create and add subtitle if it exists
      if (item.subtitle) {
        const subtitle = document.createElement("h4");
        subtitle.className = "section-subtitle";
        subtitle.innerHTML = processTextContent(item.subtitle);
        section.appendChild(subtitle);
      }

      // Create notation container
      const notationContainer = document.createElement("div");
      notationContainer.className = "notation-container";
      const abcElement = document.createElement("div");
      abcElement.className = "abc-element";
      abcElement.id = `abc${i}`;
      notationContainer.appendChild(abcElement);
      section.appendChild(notationContainer);

      // Create audio container
      const audioContainer = document.createElement("div");
      audioContainer.className = "audio-container";
      audioContainer.id = `audio${i}`;
      section.appendChild(audioContainer);

      // Create text container
      const textContainer = document.createElement("div");
      textContainer.className = "section-text";
      section.appendChild(textContainer);

      contentDiv.appendChild(section);

      // Add fetch promises to array
      fetchPromises.push(
        fetchFile(`./abc/${item.tune}`).then(async (abcContent) => {
          abcContents[i] = abcContent;
          const visualObj = renderABC(`abc${i}`, abcContent, transpose, voices);
          synthControls[i] = await createAudioPlayer(
            visualObj,
            `audio${i}`,
            transpose,
          );
        }),
      );

      fetchPromises.push(
        fetchFile(`./text/${item.text}`).then((textContent) => {
          textContainer.innerHTML = processTextContent(textContent);
        }),
      );
    }
  }

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);

  // Handle hash navigation after everything is loaded
  if (window.location.hash) {
    const id = window.location.hash.substring(1);
    const element = document.getElementById(id);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView();
      }, 100);
    }
  }
}

// Initialize the page
createSections().then(() => {
  updateTransposeDisplay();
  updateVoicesDisplay();
});

// Add window resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(rerenderAllABC, 250);
});
