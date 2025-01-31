let musicData = [];
let abcContents = [];
let synthControls = [];

// Function to create header link
function createHeaderLink(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Function to fetch file content
async function fetchFile(path) {
  const response = await fetch(path);
  return await response.text();
}

// Function to render ABC notation
function renderABC(elementId, abcString) {
  const element = document.getElementById(elementId);
  const visualObj = ABCJS.renderAbc(elementId, abcString, {
    staffwidth: document.getElementById("content").offsetWidth,
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
  musicData.forEach((item, i) => {
    if (item.type === "psalm" && abcContents[i]) {
      renderABC(`abc${i}`, abcContents[i]);
    }
  });
}

// Function to create audio player
async function createAudioPlayer(visualObj, containerId) {
  const synthControl = new ABCJS.synth.SynthController();
  synthControl.load(`#${containerId}`, null, {
    displayPlay: true,
    displayProgress: true,
  });

  const createSynth = new ABCJS.synth.CreateSynth();
  await createSynth.init({ visualObj });
  await synthControl.setTune(visualObj, false);

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

  for (let i = 0; i < musicData.length; i++) {
    const item = musicData[i];

    if (item.type === "heading") {
      if (item.title) {
        // Create heading
        const headingElement = document.createElement(`h${item.level || 2}`);
        const headingId = createHeaderLink(item.title);
        headingElement.innerHTML = `${item.title}<a href="#${headingId}" class="header-link">#</a>`;
        headingElement.id = headingId;
        contentDiv.appendChild(headingElement);

        // Add to table of contents
        const tocHeading = document.createElement("a");
        tocHeading.href = `#${headingId}`;
        tocHeading.textContent = item.title;
        tocHeading.style.fontWeight = "bold";
        tocDiv.appendChild(tocHeading);
      }

      if (item.text) {
        const textDiv = document.createElement("div");
        textDiv.textContent = item.text;
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
        title.innerHTML = `${item.title}<a href="#${titleId}" class="header-link">#</a>`;
        title.id = titleId;
        section.appendChild(title);

        // Add to table of contents
        const tocLink = document.createElement("a");
        tocLink.href = `#${titleId}`;
        tocLink.textContent = item.title;
        tocDiv.appendChild(tocLink);
      }

      // Create and add subtitle if it exists
      if (item.subtitle) {
        const subtitle = document.createElement("h4");
        subtitle.className = "section-subtitle";
        subtitle.textContent = item.subtitle;
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
          const visualObj = renderABC(`abc${i}`, abcContent);
          synthControls[i] = await createAudioPlayer(visualObj, `audio${i}`);
        }),
      );

      fetchPromises.push(
        fetchFile(`./text/${item.text}`).then((textContent) => {
          // Add word joiners around split markers to prevent line breaks across words
          textContent = textContent.replace(
            /(\S)([\|·])(\S)/g,
            "$1\u2060$2\u2060$3",
          );
          textContainer.textContent = textContent;
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
createSections();

// Add window resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(rerenderAllABC, 250);
});
