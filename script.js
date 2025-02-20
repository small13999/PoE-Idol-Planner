const sizeMap = { "1x1": "1", "1x2": "2", "2x1": "3", "1x3": "4", "3x1": "5", "2x2": "6" };
const reverseSizeMap = Object.fromEntries(Object.entries(sizeMap).map(([k, v]) => [v, k]));

// We'll store modifiers and their IDs here.  This is *global*.
const modifierIdMap = { prefixes: {}, suffixes: {} };
let nextModifierId = 1; // Start assigning IDs from 1

// Store modifiers for each size
const modifierDatabase = {
    "1x1": { prefixes: [], suffixes: [] },
    "2x1": { prefixes: [], suffixes: [] },
    "1x2": { prefixes: [], suffixes: [] },
    "3x1": { prefixes: [], suffixes: [] },
    "1x3": { prefixes: [], suffixes: [] },
    "2x2": { prefixes: [], suffixes: [] }
};

function parseModifierFile(content) {
    const lines = content.split('\n');
    const modifiers = {
        prefixes: [],
        suffixes: []
    };

    let currentSection = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === 'Prefixes') {
            currentSection = 'prefixes';
        } else if (trimmedLine === 'Suffixes') {
            currentSection = 'suffixes';
        } else if (trimmedLine && currentSection) {
            const markPosition = trimmedLine.indexOf('681');
            if (markPosition > 0) {
                const weight = trimmedLine.substring(0, markPosition);
                const modText = trimmedLine.substring(markPosition + 3).trim();
                const formattedMod = `${modText} (${weight})`;

                // --- Assign and Store Modifier ID ---
                if (!modifierIdMap[currentSection][formattedMod]) {
                    modifierIdMap[currentSection][formattedMod] = String(nextModifierId++);
                }

                modifiers[currentSection].push(formattedMod);
            }
        }
    }

    return modifiers;
}

// Keep the changes to loadModifiers function
async function loadModifiers(size) {
    try {
        let fileSize = size;
        if (size === '1x2') fileSize = '2x1';
        if (size === '1x3') fileSize = '3x1';

        const response = await fetch(`${fileSize}_mods.txt`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.text();
        return parseModifierFile(content);
    } catch (error) {
        console.error('Error loading modifiers:', error);
        return { prefixes: [], suffixes: [] };
    }
}

function setupSearchableSelect(inputId, optionsId, options = []) {
    const input = document.getElementById(inputId);
    const optionsContainer = document.getElementById(optionsId);

    function updateOptions(searchText = '') {
        if (!optionsContainer) {
            return;
        }

        optionsContainer.innerHTML = '';
        const filteredOptions = options.filter(option =>
            option.toLowerCase().includes(searchText.toLowerCase())
        );

        filteredOptions.forEach(option => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = option;
            div.onclick = () => {
                input.value = option;
                optionsContainer.style.display = 'none';
            };
            optionsContainer.appendChild(div);
        });
    }

    input.onfocus = () => {
        if (!optionsContainer) {
            return;
        }
        updateOptions(input.value);
        optionsContainer.style.display = 'block';
    };

    input.onblur = () => {
        setTimeout(() => {
            if (!optionsContainer) {
                return;
            }
            optionsContainer.style.display = 'none';
        }, 200);
    };

    input.oninput = () => {
        if (!optionsContainer) {
            return;
        }
        updateOptions(input.value);
        optionsContainer.style.display = 'block';
    };

    updateOptions();
}



let modifiersLoaded = false;
// --- Corrected updateModifiers function ---
async function updateModifiers() {
    const size = document.getElementById('idol-size').value;
    console.log('Updating modifiers for size:', size);

    // Load modifiers only if not already loaded for this size
    if (!modifierDatabase[size].prefixes.length && !modifierDatabase[size].suffixes.length) {
        const modifiers = await loadModifiers(size);
        modifierDatabase[size] = modifiers;
        console.log('Loaded and stored modifiers:', modifiers);
    } else {
        console.log('Using cached modifiers for size:', size);
    }


    // Always setup (or re-setup) the searchable selects with the correct options.
    setupSearchableSelect('prefix1', 'prefix1-options', modifierDatabase[size].prefixes);
    setupSearchableSelect('prefix2', 'prefix2-options', modifierDatabase[size].prefixes);
    setupSearchableSelect('suffix1', 'suffix1-options', modifierDatabase[size].suffixes);
    setupSearchableSelect('suffix2', 'suffix2-options', modifierDatabase[size].suffixes);
}


