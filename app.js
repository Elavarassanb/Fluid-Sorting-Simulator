/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                   FLUID SORTING SIMULATOR                          ║
 * ║                         app.js                                     ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                    ║
 * ║  WHAT IS THIS FILE?                                                ║
 * ║  This is the "brain" of the app. It controls everything:           ║
 * ║  • Game logic (conveyor belt movement, picking, dropping)          ║
 * ║  • Score tracking (correct, wrong, missed, etc.)                   ║
 * ║  • Screen switching (menu → game → results)                        ║
 * ║  • Arduino hardware communication (optional)                      ║
 * ║  • Keyboard and touch input handling                               ║
 * ║                                                                    ║
 * ║  HOW THE GAME WORKS:                                               ║
 * ║  1. Player picks a difficulty level (controls conveyor speed)      ║
 * ║  2. 40 shipping labels scroll across a conveyor belt               ║
 * ║  3. Some labels are "relevant" (belong to Node 1-4)               ║
 * ║  4. Some labels are "irrelevant" (node = null, ignore them)       ║
 * ║  5. Player must PICK relevant labels in the pick zone             ║
 * ║  6. Then DROP them into the correct node (1, 2, 3, or 4)         ║
 * ║  7. After all labels pass, a results dashboard shows the score    ║
 * ║                                                                    ║
 * ║  CODE ORGANIZATION (scroll down to find each section):             ║
 * ║  Section 1 — DOM Element References                                ║
 * ║  Section 2 — Arduino Serial Variables                              ║
 * ║  Section 3 — Game State Variables                                  ║
 * ║  Section 4 — Constants (sizes, speeds)                             ║
 * ║  Section 5 — Game Configuration Data (images + levels)             ║
 * ║  Section 6 — Arduino Connection Functions                          ║
 * ║  Section 7 — Screen Management                                     ║
 * ║  Section 8 — Utility Functions                                     ║
 * ║  Section 9 — Conveyor Belt & Animation                             ║
 * ║  Section 10 — Pick & Drop Game Actions                             ║
 * ║  Section 11 — Game Lifecycle (start, end, results)                 ║
 * ║  Section 12 — Event Listeners (clicks, keyboard, Arduino)          ║
 * ║  Section 13 — App Initialization                                   ║
 * ║                                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/*
 * The entire app is wrapped in an IIFE (Immediately Invoked Function Expression).
 * This means: (() => { ... })();
 * 
 * WHY? It creates a private scope so our variables don't leak into the
 * global window object and accidentally conflict with other scripts.
 * Think of it as putting all our code inside a sealed box.
 */
