import villageStructure from './village.js';

const gameArea = document.getElementById('game-area');
const groundLayer = document.getElementById('ground-layer');
const objectLayer = document.getElementById('object-layer');
const entityLayer = document.getElementById('entity-layer');
const interactionLayer = document.getElementById('interaction-layer');
const healthDisplay = document.getElementById('health');
const levelDisplay = document.getElementById('level');
const dialogueModal = document.getElementById('dialogue-modal');
const dialogueText = document.getElementById('dialogue-text');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const closeButton = document.querySelector('.close-button');

let playerX = 50;
let playerY = 50;
let health = 100;
let level = 1;
let currentNpc = null;
const apiKey = 'AIzaSyA5no7eaoIrfGY4-tZgGqbQJf-JDvOL9C4'; // Замените на свой API-ключ
const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey;
const proxyUrl = 'socks5://104.200.152.30:4145'; // Прокси SOCKS5

const mapWidth = 200;
const mapHeight = 150;
const viewWidth = 60;
const viewHeight = 30;

let map = [];
let npcs = {};
let interactionArea = null;
let interactionItems = [];
let isInteracting = false;
let selectedItemIndex = 0;


function generateWorld() {
    map = [];
    for (let y = 0; y < mapHeight; y++) {
        let row = [];
        for (let x = 0; x < mapWidth; x++) {
            if (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) {
                row.push('#'); // Границы
            } else if (Math.random() < 0.08) {
                row.push('T'); // Деревья
            } else if (Math.random() < 0.04) {
                row.push('O'); // Камни
            } else if (Math.random() < 0.06 && (x > 5 && x < mapWidth - 5 && y > 5 && y < mapHeight - 5)) {
                row.push('^'); // Горы
            } else {
                row.push('.'); // Пустое пространство (земля)
            }
        }
        map.push(row.join(''));
    }

    // Генерация деревень
    const village1X = Math.floor(Math.random() * (mapWidth - villageStructure.width - 20)) + 10;
    const village1Y = Math.floor(Math.random() * (mapHeight - villageStructure.height - 20)) + 10;
    placeStructure(village1X, village1Y, villageStructure);

    const village2X = Math.floor(Math.random() * (mapWidth - villageStructure.width - 20)) + 10;
    const village2Y = Math.floor(Math.random() * (mapHeight - villageStructure.height - 20)) + 10;
    placeStructure(village2X, village2Y, villageStructure);

    // Генерация дорог
    generateRoad(village1X + Math.floor(villageStructure.width / 2), village1Y + Math.floor(villageStructure.height / 2), village2X + Math.floor(villageStructure.width / 2), village2Y + Math.floor(villageStructure.height / 2));

    // Генерация NPC
    generateRandomNpcs();
}

function placeStructure(startX, startY, structure) {
    for (let y = 0; y < structure.height; y++) {
        for (let x = 0; x < structure.width; x++) {
            if (startY + y < mapHeight && startX + x < mapWidth) {
                if (structure.map[y][x] !== ' ') {
                    let row = map[startY + y].split('');
                    row[startX + x] = structure.map[y][x];
                    map[startY + y] = row.join('');
                }
            }
        }
    }
    structure.npcs.forEach((npc, index) => {
        const npcId = `npc_village_${startX}_${startY}_${index}`;
        npcs[npcId] = {
            x: startX + npc.x,
            y: startY + npc.y,
            memory: [],
            dialogueHistory: [],
            description: "Я житель этой деревни.",
        };
    });
}

function generateRoad(startX, startY, endX, endY) {
    let currentX = startX;
    let currentY = startY;

    while (currentX !== endX || currentY !== endY) {
        if (currentX < endX) {
            currentX++;
        } else if (currentX > endX) {
            currentX--;
        } else if (currentY < endY) {
            currentY++;
        } else if (currentY > endY) {
            currentY--;
        }
        if (currentY < mapHeight && currentX < mapWidth && currentY >= 0 && currentX >= 0) {
            if (map[currentY][currentX] === '.') {
                let row = map[currentY].split('');
                row[currentX] = '=';
                map[currentY] = row.join('');
            }
        }
    }
}