document.addEventListener('DOMContentLoaded', async () => {
    const sizeSelect = document.getElementById('idol-size');
    sizeSelect.addEventListener('change', updateModifiers);  // Call on change
    await updateModifiers(); // Load initial modifiers
    createGrid();
    await loadGridState();
});
const blockedCells = [
    [0, 0], [2, 1], [3, 1], [4, 1], [3, 2],
    [3, 3], [3, 4], [2, 4], [4, 4], [6, 5]
];

function createGrid() {
    const grid = document.getElementById("grid");
    grid.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 6; j++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = i;
            cell.dataset.col = j;
            if (blockedCells.some(([x, y]) => x === i && y === j)) {
                cell.classList.add("blocked");
            }
            grid.appendChild(cell);
        }
    }
    grid.addEventListener('dragover', allowDrop);
    grid.addEventListener('drop', drop);
}

function extractModifierData(mod) {
    const openParenIndex = mod.indexOf('(');
    const closeParenIndex = mod.indexOf(')');

    if (openParenIndex === -1 || closeParenIndex === -1) {
        return { type: 'unknown' }; // Handle invalid formats
    }

    const textBeforeNumber = mod.substring(0, openParenIndex).trim();
    let textAfterNumber = mod.substring(closeParenIndex + 1).trim(); // Remove the extra % if it exists.
    textAfterNumber = textAfterNumber.replace("%", "").trim()

    let numericPart = mod.substring(openParenIndex + 1, closeParenIndex).trim();

    if (numericPart.includes('–')) { // Range
        // Remove % from both parts
        const [minStr, maxStr] = numericPart.split('–').map(s => s.replace('%', '').trim());
        const minPercentage = parseFloat(minStr);
        const maxPercentage = parseFloat(maxStr);

        if (isNaN(minPercentage) || isNaN(maxPercentage)) {
            return { type: 'unknown' }
        }

        return {
            type: 'percentageRange',
            minPercentage,
            maxPercentage,
            textBeforeNumber,
            textAfterNumber
        };
    } else if (numericPart.includes('%')) { // Percentage
        // Remove % before parsing
        const percentage = parseFloat(numericPart.replace('%', ''));
        if (isNaN(percentage)) {
            return { type: 'unknown' }
        }
        return {
            type: 'percentage',
            percentage,
            textBeforeNumber,
            textAfterNumber
        };
    } else if (numericPart.startsWith('x')) { // Count
        const count = parseInt(numericPart.substring(1), 10);
        if (isNaN(count)) {
            return { type: 'unknown' }
        }
        return {
            type: 'count',
            count,
            textBeforeNumber,
            textAfterNumber
        };
    } else {
        return { type: 'unknown' }; // Unknown type
    }
}

function areModifiersSameBase(mod1, mod2) {
    const data1 = extractModifierData(mod1);
    const data2 = extractModifierData(mod2);

    // Compare based on extracted data, not the raw string
    return data1.type === data2.type && data1.type !== 'unknown' && data1.textBeforeNumber === data2.textBeforeNumber && data1.textAfterNumber === data2.textAfterNumber;
}

function formatModifier(data) {
    if (data.type === 'percentageRange') {
        return `${data.textBeforeNumber}(${data.minPercentage}–${data.maxPercentage})% ${data.textAfterNumber}`; // % moved outside the parentheses
    } else if (data.type === 'percentage') {
        return `${data.textBeforeNumber}(${data.percentage})% ${data.textAfterNumber}`;  // % moved outside the parentheses
    } else if (data.type === 'count') {
        return `${data.textBeforeNumber}(x${data.count}) ${data.textAfterNumber}`; // No change for count
    } else {
        return ""; // Or some default/error string
    }
}

function sumModifiers(mod1, mod2) {
    const data1 = extractModifierData(mod1);
    const data2 = extractModifierData(mod2);

    if (!areModifiersSameBase(mod1, mod2)) {
        return mod1; // Return mod1 as is if not combinable
    }

    if (data1.type === 'percentageRange' && data2.type === 'percentageRange') {
        return formatModifier({
            type: 'percentageRange',
            minPercentage: data1.minPercentage + data2.minPercentage,
            maxPercentage: data1.maxPercentage + data2.maxPercentage,
            textBeforeNumber: data1.textBeforeNumber,
            textAfterNumber: data1.textAfterNumber
        });
    } else if (data1.type === 'percentage' && data2.type === 'percentage') {
        return formatModifier({
            type: 'percentage',
            percentage: data1.percentage + data2.percentage,
            textBeforeNumber: data1.textBeforeNumber,
            textAfterNumber: data1.textAfterNumber
        });
    } else if (data1.type === 'count' && data2.type === 'count') {
        return formatModifier({
            type: 'count',
            count: data1.count + data2.count,
            textBeforeNumber: data1.textBeforeNumber,
            textAfterNumber: data1.textAfterNumber
        });
    } else {
        return mod1; // Return the original if types don't match
    }
}