(() => {


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 1: DOM ELEMENT REFERENCES
   * ════════════════════════════════════════════════════════════════════
   *  "DOM" = Document Object Model — the browser's representation of HTML.
   *  
   *  We grab references to HTML elements here so we can read/change them
   *  later in the code. It's like giving each element a nickname.
   *  
   *  document.getElementById('some-id') finds the HTML element with
   *  that id="some-id" attribute and returns it as a JavaScript object.
   * ════════════════════════════════════════════════════════════════════ */

  // The 3 main screens (only one is visible at a time)
  const screenMenu    = document.getElementById('screen-menu');     // Screen 1: Level selection
  const screenGame    = document.getElementById('screen-game');     // Screen 2: Game play
  const screenResults = document.getElementById('screen-results');  // Screen 3: Results dashboard

  // Arduino connection UI elements
  const serialStatusWeb  = document.getElementById('serial-status-web');   // Status badge text
  const btnConnectSerial = document.getElementById('btn-connect-serial');  // Connect/Disconnect button

  // Game screen elements
  const conveyorTrack = document.getElementById('conveyor-track');  // The moving strip that holds labels
  const hudLevel      = document.getElementById('hud-level');       // Shows "Level: Easy" etc.
  const hudProgress   = document.getElementById('hud-progress');    // Shows "5 / 40" progress
  const hudStatus     = document.getElementById('hud-status');      // Shows "WATCHING" or "PICKED"
  const hudTimer      = document.getElementById('hud-timer');       // Shows speed like "⏱ 10s/label"

  // Buttons
  const btnPick    = document.getElementById('btn-pick');     // On-screen PICK button
  const btnRestart = document.getElementById('btn-restart');  // "Play Again" button on results screen


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 2: ARDUINO SERIAL VARIABLES
   * ════════════════════════════════════════════════════════════════════
   *  These variables manage the optional Arduino hardware connection.
   *  The Web Serial API lets the browser talk to USB devices directly.
   *  
   *  If no Arduino is connected, the game still works fine with
   *  keyboard (Space + 1-4) or on-screen touch buttons.
   * ════════════════════════════════════════════════════════════════════ */

  let serialPort      = null;   // The serial port object (USB connection to Arduino)
  let serialReader    = null;   // Reads incoming data from Arduino
  let serialConnected = false;  // true/false — is Arduino currently connected?


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 3: GAME STATE VARIABLES
   * ════════════════════════════════════════════════════════════════════
   *  These variables track everything about the current game session.
   *  They get reset every time a new game starts (see startGame()).
   *  
   *  "let" means the value can change during the game.
   * ════════════════════════════════════════════════════════════════════ */

  let config          = null;       // Game configuration (images list + level speeds) — set below
  let gameImages      = [];         // The 40 label images, shuffled randomly for this round
  let currentIndex    = 0;          // (unused currently) Could track which label is active
  let level           = 1;          // Current difficulty level (1=Easy, 2=Medium, 3=Hard, 4=Expert)
  let speedSec        = 10;         // Seconds each label takes to cross the screen
  let isPicked        = false;      // Is the player currently holding a picked label?
  let pickedLabel     = null;       // Info about the label the player picked (index, image data, element)
  let animationId     = null;       // ID of the running animation frame (used to stop it)
  let conveyorX       = 0;          // Current horizontal position of the conveyor belt (in pixels)
  let lastTimestamp   = 0;          // Timestamp of the last animation frame (for smooth movement)
  let paused          = false;      // Is the conveyor paused? (pauses when player picks a label)
  let gameStartTime   = 0;          // When the game started (milliseconds since 1970)
  let gameEndTime     = 0;          // When the game ended
  let results         = [];         // Array of result objects — one per label processed
  let spilloverChecked = new Set(); // Set of label indexes already checked for spillover
  //                                   (Set = a collection that prevents duplicates)


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 4: CONSTANTS
   * ════════════════════════════════════════════════════════════════════
   *  Fixed values that never change during the game.
   *  "const" means the value is locked — it cannot be reassigned.
   *  
   *  These control the physical dimensions of the conveyor belt system.
   * ════════════════════════════════════════════════════════════════════ */

  const LABEL_WIDTH       = 200;  // Width of each label card (pixels)
  const LABEL_GAP         = 60;   // Gap between labels (pixels)
  const LABEL_TOTAL       = LABEL_WIDTH + LABEL_GAP;  // = 260px total space per label
  const PICK_ZONE_TOLERANCE = 130; // How close (pixels) a label must be to screen center to be "pickable"


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 5: GAME CONFIGURATION DATA
   * ════════════════════════════════════════════════════════════════════
   *  This is the "database" of the game — embedded right in the code
   *  so no server is needed.
   *  
   *  IMAGES ARRAY — Each object represents one shipping label:
   *    • "file"  = the image filename in the images/ folder
   *    • "node"  = which node (1-4) this label belongs to
   *                OR null if it's irrelevant (player should ignore it)
   *  
   *  LEVELS OBJECT — Defines the 4 difficulty levels:
   *    • "name"     = display name
   *    • "speedSec" = seconds per label (lower = faster = harder)
   * ════════════════════════════════════════════════════════════════════ */

  config = {
    "images": [
      // Node 1 labels (7 total) — player should pick these and drop to Node 1
      { "file": "label_01.png", "node": 1 },
      { "file": "label_05.png", "node": 1 },
      { "file": "label_11.png", "node": 1 },
      { "file": "label_17.png", "node": 1 },
      { "file": "label_23.png", "node": 1 },
      { "file": "label_29.png", "node": 1 },
      { "file": "label_39.png", "node": 1 },

      // Node 2 labels (5 total) — player should pick these and drop to Node 2
      { "file": "label_02.png", "node": 2 },
      { "file": "label_06.png", "node": 2 },
      { "file": "label_13.png", "node": 2 },
      { "file": "label_19.png", "node": 2 },
      { "file": "label_25.png", "node": 2 },
      { "file": "label_31.png", "node": 2 },

      // Node 3 labels (5 total) — player should pick these and drop to Node 3
      { "file": "label_03.png", "node": 3 },
      { "file": "label_08.png", "node": 3 },
      { "file": "label_14.png", "node": 3 },
      { "file": "label_20.png", "node": 3 },
      { "file": "label_26.png", "node": 3 },
      { "file": "label_33.png", "node": 3 },

      // Node 4 labels (5 total) — player should pick these and drop to Node 4
      { "file": "label_04.png", "node": 4 },
      { "file": "label_10.png", "node": 4 },
      { "file": "label_16.png", "node": 4 },
      { "file": "label_21.png", "node": 4 },
      { "file": "label_28.png", "node": 4 },
      { "file": "label_35.png", "node": 4 },

      // Irrelevant labels (14 total) — node is null, player should NOT pick these
      { "file": "label_07.png", "node": null },
      { "file": "label_09.png", "node": null },
      { "file": "label_12.png", "node": null },
      { "file": "label_15.png", "node": null },
      { "file": "label_18.png", "node": null },
      { "file": "label_22.png", "node": null },
      { "file": "label_24.png", "node": null },
      { "file": "label_27.png", "node": null },
      { "file": "label_30.png", "node": null },
      { "file": "label_32.png", "node": null },
      { "file": "label_34.png", "node": null },
      { "file": "label_36.png", "node": null },
      { "file": "label_37.png", "node": null },
      { "file": "label_38.png", "node": null },
      { "file": "label_40.png", "node": null }
    ],

    "levels": {
      "1": { "name": "Easy",   "speedSec": 10 },  // 10 seconds per label (slowest)
      "2": { "name": "Medium", "speedSec": 7  },   // 7 seconds per label
      "3": { "name": "Hard",   "speedSec": 5  },   // 5 seconds per label
      "4": { "name": "Expert", "speedSec": 3  }    // 3 seconds per label (fastest)
    }
  };


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 6: ARDUINO CONNECTION FUNCTIONS
   * ════════════════════════════════════════════════════════════════════
   *  These functions handle connecting/disconnecting an Arduino board
   *  via the Web Serial API (a browser feature in Chrome/Edge).
   *  
   *  The Arduino sends simple text commands over USB:
   *    "P"     = Pick button pressed
   *    "1"-"4" = Drop button 1-4 pressed
   *    "READY" = Arduino finished booting
   *  
   *  If you don't have an Arduino, you can skip this entire section.
   *  The game works fine with keyboard/touch controls.
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * connectArduino() — Opens a USB serial connection to the Arduino.
   * 
   * Flow:
   * 1. Check if the browser supports Web Serial API
   * 2. Show a popup asking the user to select their Arduino device
   * 3. Open the connection at 9600 baud rate (standard Arduino speed)
   * 4. Start reading incoming data from the Arduino
   */
  async function connectArduino() {
    // Check if browser supports Web Serial API
    if (!('serial' in navigator)) {
      alert('Web Serial API not supported. Use Chrome/Edge browser with HTTPS or localhost.');
      return;
    }

    try {
      // Show browser's device picker popup — user selects their Arduino
      serialPort = await navigator.serial.requestPort();
      
      // Open the serial connection with standard Arduino settings
      await serialPort.open({ 
        baudRate: 9600,   // Must match Arduino's Serial.begin(9600)
        dataBits: 8,      // Standard: 8 data bits
        stopBits: 1,      // Standard: 1 stop bit
        parity: 'none'    // No parity checking
      });

      console.log('✅ Arduino connected via Web Serial API');
      serialConnected = true;
      updateSerialStatus(true);  // Update the UI badge to show "Connected"

      // Start continuously reading data from Arduino
      startSerialReader();

    } catch (error) {
      console.error('❌ Serial connection failed:', error);
      updateSerialStatus(false, error.message);
    }
  }

  /**
   * startSerialReader() — Continuously reads text data from the Arduino.
   * 
   * The Arduino sends lines of text (e.g., "P\n" or "1\n").
   * This function reads them in a loop and passes each command
   * to handleArduinoCommand().
   */
  async function startSerialReader() {
    if (!serialPort || !serialPort.readable) return;

    // Create a text decoder to convert raw bytes → readable text
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    serialReader = textDecoder.readable.getReader();

    try {
      // Infinite loop — keeps reading until connection is closed
      while (true) {
        const { value, done } = await serialReader.read();
        if (done) break;  // Connection closed

        // Arduino might send multiple lines at once, so split by newline
        const lines = value.split('\n');
        lines.forEach(line => {
          const cmd = line.trim();  // Remove whitespace/newline characters
          if (cmd) {
            console.log('🔘 Arduino:', cmd);
            handleArduinoCommand(cmd);  // Process the command
          }
        });
      }
    } catch (error) {
      console.error('Serial read error:', error);
    } finally {
      serialReader.releaseLock();  // Release the reader when done
    }
  }

  /**
   * handleArduinoCommand(cmd) — Translates Arduino button presses into game actions.
   * 
   * @param {string} cmd — The command string from Arduino:
   *   "P"     → Pick the label in the pick zone
   *   "1"-"4" → Drop the picked label into that node
   *   "READY" → Arduino just booted up (informational only)
   */
  function handleArduinoCommand(cmd) {
    if (cmd === 'P') {
      doPick();                    // Same as pressing Space or the PICK button
    } else if (['1', '2', '3', '4'].includes(cmd)) {
      doDrop(parseInt(cmd));       // Same as pressing keyboard 1-4
    } else if (cmd === 'READY') {
      console.log('🤖 Arduino ready');
    }
  }

  /**
   * disconnectArduino() — Cleanly closes the Arduino connection.
   */
  async function disconnectArduino() {
    if (serialReader) {
      await serialReader.cancel();
      serialReader = null;
    }
    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
    serialConnected = false;
    updateSerialStatus(false);
    console.log('📴 Arduino disconnected');
  }

  /**
   * updateSerialStatus(connected, error) — Updates the connection badge in the UI.
   * 
   * @param {boolean} connected — Is Arduino connected?
   * @param {string|null} error — Error message to display (if any)
   */
  function updateSerialStatus(connected, error = null) {
    if (connected) {
      serialStatusWeb.textContent = '✅ Arduino Connected';
      serialStatusWeb.className = 'status-badge connected';
      btnConnectSerial.textContent = '📴 Disconnect Arduino';
    } else {
      serialStatusWeb.textContent = error ? `❌ Error: ${error}` : '❌ Arduino Not Connected';
      serialStatusWeb.className = 'status-badge disconnected';
      btnConnectSerial.textContent = '🔌 Connect Arduino';
    }
  }


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 7: SCREEN MANAGEMENT
   * ════════════════════════════════════════════════════════════════════
   *  The app has 3 screens. Only one is visible at a time.
   *  Visibility is controlled by adding/removing the "active" CSS class.
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * showScreen(screen) — Hides all screens, then shows the given one.
   * 
   * @param {HTMLElement} screen — The screen element to make visible
   * 
   * Example: showScreen(screenGame) → hides menu & results, shows game
   */
  function showScreen(screen) {
    [screenMenu, screenGame, screenResults].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 8: UTILITY FUNCTIONS
   * ════════════════════════════════════════════════════════════════════
   *  Helper functions used by other parts of the code.
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * shuffle(arr) — Randomly reorders an array (Fisher-Yates algorithm).
   * 
   * Used to randomize the order of labels each game so it's never
   * the same sequence twice.
   * 
   * @param {Array} arr — The array to shuffle
   * @returns {Array} — A new shuffled copy (original is not modified)
   * 
   * Example: shuffle([1,2,3,4]) might return [3,1,4,2]
   */
  function shuffle(arr) {
    const a = [...arr];  // Create a copy so we don't modify the original
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));  // Random index from 0 to i
      [a[i], a[j]] = [a[j], a[i]];  // Swap elements at positions i and j
    }
    return a;
  }


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 9: CONVEYOR BELT & ANIMATION
   * ════════════════════════════════════════════════════════════════════
   *  These functions create the conveyor belt visual and animate it.
   *  
   *  HOW THE CONVEYOR WORKS:
   *  • All 40 label cards are placed side-by-side in a long horizontal strip
   *  • The strip starts off-screen to the right
   *  • Every animation frame, we move the strip a few pixels to the left
   *  • This creates the illusion of labels scrolling across the screen
   *  • The "pick zone" is the center of the screen — labels passing
   *    through this zone can be picked by the player
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * buildConveyor() — Creates the label cards and adds them to the conveyor track.
   * 
   * For each image in gameImages (the shuffled list), it creates:
   *   <div class="conveyor-label" data-index="0">
   *     <img src="images/label_01.png" alt="label_01.png">
   *   </div>
   * 
   * Labels with node=null get an extra "irrelevant" CSS class (makes them dimmer).
   */
  function buildConveyor() {
    conveyorTrack.innerHTML = '';  // Clear any labels from a previous game

    gameImages.forEach((img, idx) => {
      // Create the container div for this label
      const div = document.createElement('div');
      div.className = 'conveyor-label';
      div.dataset.index = idx;  // Store the index so we can look up this label's data later

      // If this label is irrelevant (node is null), dim it slightly
      if (img.node === null) div.classList.add('irrelevant');

      // Create the <img> element showing the shipping label image
      const imgEl = document.createElement('img');
      imgEl.src = `images/${img.file}`;  // e.g., "images/label_01.png"
      imgEl.alt = img.file;
      div.appendChild(imgEl);

      // Add this label card to the conveyor track
      conveyorTrack.appendChild(div);
    });
  }

  /**
   * getLabelInPickZone() — Finds which label (if any) is currently in the pick zone.
   * 
   * The "pick zone" is the center of the conveyor area.
   * We check each label's position and see if its center is close enough
   * to the screen center (within PICK_ZONE_TOLERANCE pixels).
   * 
   * @returns {HTMLElement|null} — The label element in the zone, or null if none
   */
  function getLabelInPickZone() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const centerX = conveyorRect.left + conveyorRect.width / 2;  // Center of the conveyor area

    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    for (const label of labels) {
      const rect = label.getBoundingClientRect();
      const labelCenter = rect.left + rect.width / 2;  // Center of this label

      // If the label's center is close enough to the screen center, it's in the pick zone
      if (Math.abs(labelCenter - centerX) < PICK_ZONE_TOLERANCE) {
        return label;
      }
    }
    return null;  // No label is in the pick zone right now
  }

  /**
   * animate(timestamp) — The main animation loop. Runs ~60 times per second.
   * 
   * This is called by requestAnimationFrame(), which is the browser's way
   * of saying "call this function before the next screen repaint."
   * 
   * Each frame, we:
   * 1. Calculate how much time passed since the last frame (delta)
   * 2. Move the conveyor belt left by (pixels-per-second × delta)
   * 3. Highlight labels in the pick zone
   * 4. Check if any labels were missed (spillover)
   * 5. Check if all labels have passed (end game)
   * 
   * @param {number} timestamp — Milliseconds since the page loaded (provided by browser)
   */
  function animate(timestamp) {
    // Calculate time elapsed since last frame (in seconds)
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000;  // Convert ms to seconds
    lastTimestamp = timestamp;

    // Only move the conveyor if the game isn't paused
    // (Game pauses when player picks a label, waiting for them to drop it)
    if (!paused) {
      // Calculate movement speed: pixels per second = total label width / seconds per label
      const pxPerSec = LABEL_TOTAL / speedSec;

      // Move the conveyor to the left (negative X direction)
      conveyorX -= pxPerSec * delta;

      // Apply the movement using CSS transform (this is what makes it visually move)
      conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;

      // Update which labels are highlighted in the pick zone
      updatePickZoneHighlight();

      // Check if any relevant labels scrolled past without being picked
      checkSpillover();

      // Check if all labels have scrolled off-screen (game over)
      const totalWidth = gameImages.length * LABEL_TOTAL;
      if (Math.abs(conveyorX) > totalWidth + 300) {
        endGame();
        return;  // Stop the animation loop
      }
    }

    // Update the HUD display
    updateHUD();

    // Request the next animation frame (this creates the continuous loop)
    animationId = requestAnimationFrame(animate);
  }

  /**
   * updatePickZoneHighlight() — Adds/removes yellow highlight on labels in the pick zone.
   * 
   * Labels near the center get the "in-pick-zone" CSS class (yellow border + glow).
   * Labels that were already picked or missed don't get highlighted.
   */
  function updatePickZoneHighlight() {
    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const centerX = conveyorRect.left + conveyorRect.width / 2;

    labels.forEach(label => {
      const rect = label.getBoundingClientRect();
      const labelCenter = rect.left + rect.width / 2;

      // Add highlight if: close to center AND not already picked AND not already missed
      if (Math.abs(labelCenter - centerX) < PICK_ZONE_TOLERANCE && 
          !label.classList.contains('picked') && 
          !label.classList.contains('missed')) {
        label.classList.add('in-pick-zone');
      } else {
        label.classList.remove('in-pick-zone');
      }
    });
  }

  /**
   * checkSpillover() — Detects labels that scrolled past the pick zone without being picked.
   * 
   * For each label that has moved far enough to the left:
   * - If it was relevant (node != null) and wasn't picked → "spillover" (missed it!)
   * - If it was irrelevant (node == null) and wasn't picked → "ignored" (correct behavior!)
   * 
   * Uses the spilloverChecked Set to avoid counting the same label twice.
   */
  function checkSpillover() {
    const conveyorRect = document.getElementById('conveyor').getBoundingClientRect();
    const pickZoneRight = conveyorRect.left + conveyorRect.width / 2 + PICK_ZONE_TOLERANCE;

    const labels = conveyorTrack.querySelectorAll('.conveyor-label');
    labels.forEach(label => {
      const idx = parseInt(label.dataset.index);
      const img = gameImages[idx];
      const rect = label.getBoundingClientRect();

      // If the label's right edge has passed well beyond the pick zone...
      if (rect.right < pickZoneRight - 200 && !spilloverChecked.has(idx)) {
        spilloverChecked.add(idx);  // Mark as checked so we don't count it again

        // Relevant label that wasn't picked = SPILLOVER (bad — player missed it)
        if (img.node !== null && !label.classList.contains('picked')) {
          label.classList.add('missed');  // Visual: red border + faded
          results.push({
            file: img.file,
            node: img.node,
            action: 'spillover',
            droppedNode: null
          });
        }

        // Irrelevant label that wasn't picked = CORRECTLY IGNORED (good!)
        if (img.node === null && !label.classList.contains('picked')) {
          results.push({
            file: img.file,
            node: null,
            action: 'ignored',
            droppedNode: null
          });
        }
      }
    });

    // Update the progress counter in the HUD
    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 10: PICK & DROP — Core Game Actions
   * ════════════════════════════════════════════════════════════════════
   *  These are the two main actions the player performs:
   *  
   *  PICK = Grab the label currently in the pick zone
   *         (triggered by: Space key, PICK button, or Arduino "P")
   *  
   *  DROP = Send the picked label to a node (1-4)
   *         (triggered by: 1-4 keys, Node buttons, or Arduino "1"-"4")
   *  
   *  Game flow: WATCHING → pick → PAUSED → drop → WATCHING → pick → ...
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * doPick() — Player picks up the label currently in the pick zone.
   * 
   * What happens:
   * 1. Check if player already has a label (can't pick two at once)
   * 2. Find which label is in the pick zone
   * 3. Pause the conveyor belt (gives player time to decide which node)
   * 4. Mark the label as "picked" (green border + scale up)
   * 5. Update the HUD to show "PICKED — Drop to Node 1-4"
   */
  function doPick() {
    // Can't pick if already holding a label
    if (isPicked) return;

    // Find the label in the pick zone (returns null if none)
    const label = getLabelInPickZone();
    if (!label) return;  // Nothing to pick

    const idx = parseInt(label.dataset.index);
    const img = gameImages[idx];

    // Don't pick labels that already scrolled past (already counted)
    if (spilloverChecked.has(idx)) return;

    // === PICK THE LABEL ===
    isPicked = true;
    paused = true;  // Freeze the conveyor belt
    pickedLabel = { idx, img, element: label };  // Remember what we picked
    spilloverChecked.add(idx);  // Mark as processed

    // Visual feedback: green border + slight zoom
    label.classList.add('picked');
    label.classList.remove('in-pick-zone');

    // Update HUD status
    hudStatus.textContent = '📦 PICKED — Drop to Node 1-4';
    hudStatus.className = 'status-picked';
  }

  /**
   * doDrop(node) — Player drops the picked label into a node.
   * 
   * This determines the outcome:
   * - If the label was irrelevant (node=null) → FALSE PICK (shouldn't have picked it)
   * - If dropped in the correct node → CORRECT (perfect sort!)
   * - If dropped in the wrong node → MIS-SORTED (right idea, wrong bin)
   * 
   * After dropping, the conveyor resumes moving.
   * 
   * @param {number} node — Which node the player chose (1, 2, 3, or 4)
   */
  function doDrop(node) {
    // Can't drop if not holding anything
    if (!isPicked || !pickedLabel) return;

    const img = pickedLabel.img;

    // --- Determine the outcome ---

    if (img.node === null) {
      // OUTCOME: FALSE PICK — Player picked an irrelevant label (oops!)
      results.push({
        file: img.file,
        node: null,
        action: 'falsepick',
        droppedNode: node
      });
      flashNode(node, 'wrong');  // Flash the node box red

    } else if (img.node === node) {
      // OUTCOME: CORRECT — Right label, right node (perfect!)
      results.push({
        file: img.file,
        node: img.node,
        action: 'correct',
        droppedNode: node
      });
      flashNode(node, 'highlight');  // Flash the node box green

    } else {
      // OUTCOME: MIS-SORTED — Right label, wrong node
      results.push({
        file: img.file,
        node: img.node,
        action: 'missorted',
        droppedNode: node
      });
      flashNode(node, 'wrong');  // Flash the node box red
    }

    // === RESET STATE — Resume the conveyor ===
    isPicked = false;
    paused = false;       // Unfreeze the conveyor belt
    pickedLabel = null;    // No longer holding a label
    lastTimestamp = 0;     // Reset animation timing (prevents a big jump)

    // Update HUD back to watching mode
    hudStatus.textContent = 'WATCHING';
    hudStatus.className = 'status-idle';
    hudProgress.textContent = `${results.length} / ${gameImages.length}`;
  }

  /**
   * flashNode(node, cls) — Briefly highlights a node box with a color.
   * 
   * @param {number} node — Which node (1-4) to flash
   * @param {string} cls  — CSS class to add: "highlight" (green) or "wrong" (red)
   * 
   * The highlight appears for 800ms then automatically removes itself.
   */
  function flashNode(node, cls) {
    const box = document.querySelector(`.node-box[data-node="${node}"]`);
    if (box) {
      box.classList.add(cls);
      setTimeout(() => box.classList.remove(cls), 800);  // Remove after 0.8 seconds
    }
  }

  /**
   * updateHUD() — Refreshes the timer display in the game header.
   */
  function updateHUD() {
    hudTimer.textContent = `⏱ ${speedSec}s/label`;
  }


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 11: GAME LIFECYCLE — Start, End, and Results
   * ════════════════════════════════════════════════════════════════════
   *  These functions manage the overall game flow:
   *  
   *  startGame() → Sets up a new round and begins the conveyor
   *  endGame()   → Stops the conveyor and tallies remaining labels
   *  showResults() → Calculates scores and displays the results screen
   * ════════════════════════════════════════════════════════════════════ */

  /**
   * startGame(selectedLevel) — Initializes and starts a new game round.
   * 
   * @param {number} selectedLevel — The difficulty level (1-4)
   * 
   * Steps:
   * 1. Set the speed based on the chosen level
   * 2. Shuffle the 40 labels into a random order
   * 3. Reset all game state variables
   * 4. Build the conveyor belt with label cards
   * 5. Switch to the game screen
   * 6. Start the animation after a 1-second delay
   */
  function startGame(selectedLevel) {
    // Set difficulty
    level = selectedLevel;
    speedSec = config.levels[level].speedSec;  // e.g., Easy = 10 seconds per label

    // Shuffle labels so the order is different every game
    gameImages = shuffle(config.images);

    // Reset all game state for a fresh start
    currentIndex = 0;
    isPicked = false;
    pickedLabel = null;
    paused = false;
    conveyorX = window.innerWidth;  // Start the conveyor off-screen to the right
    lastTimestamp = 0;
    results = [];
    spilloverChecked = new Set();
    gameStartTime = Date.now();  // Record when the game started

    // Update the HUD with initial values
    hudLevel.textContent = `Level: ${config.levels[level].name}`;
    hudProgress.textContent = `0 / ${gameImages.length}`;
    hudStatus.textContent = 'WATCHING';
    hudStatus.className = 'status-idle';

    // Build the conveyor belt (create all 40 label cards)
    buildConveyor();
    conveyorTrack.style.transform = `translateY(-50%) translateX(${conveyorX}px)`;

    // Switch from menu screen to game screen
    showScreen(screenGame);

    // Wait 1 second, then start the conveyor animation
    // (gives the player a moment to get ready)
    setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, 1000);
  }

  /**
   * endGame() — Called when all labels have scrolled off-screen.
   * 
   * Stops the animation and counts any remaining labels that
   * weren't processed yet (marks them as spillover or ignored).
   */
  function endGame() {
    // Stop the animation loop
    if (animationId) cancelAnimationFrame(animationId);

    // Count any labels that haven't been processed yet
    gameImages.forEach((img, idx) => {
      if (!spilloverChecked.has(idx)) {
        if (img.node !== null) {
          // Relevant label that was never processed = spillover
          results.push({ file: img.file, node: img.node, action: 'spillover', droppedNode: null });
        } else {
          // Irrelevant label that was never processed = correctly ignored
          results.push({ file: img.file, node: null, action: 'ignored', droppedNode: null });
        }
      }
    });

    // Show the results dashboard
    showResults();
  }

  /**
   * showResults() — Calculates final scores and displays the results screen.
   * 
   * Scoring breakdown:
   * - correct:   Picked relevant label → dropped to correct node
   * - missorted: Picked relevant label → dropped to wrong node
   * - spillover: Relevant label scrolled past without being picked
   * - falsepick: Picked an irrelevant label
   * - ignored:   Irrelevant label scrolled past (this is GOOD)
   * 
   * Accuracy = (correct picks / total relevant labels) × 100%
   * 
   * Performance rating:
   *   90%+ = Excellent (green badge)
   *   75%+ = Good (blue badge)
   *   50%+ = Average (orange badge)
   *   <50% = Needs Improvement (red badge)
   */
  function showResults() {
    // Calculate total game time
    gameEndTime = Date.now();
    const totalTimeMs = gameEndTime - gameStartTime;
    const totalTimeSec = Math.round(totalTimeMs / 1000);
    const minutes = Math.floor(totalTimeSec / 60);
    const seconds = totalTimeSec % 60;

    // Count each type of result
    const correct   = results.filter(r => r.action === 'correct').length;
    const missorted = results.filter(r => r.action === 'missorted').length;
    const spillover = results.filter(r => r.action === 'spillover').length;
    const falsepick = results.filter(r => r.action === 'falsepick').length;
    const ignored   = results.filter(r => r.action === 'ignored').length;

    // How many labels actually needed to be sorted (node != null)
    const totalRelevant = gameImages.filter(i => i.node !== null).length;

    // Update the stat card numbers on the results screen
    document.getElementById('res-correct').textContent   = correct;
    document.getElementById('res-missorted').textContent  = missorted;
    document.getElementById('res-spillover').textContent  = spillover;
    document.getElementById('res-falsepick').textContent  = falsepick;
    document.getElementById('res-ignored').textContent    = ignored;

    // Calculate accuracy percentage
    const accuracy = totalRelevant > 0 ? Math.round((correct / totalRelevant) * 100) : 0;

    // Calculate processing speed (items per minute)
    const itemsPerMin = totalTimeSec > 0 ? Math.round((gameImages.length / totalTimeSec) * 60) : 0;

    // Update summary metrics
    document.getElementById('res-total-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('res-accuracy').textContent   = accuracy + '%';
    document.getElementById('res-speed').textContent      = itemsPerMin + ' items/min';

    // Set the performance badge color and text based on accuracy
    const badge = document.getElementById('performance-badge');
    const badgeScore = document.getElementById('badge-score');
    
    if (accuracy >= 90) {
      badge.className = 'performance-badge excellent';  // Green
      badgeScore.textContent = 'Excellent';
    } else if (accuracy >= 75) {
      badge.className = 'performance-badge good';       // Blue
      badgeScore.textContent = 'Good';
    } else if (accuracy >= 50) {
      badge.className = 'performance-badge average';    // Orange
      badgeScore.textContent = 'Average';
    } else {
      badge.className = 'performance-badge poor';       // Red
      badgeScore.textContent = 'Needs Improvement';
    }

    // Switch to the results screen
    showScreen(screenResults);
  }


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 12: EVENT LISTENERS — User Input Handling
   * ════════════════════════════════════════════════════════════════════
   *  Event listeners "listen" for user actions (clicks, key presses)
   *  and call the appropriate function when they happen.
   *  
   *  Three input methods are supported:
   *  1. On-screen buttons (touch/click)
   *  2. Keyboard shortcuts (Space, 1-4)
   *  3. Arduino hardware buttons (handled in Section 6)
   * ════════════════════════════════════════════════════════════════════ */

  // --- Arduino Connect/Disconnect Button ---
  btnConnectSerial.addEventListener('click', () => {
    if (serialConnected) {
      disconnectArduino();  // Already connected → disconnect
    } else {
      connectArduino();     // Not connected → connect
    }
  });

  // --- Level Selection Buttons (Easy, Medium, Hard, Expert) ---
  // querySelectorAll finds ALL buttons with class "btn-level" and a data-level attribute
  document.querySelectorAll('.btn-level[data-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      startGame(parseInt(btn.dataset.level));  // Start game with the chosen level
    });
  });

  // --- Play Again Button (on results screen) ---
  btnRestart.addEventListener('click', () => {
    showScreen(screenMenu);  // Go back to the main menu
  });

  // --- On-Screen PICK Button ---
  btnPick.addEventListener('click', () => doPick());

  // --- On-Screen DROP Buttons (Node 1-4) ---
  document.querySelectorAll('.drop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      doDrop(parseInt(btn.dataset.node));  // Drop to the node number on the button
    });
  });

  // --- Keyboard Controls ---
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();  // Prevent the page from scrolling down
      doPick();            // Space bar = Pick
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
      const node = parseInt(e.code.replace('Digit', ''));  // "Digit1" → 1
      doDrop(node);  // Number keys 1-4 = Drop to that node
    }
  });


  /* ════════════════════════════════════════════════════════════════════
   *  SECTION 13: APP INITIALIZATION
   * ════════════════════════════════════════════════════════════════════
   *  Code that runs once when the page first loads.
   *  Sets the initial state of the Arduino status badge.
   * ════════════════════════════════════════════════════════════════════ */

  console.log('🎮 Fluid Sorting Simulator initialized with Web Serial API');
  updateSerialStatus(false);  // Show "Not Connected" on page load

})();
/* End of IIFE — all code above is safely contained in its own scope */