async function generateRandomNpcs() {
    const numNpcs = 10;
    for (let i = 0; i < numNpcs; i++) {
        const npcId = `npc_random_${i}`;
        const x = Math.floor(Math.random() * (mapWidth - 2)) + 1;
        const y = Math.floor(Math.random() * (mapHeight - 2)) + 1;

        const prompt = `Создай описание для NPC в фэнтезийном мире. Включи имя, краткую историю и мотивацию. Отвечай не более чем в 2 предложениях.`;
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }],
                    }],
                }),
            // Добавьте опцию proxy
            proxy: proxyUrl,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.candidates[0].content.parts[0].text;

            npcs[npcId] = {
                x: x,
                y: y,
                memory: [],
                dialogueHistory: [],
                description: aiResponse,
            };
        } catch (error) {
            console.error('Error fetching AI response:', error);
            npcs[npcId] = {
                x: x,
                y: y,
                memory: [],
                dialogueHistory: [],
                description: "Я странник.",
            };
        }
    }
}

function renderMap() {
    let groundString = '';
    let objectString = '';
    let entityString = '';

    const startX = Math.max(0, playerX - Math.floor(viewWidth / 2));
    const endX = Math.min(mapWidth, playerX + Math.ceil(viewWidth / 2));
    const startY = Math.max(0, playerY - Math.floor(viewHeight / 2));
    const endY = Math.min(mapHeight, playerY + Math.ceil(viewHeight / 2));

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const cell = map[y][x];
            let entity = '';
            let npcIdAtPosition = null;
            for (const npcId in npcs) {
                if (npcs[npcId].x === x && npcs[npcId].y === y) {
                    entity = `<span class="npc">N</span>`;
                    npcIdAtPosition = npcId;
                    break;
                }
            }
            if (x === playerX && y === playerY) {
                entity = `<span class="player">@</span>`;
            }

            const offsetX = x - startX;
            const offsetY = y - startY;

            if (entity) {
                entityString += `<span style="position: absolute; left: ${offsetX}em; top: ${offsetY}em;">${entity}</span>`;
            } else if (cell === 'T') {
                objectString += `<span class="tree" style="position: absolute; left: ${offsetX}em; top: ${offsetY}em;">T</span>`;
            } else if (cell === 'O') {
                objectString += `<span class="rock" style="position: absolute; left: ${offsetX}em; top: ${offsetY}em;">O</span>`;
            } else if (cell === '^') {
                objectString += `<span class="mountain" style="position: absolute; left: ${offsetX}em; top: ${offsetY}em;">^</span>`;
            } else if (cell === '=') {
                objectString += `<span class="road" style="position: absolute; left: ${offsetX}em; top: ${offsetY}em;">=</span>`;
            } else {
                groundString += `<span style="position: absolute; left: ${offsetX}em; top: ${offsetY}em;">${cell}</span>`;
            }
        }
    }

    groundLayer.innerHTML = groundString;
    objectLayer.innerHTML = objectString;
    entityLayer.innerHTML = entityString;
}

function updateStats() {
    healthDisplay.textContent = health;
    levelDisplay.textContent = level;
}

function movePlayer(direction) {
    let newX = playerX;
    let newY = playerY;

    switch (direction) {
        case 'w':
            newY--;
            break;
        case 's':
            newY++;
            break;
        case 'a':
            newX--;
            break;
        case 'd':
            newX++;
            break;
    }

    if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight && map[newY][newX] !== '#') {
        playerX = newX;
        playerY = newY;
        renderMap();
    }
}

function openDialogue(npcId) {
    currentNpc = npcId;
    dialogueModal.style.display = 'block';
    dialogueText.innerHTML = marked.parse(npcs[npcId].dialogueHistory.join('\n'));
    hljs.highlightAll();
}

function closeDialogue() {
    dialogueModal.style.display = 'none';
    currentNpc = null;
}