function updateTotalBonuses() {
    const idols = document.querySelectorAll('#grid .idol');
    let allModifiers = [];

    idols.forEach(idol => {
        const modsText = idol.dataset.mods;
        if (modsText) {
            allModifiers.push(...modsText.split('\n').filter(mod => mod.trim() !== ''));
        }
    });

    // --- Modifier Combination and Counting ---
    let combinedModifiers = {};  // Use an object for easier counting

    for (let i = 0; i < allModifiers.length; i++) {
        let currentMod = allModifiers[i];
        let data = extractModifierData(currentMod);

        // Check if this modifier can be combined (is not of type count and has a known type)
        let canCombine = data.type !== 'count' && data.type !== 'unknown';

        let combined = false;
        for (let modKey in combinedModifiers) {
            if (canCombine && areModifiersSameBase(currentMod, modKey)) {
                combinedModifiers[modKey].mod = sumModifiers(combinedModifiers[modKey].mod, currentMod);
                combinedModifiers[modKey].count++;  // Increment count even if combined
                combined = true;
                break;
            } else if (!canCombine && currentMod == modKey) {
                combinedModifiers[modKey].count++; // Increment count
                combined = true;
                break;
            }
        }

        if (!combined) {
            // Add as a new entry with a count of 1. If combinable store combined mod.
            combinedModifiers[currentMod] = { mod: currentMod, count: 1 };
        }
    }


    const bonusesDiv = document.getElementById('bonuses');
    bonusesDiv.innerHTML = '';

    // --- Display Combined Modifiers ---
    for (let modKey in combinedModifiers) {
        const p = document.createElement('p');
        // If count > 1, display it with "xN".  Use stored mod, so range mods are displayed correctly.
        if (combinedModifiers[modKey].count > 1 && extractModifierData(combinedModifiers[modKey].mod).type != 'percentage' && extractModifierData(combinedModifiers[modKey].mod).type != 'percentageRange') {
            p.textContent = `${modKey} x${combinedModifiers[modKey].count}`;
        } else {
            p.textContent = combinedModifiers[modKey].mod;  // Display combined value
        }
        bonusesDiv.appendChild(p);
    }
}

// --- Idol Creation and Placement ---
let idolCreationIndex = 0;
function createIdol() {
    const size = document.getElementById("idol-size").value;
    const prefix1 = document.getElementById("prefix1").value;
    const prefix2 = document.getElementById("prefix2").value;
    const suffix1 = document.getElementById("suffix1").value;
    const suffix2 = document.getElementById("suffix2").value;

    const idol = document.createElement("div");
    idol.classList.add("idol");
    idol.draggable = true;
    idol.dataset.size = size;
    idol.id = `idol-${Date.now()}`;

    const mods = [prefix1, prefix2, suffix1, suffix2]
        .filter(mod => mod)
        .join('\n');
    idol.dataset.mods = mods;

    idol.textContent = size;

    const [width, height] = size.split("x").map(Number);
    idol.style.width = `${width * 52}px`;
    idol.style.height = `${height * 52}px`;

    idol.addEventListener('dragstart', drag);
    idol.addEventListener('dblclick', removeIdol);
    idol.addEventListener('mouseover', showMods);
    idol.addEventListener('mouseout', hideMods);

    // --- Improved Initial Placement ---
    const gridContainer = document.getElementById("grid");
    const gridRect = gridContainer.getBoundingClientRect();
    const idols = document.querySelectorAll('#grid .idol')

    let initialCol = 6; // Place outside grid
    let initialRow = 0;

    // Check for a free position, row by row.  This prevents stacking.
    for (let r = 0; r < 7; r++) {
        let positionOccupied = false;
        for (let c = 0; c < idols.length; c++) {
            const rect = idols[c].getBoundingClientRect();
            const idolRow = Math.floor((rect.top - gridRect.top) / 52);
            const idolCol = Math.floor((rect.left - gridRect.left) / 52);

            if (idolRow === r && idolCol >= 6) {
                positionOccupied = true;
                break;
            }
        }
        if (!positionOccupied) {
            initialRow = r;
            break;
        }
    }

    idol.style.position = 'absolute';
    idol.style.left = `${initialCol * 52 + gridRect.left}px`; //Correct position.
    idol.style.top = `${initialRow * 52 + gridRect.top}px`; // Correct position.
    document.body.appendChild(idol);  // Add to document (important for positioning)

    updateGridStateDebounced(); // Update URL after creating (debounced)
    updateTotalBonuses();
}

function allowDrop(event) {
    event.preventDefault();
}

function drag(event) {
    const idol = event.target;
    idol.classList.add('dragging');
    event.dataTransfer.setData('text/plain', event.target.id);
    hideMods(); // Hide tooltip when dragging starts
}

function drop(event) {
    event.preventDefault();
    const idolId = event.dataTransfer.getData('text/plain');
    const idol = document.getElementById(idolId);
    if (!idol) return;

    const grid = document.getElementById('grid');
    const rect = grid.getBoundingClientRect();
    // Get the mouse position relative to the grid
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const [width, height] = idol.dataset.size.split('x').map(Number);
    let bestOverlap = -1;
    let bestRow = -1;
    let bestCol = -1;

    // Iterate through all POSSIBLE positions
    for (let row = 0; row <= 7 - height; row++) {
        for (let col = 0; col <= 6 - width; col++) {
            if (isValidPosition(row, col, width, height, idolId)) {
                let overlap = 0;
                // Check overlap for EACH CELL the idol would occupy
                for (let i = 0; i < height; i++) {
                    for (let j = 0; j < width; j++) {
                        // Calculate the absolute pixel coordinates of the current cell
                        const cellX = col * 52 + j * 52; // Correct cell position
                        const cellY = row * 52 + i * 52; // Correct cell position

                        // Check if the mouse is WITHIN the current cell
                        if (mouseX >= cellX && mouseX < cellX + 52 &&
                            mouseY >= cellY && mouseY < cellY + 52) {
                            overlap++;
                        }
                    }
                }

                if (overlap > bestOverlap) {
                    bestOverlap = overlap;
                    bestRow = row;
                    bestCol = col;
                }
            }
        }
    }

    if (bestRow !== -1 && bestCol !== -1) {
        grid.appendChild(idol);
        idol.style.left = `${bestCol * 52}px`;
        idol.style.top = `${bestRow * 52}px`;
        idol.classList.remove('dragging');
        updateGridStateDebounced();
        updateTotalBonuses();
    } else {
        idol.classList.remove('dragging'); // Remove dragging class even if not dropped
    }
}
function isValidPosition(row, col, width, height, selfId = null) {
    if (row < 0 || col < 0 || row + height > 7 || col + width > 6) return false;

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (blockedCells.some(([x, y]) => x === row + i && y === col + j)) {
                return false;
            }
            // Check for overlaps with existing idols, EXCLUDING the idol itself
            const existingIdols = document.querySelectorAll('#grid .idol');
            for (const existingIdol of existingIdols) {
                if (selfId && existingIdol.id === selfId) continue; // Skip self-check

                const existingRect = existingIdol.getBoundingClientRect();
                const existingRow = Math.floor((existingRect.top - grid.getBoundingClientRect().top) / 52);
                const existingCol = Math.floor((existingRect.left - grid.getBoundingClientRect().left) / 52);
                const [existingWidth, existingHeight] = existingIdol.dataset.size.split('x').map(Number);

                if (row + i >= existingRow && row + i < existingRow + existingHeight &&
                    col + j >= existingCol && col + j < existingCol + existingWidth) {
                    return false; // Overlap detected
                }
            }
        }
    }
    return true;
}

function removeIdol(event) {
    hideMods(); // Hide tooltip BEFORE removing the idol
    event.target.remove();
    updateGridStateDebounced(); // Update URL after removing (debounced)
    updateTotalBonuses();
}

function showMods(event) {
    const idol = event.target;
    // Check if idol is being dragged. If yes, don't show mods.
    if (idol.classList.contains('dragging')) {
        return;
    }
    const mods = idol.dataset.mods;
    if (!mods) return;

    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.classList.add('tooltip');
        document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = mods.replace(/\n/g, '<br>');
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
}


function hideMods() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// --- URL State Management ---
let debounceTimer;

function updateGridStateDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateGridState, 250); // Update after 250ms of inactivity
}