async function sendDialogue(message) {
    if (!currentNpc) return;

    const npc = npcs[currentNpc];
    const prompt = `Ты ${npc.description}. Текущий диалог: ${JSON.stringify(npc.dialogueHistory)}. Игрок говорит: ${message}. Игрок мог уйти и вернуться. Отвечай не более чем в 2 предложениях.`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }],
                }],
            }),
            // Добавьте опцию proxy
            proxy: proxyUrl,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;

        npc.dialogueHistory.push(`Игрок: ${message}`);
        npc.dialogueHistory.push(`NPC: ${aiResponse}`);
        dialogueText.innerHTML = marked.parse(npc.dialogueHistory.join('\n'));
        hljs.highlightAll();
        userInput.value = '';
    } catch (error) {
        console.error('Error fetching AI response:', error);
        dialogueText.textContent += '\n\nОшибка при получении ответа от AI.';
    }
}

function createInteractionArea() {
    if (isInteracting) return;
    isInteracting = true;
    interactionArea = document.createElement('div');
    interactionArea.classList.add('interaction-area');
    interactionArea.style.left = `${playerX - Math.floor(viewWidth / 2)}em`;
    interactionArea.style.top = `${playerY - Math.floor(viewHeight / 2)}em`;
    interactionArea.style.width = `${viewWidth}em`;
    interactionArea.style.height = `${viewHeight}em`;
    interactionLayer.appendChild(interactionArea);

    interactionItems = [];
    selectedItemIndex = 0;

    const items = [];
    for (const npcId in npcs) {
        const npc = npcs[npcId];
        const distance = Math.sqrt(Math.pow(playerX - npc.x, 2) + Math.pow(playerY - npc.y, 2));
        if (distance < 5) {
            items.push({
                label: `NPC: ${npc.description.split('.')[0]}`,
                action: () => openDialogue(npcId),
                x: npc.x,
                y: npc.y
            });
        }
    }

    items.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(playerX - a.x, 2) + Math.pow(playerY - a.y, 2));
        const distB = Math.sqrt(Math.pow(playerX - b.x, 2) + Math.pow(playerY - b.y, 2));
        return distA - distB;
    });

    items.forEach((item, index) => {
        const interactionItem = document.createElement('div');
        interactionItem.classList.add('interaction-item');
        interactionItem.textContent = item.label;
        interactionItem.style.left = `${item.x - playerX + Math.floor(viewWidth / 2)}em`;
        interactionItem.style.top = `${item.y - playerY + Math.floor(viewHeight / 2)}em`;
        interactionItem.dataset.index = index;
        interactionItem.addEventListener('click', item.action);
        interactionItems.push(interactionItem);
        interactionLayer.appendChild(interactionItem);
    });
    updateSelectedItem();
}

function updateSelectedItem() {
    interactionItems.forEach((item, index) => {
        if (index === selectedItemIndex) {
            item.style.color = 'yellow';
        } else {
            item.style.color = '#fff';
        }
    });
}

function destroyInteractionArea() {
    if (!isInteracting) return;
    isInteracting = false;
    if (interactionArea) {
        interactionArea.remove();
        interactionArea = null;
    }
    interactionItems.forEach(item => item.remove());
    interactionItems = [];
}

function interact() {
    if (isInteracting) {
        destroyInteractionArea();
    } else {
        createInteractionArea();
    }
}

function selectInteractionItem(direction) {
    if (!isInteracting) return;
    if (direction === 'up') {
        selectedItemIndex = (selectedItemIndex - 1 + interactionItems.length) % interactionItems.length;
    } else if (direction === 'down') {
        selectedItemIndex = (selectedItemIndex + 1) % interactionItems.length;
    }
    updateSelectedItem();
}

document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w':
        case 'a':
        case 's':
        case 'd':
            movePlayer(event.key);
            break;
        case 'e':
            interact();
            break;
        case 'ArrowUp':
            selectInteractionItem('up');
            break;
        case 'ArrowDown':
            selectInteractionItem('down');
            break;
        case 'Enter':
            if (isInteracting && interactionItems[selectedItemIndex]) {
                interactionItems[selectedItemIndex].click();
                destroyInteractionArea();
            }
            break;
    }
});

sendButton.addEventListener('click', () => {
    sendDialogue(userInput.value);
});

closeButton.addEventListener('click', closeDialogue);

generateWorld();
renderMap();
updateStats();