function serializeGridState() {
    const idols = document.querySelectorAll('#grid .idol');
    const idolData = [];

    idols.forEach(idol => {
        const rect = idol.getBoundingClientRect();
        const gridRect = document.getElementById('grid').getBoundingClientRect();
        const row = Math.floor((rect.top - gridRect.top) / 52);
        const col = Math.floor((rect.left - gridRect.left) / 52);
        const sizeId = sizeMap[idol.dataset.size];

        // Correctly get modifier IDs, using "0" for empty slots.
        const modStrings = idol.dataset.mods.split('\n').map(s => s.trim());
        const modIds = [];

        // Helper function to find modifier ID
        function findModifierId(modString) {
            for (const type in modifierIdMap) {
                if (modifierIdMap[type][modString]) {
                    return modifierIdMap[type][modString];
                }
            }
            return "0"; // Return "0" if not found
        }

        modIds.push(findModifierId(modStrings[0] || "")); // Prefix 1
        modIds.push(findModifierId(modStrings[1] || "")); // Prefix 2
        modIds.push(findModifierId(modStrings[2] || "")); // Suffix 1
        modIds.push(findModifierId(modStrings[3] || "")); // Suffix 2
        idolData.push(`${row}${col}/${sizeId}/${modIds.join('/')}`);

    });

    return idolData.join(';');
}

function deserializeGridState(stateString) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 6; j++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.row = i;
            cell.dataset.col = j;
            if (blockedCells.some(([x, y]) => x === i && y === j)) {
                cell.classList.add("blocked");
            }
            grid.appendChild(cell);
        }
    }
    if (!stateString) return;

    const idolData = stateString.split(';').map(idolStr => {
        const [rowCol, sizeId, modId1, modId2, modId3, modId4] = idolStr.split('/'); // Always split into 6 parts
        const row = parseInt(rowCol.substring(0, 1));
        const col = parseInt(rowCol.substring(1));
        const size = reverseSizeMap[sizeId];

        const modIds = [modId1, modId2, modId3, modId4]; //All Mod Ids
        const mods = modIds.map(modId => {
            if (modId === "0") return ''; // Empty slot

            // Find the modifier string by ID
            for (const type in modifierIdMap) {
                for (const mod in modifierIdMap[type]) {
                    if (modifierIdMap[type][mod] === modId) {
                        return mod;
                    }
                }
            }
            return ''; // Shouldn't happen, but be safe
        }).join('\n');

        return { row, col, size, mods };
    });

    idolData.forEach(idolData => {
        const { row, col, size, mods } = idolData;
        const idol = document.createElement('div');
        idol.classList.add("idol");
        idol.draggable = true;
        idol.dataset.size = size;
        idol.dataset.mods = mods;
        idol.id = `idol-${Date.now()}`;

        idol.textContent = size;

        const [width, height] = size.split('x').map(Number);
        idol.style.width = `${width * 52}px`;
        idol.style.height = `${height * 52}px`;

        idol.addEventListener('dragstart', drag);
        idol.addEventListener('dblclick', removeIdol);
        idol.addEventListener('mouseover', showMods);
        idol.addEventListener('mouseout', hideMods);

        // Place the idol on the grid
        const grid = document.getElementById('grid');
        if (isValidPosition(row, col, width, height)) {
            grid.appendChild(idol);
            idol.style.left = `${col * 52}px`;
            idol.style.top = `${row * 52}px`;
        }
    });
}

function updateGridState() {
    const serializedState = serializeGridState();
    const encodedState = encodeURIComponent(serializedState);
    //THIS IS THE KEY LINE I MISSED:
    window.history.replaceState(null, "", `#${encodedState}`);  // Update the URL!
    updateTotalBonuses();
}

async function loadGridState() {
    const encodedState = window.location.hash.substring(1);
    if (encodedState) {
        const serializedState = decodeURIComponent(encodedState);
        // Extract sizes from the serialized state
        const idolEntries = serializedState.split(';');
        const uniqueSizes = new Set();
        for (const entry of idolEntries) {
            const [rowCol, sizeId] = entry.split('/');
            const size = reverseSizeMap[sizeId];
            if (size) uniqueSizes.add(size);
        }
        // Load modifiers for each unique size
        await Promise.all([...uniqueSizes].map(size => loadModifiers(size)));
        // Now deserialize the grid
        deserializeGridState(serializedState);
        updateTotalBonuses();
    }
}

// Update the DOMContentLoaded event listener to handle async loading
document.addEventListener('DOMContentLoaded', async () => {
    const sizeSelect = document.getElementById('idol-size');
    sizeSelect.addEventListener('change', updateModifiers);
    await updateModifiers(); // Load initial modifiers based on default size
    createGrid();
    await loadGridState(); // Wait for grid state to load after modifiers
});
