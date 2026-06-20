// ==========================================================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================================================
const DEFAULT_STUDENT_NAMES = "강하늘, 고은아, 김도현, 김민지, 박서준, 박지민, 백현우, 성시경, 신민아, 안은진, 오지호, 유재석, 윤아름, 이병헌, 이서진, 이지은, 장도연, 정우성, 조세호, 한효주";

let state = {
    students: [],           // Array of { id, name, points }
    assignedSeats: [],      // Array of student ID strings (or null) mapped to grid cells
    lockedSeats: new Set(), // Set of seat indices that are locked/pinned
    pointLogs: [],          // Array of { timestamp, studentName, type, change, message }
    settings: {
        theme: "theme-chalkboard",
        soundOn: true,
        rows: 4,
        cols: 5,
        seatingStyle: "single", // "single" or "pair"
        corridors: [],          // Column indices (1-indexed) after which corridors are inserted
        swapCost: 10,
        lockCost: 20,
        insufficientPolicy: "block", // "block" or "allow-negative"
        swapPolicy: "deduct-initiator" // "deduct-initiator" | "deduct-both" | "pay-target"
    }
};

// Web Audio API Context (Lazily initialized)
let audioCtx = null;

// ==========================================================================
// AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================================================
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!state.settings.soundOn) return;
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'click') {
            // Short mechanical tick for roulette blinking
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'select') {
            // Bright ding for a single seat assignment
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'success') {
            // Rich celebratory chord
            const notes = [261.63, 329.63, 392.00, 523.25]; // C major chord
            notes.forEach((freq, i) => {
                const subOsc = audioCtx.createOscillator();
                const subGain = audioCtx.createGain();
                subOsc.connect(subGain);
                subGain.connect(audioCtx.destination);
                
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(freq, now + i * 0.05);
                subOsc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.4);
                
                subGain.gain.setValueAtTime(0, now);
                subGain.gain.linearRampToValueAtTime(0.15, now + 0.05 + i * 0.05);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                
                subOsc.start(now);
                subOsc.stop(now + 0.6);
            });
        } else if (type === 'error') {
            // Low buzz for failure/blocked actions
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(80, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {
        console.warn("Audio Context is blocked or not supported:", e);
    }
}

function toggleSound() {
    state.settings.soundOn = !state.settings.soundOn;
    const btn = document.getElementById('soundToggle');
    if (state.settings.soundOn) {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.remove('muted');
        toast('사운드 효과가 켜졌습니다.', 'info');
        playSound('select');
    } else {
        btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        btn.classList.add('muted');
        toast('사운드 효과가 꺼졌습니다.', 'info');
    }
    saveToLocalStorage();
}

// ==========================================================================
// TOAST NOTIFICATIONS & FLOATING TEXTS
// ==========================================================================
function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
    
    let icon = '<i class="fa-solid fa-info-circle"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    if (type === 'warn') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            ${icon}
            <span class="toast-body">${message}</span>
        </div>
        <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function spawnFloatingText(element, text, isPositive = false) {
    const rect = element.getBoundingClientRect();
    const floating = document.createElement('div');
    floating.className = `floating-point-effect ${isPositive ? 'plus' : ''}`;
    floating.innerText = text;
    floating.style.left = `${rect.left + rect.width / 2}px`;
    floating.style.top = `${rect.top}px`;
    document.body.appendChild(floating);
    setTimeout(() => floating.remove(), 1200);
}

// ==========================================================================
// LOGS & TRANSACTION LEDGER
// ==========================================================================
function addLog(studentName, type, change, message) {
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.pointLogs.unshift({ timestamp, studentName, type, change, message });
    if (state.pointLogs.length > 200) {
        state.pointLogs.pop();
    }
    saveToLocalStorage();
    renderLogs();
}

function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    tbody.innerHTML = '';
    
    if (state.pointLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">거래 및 포인트 변동 이력이 없습니다.</td></tr>';
        return;
    }
    
    state.pointLogs.forEach(log => {
        const changeClass = log.change < 0 ? 'minus' : log.change > 0 ? 'plus' : '';
        const changeSign = log.change > 0 ? `+${log.change}P` : log.change < 0 ? `${log.change}P` : '0P';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.timestamp}</td>
            <td><strong>${log.studentName}</strong></td>
            <td><span class="point-badge" style="background:rgba(255,255,255,0.05); color:var(--text-primary); border:none;">${log.type}</span></td>
            <td class="log-point-change ${changeClass}">${changeSign}</td>
            <td>${log.message}</td>
        `;
        tbody.appendChild(tr);
    });
}

function clearLogs() {
    if (confirm("모든 포인트 로그 이력을 삭제하시겠습니까?")) {
        state.pointLogs = [];
        saveToLocalStorage();
        renderLogs();
        toast("로그 이력이 모두 삭제되었습니다.", "info");
    }
}

function openLogsModal() {
    document.getElementById('logsModal').style.display = 'flex';
    renderLogs();
}

function closeLogsModal() {
    document.getElementById('logsModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('logsModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// ==========================================================================
// CORE STATE STORAGE & SYNC
// ==========================================================================
function saveToLocalStorage() {
    localStorage.setItem('seatPicker_state', JSON.stringify({
        students: state.students,
        assignedSeats: state.assignedSeats,
        lockedSeats: Array.from(state.lockedSeats),
        pointLogs: state.pointLogs,
        settings: state.settings
    }));
}

function loadFromLocalStorage() {
    const raw = localStorage.getItem('seatPicker_state');
    if (raw) {
        try {
            const data = JSON.parse(raw);
            state.students = data.students || [];
            state.pointLogs = data.pointLogs || [];
            state.settings = { ...state.settings, ...data.settings };
            state.lockedSeats = new Set(data.lockedSeats || []);
            state.assignedSeats = data.assignedSeats || [];
            
            // Sync Form Elements
            document.getElementById('themeSelect').value = state.settings.theme;
            document.getElementById('gridRows').value = state.settings.rows;
            document.getElementById('gridCols').value = state.settings.cols;
            document.getElementById('swapCost').value = state.settings.swapCost;
            document.getElementById('lockCost').value = state.settings.lockCost;
            document.getElementById('insufficientPointsPolicy').value = state.settings.insufficientPolicy;
            document.getElementById('swapPolicy').value = state.settings.swapPolicy;
            
            const radioStyle = document.querySelector(`input[name="seatingStyle"][value="${state.settings.seatingStyle}"]`);
            if (radioStyle) radioStyle.checked = true;
            
            document.getElementById('corridorInput').value = state.settings.corridors.join(', ');
            
            // Apply theme class
            document.body.className = state.settings.theme;
            
            // Sync Audio Icon
            const btn = document.getElementById('soundToggle');
            if (state.settings.soundOn) {
                btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                btn.classList.remove('muted');
            } else {
                btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                btn.classList.add('muted');
            }
        } catch (e) {
            console.error("Local storage sync error. Loading defaults...", e);
            resetToDefaultState();
        }
    } else {
        resetToDefaultState();
    }
}

function resetToDefaultState() {
    state.students = DEFAULT_STUDENT_NAMES.split(',')
        .map((name, i) => ({ id: `std-${Date.now()}-${i}`, name: name.trim(), points: 100 }));
    state.assignedSeats = Array(state.settings.rows * state.settings.cols).fill(null);
    state.lockedSeats.clear();
    state.pointLogs = [];
    saveToLocalStorage();
}

// ==========================================================================
// TABS & INTERFACE RENDERERS
// ==========================================================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Find matching button
    const btn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (btn) btn.classList.add('active');
    
    document.getElementById(tabId).classList.add('active');
}

function changeTheme(themeName) {
    document.body.className = themeName;
    state.settings.theme = themeName;
    saveToLocalStorage();
    toast('테마가 성공적으로 변경되었습니다.', 'success');
}

// Setup/Student List parsing
function applyAndSaveList() {
    const input = document.getElementById('studentInput').value;
    const names = input.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
    
    if (names.length === 0) {
        toast('최소 한 명 이상의 학생을 입력하세요.', 'error');
        playSound('error');
        return;
    }
    
    // Merge names keeping their current points if they exist
    const newStudents = names.map((name, index) => {
        const existing = state.students.find(s => s.name === name);
        return {
            id: existing ? existing.id : `std-${Date.now()}-${index}`,
            name: name,
            points: existing ? existing.points : 100
        };
    });
    
    state.students = newStudents;
    
    // Resize grid if students exceed capacity
    const capacity = state.settings.rows * state.settings.cols;
    if (state.students.length > capacity) {
        // Automatically suggest or scale up grid cols
        const newCols = Math.ceil(state.students.length / state.settings.rows);
        state.settings.cols = newCols;
        document.getElementById('gridCols').value = newCols;
        toast(`학생 수(${state.students.length}명)가 교실 용량(${capacity}석)보다 많아 열의 개수를 ${newCols}개로 동적 조정합니다.`, 'warn');
    }
    
    // Refresh seat assignments - remove students no longer in list
    state.assignedSeats = state.assignedSeats.map(seatStudentId => {
        if (!seatStudentId) return null;
        const stillExists = state.students.some(s => s.id === seatStudentId);
        return stillExists ? seatStudentId : null;
    });
    
    // Adjust assigned seats array size
    const newSize = state.settings.rows * state.settings.cols;
    if (state.assignedSeats.length < newSize) {
        while(state.assignedSeats.length < newSize) state.assignedSeats.push(null);
    } else if (state.assignedSeats.length > newSize) {
        // Return dropped students to pool
        state.assignedSeats = state.assignedSeats.slice(0, newSize);
    }
    
    // Verify locks are in bounds
    const validLocks = new Set();
    state.lockedSeats.forEach(index => {
        if (index < newSize) validLocks.add(index);
    });
    state.lockedSeats = validLocks;
    
    saveToLocalStorage();
    renderStudentTable();
    renderClassroomGrid();
    toast('명렬이 성공적으로 저장 및 반영되었습니다.', 'success');
    playSound('select');
}

function resetToDefaultList() {
    document.getElementById('studentInput').value = DEFAULT_STUDENT_NAMES;
    applyAndSaveList();
}

function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';
    
    state.students.forEach(student => {
        const tr = document.createElement('tr');
        tr.id = `table-row-${student.id}`;
        
        tr.innerHTML = `
            <td><strong>${student.name}</strong></td>
            <td><span class="point-badge" id="badge-${student.id}">${student.points}P</span></td>
            <td>
                <div class="student-actions">
                    <button class="btn btn-xs btn-primary" onclick="adjustPoints('${student.id}', 10)" title="10포인트 추가"><i class="fa-solid fa-plus"></i></button>
                    <button class="btn btn-xs btn-danger" onclick="adjustPoints('${student.id}', -10)" title="10포인트 차감"><i class="fa-solid fa-minus"></i></button>
                    <button class="btn btn-xs btn-secondary" onclick="editPointPrompt('${student.id}')" title="직접 값 변경"><i class="fa-solid fa-pen"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Sync textarea input with current list
    document.getElementById('studentInput').value = state.students.map(s => s.name).join(', ');
}

function adjustPoints(studentId, amount) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;
    
    student.points += amount;
    
    // UI Update
    const badge = document.getElementById(`badge-${studentId}`);
    if (badge) {
        badge.innerText = `${student.points}P`;
        spawnFloatingText(badge, amount > 0 ? `+${amount}P` : `${amount}P`, amount > 0);
    }
    
    // Logging
    addLog(student.name, '수동 조정', amount, `포인트 수동 조정 (${amount > 0 ? '+' : ''}${amount}P)`);
    
    // Refresh classroom labels
    syncSeatPointsLabel(studentId);
    saveToLocalStorage();
}

function editPointPrompt(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;
    
    const newVal = prompt(`${student.name} 학생의 새 포인트를 입력하세요:`, student.points);
    if (newVal === null) return;
    
    const parsed = parseInt(newVal);
    if (isNaN(parsed)) {
        toast("올바른 숫자를 입력하세요.", "error");
        playSound('error');
        return;
    }
    
    const diff = parsed - student.points;
    student.points = parsed;
    
    // UI Update
    const badge = document.getElementById(`badge-${studentId}`);
    if (badge) badge.innerText = `${student.points}P`;
    
    addLog(student.name, '수동 수정', diff, `포인트를 직접 ${parsed}P로 변경함 (기존 대비 ${diff > 0 ? '+' : ''}${diff}P)`);
    syncSeatPointsLabel(studentId);
    saveToLocalStorage();
}

function syncSeatPointsLabel(studentId) {
    // Find all seat elements with this student ID
    const seats = document.querySelectorAll('.seat');
    seats.forEach(seat => {
        if (seat.dataset.studentId === studentId) {
            const pointsEl = seat.querySelector('.seat-points');
            const student = state.students.find(s => s.id === studentId);
            if (pointsEl && student) {
                pointsEl.innerText = `${student.points}P`;
            }
        }
    });
}

function resetAllPoints() {
    if (confirm("모든 학생의 포인트를 100P로 초기화하겠습니까?")) {
        state.students.forEach(s => s.points = 100);
        renderStudentTable();
        
        // Refresh grid
        state.students.forEach(s => syncSeatPointsLabel(s.id));
        
        addLog('시스템', '전체 초기화', 0, '모든 학생 포인트를 100P 기본값으로 초기화함');
        saveToLocalStorage();
        toast('모든 포인트가 100P로 초기화되었습니다.', 'success');
        playSound('select');
    }
}

// ==========================================================================
// GRID CONFIGURATION & LAYOUT BUILDER
// ==========================================================================
function updateGridDimensions() {
    const rows = parseInt(document.getElementById('gridRows').value) || 4;
    const cols = parseInt(document.getElementById('gridCols').value) || 5;
    
    state.settings.rows = rows;
    state.settings.cols = cols;
    
    // Corridors
    const corridorVal = document.getElementById('corridorInput').value;
    state.settings.corridors = corridorVal.split(',')
        .map(v => parseInt(v.trim()))
        .filter(v => !isNaN(v) && v > 0 && v <= cols);
        
    // Reset/resize seat assignment array
    const oldAssigned = [...state.assignedSeats];
    const newSize = rows * cols;
    state.assignedSeats = Array(newSize).fill(null);
    
    // Map existing assignments where possible
    for (let i = 0; i < Math.min(oldAssigned.length, newSize); i++) {
        state.assignedSeats[i] = oldAssigned[i];
    }
    
    // Adjust locks Set
    const validLocks = new Set();
    state.lockedSeats.forEach(index => {
        if (index < newSize) validLocks.add(index);
    });
    state.lockedSeats = validLocks;
    
    saveToLocalStorage();
    renderClassroomGrid();
    
    toast(`레이아웃 갱신: ${rows}행 × ${cols}열 (${newSize}석)`, 'info');
}

function updateSeatingStyle() {
    const styleVal = document.querySelector('input[name="seatingStyle"]:checked').value;
    state.settings.seatingStyle = styleVal;
    saveToLocalStorage();
    renderClassroomGrid();
}

function renderClassroomGrid() {
    const grid = document.getElementById('classroomGrid');
    grid.innerHTML = '';
    
    const rows = state.settings.rows;
    const cols = state.settings.cols;
    const style = state.settings.seatingStyle;
    const corridors = state.settings.corridors;
    
    // 1. Calculate Grid Template Columns
    let colTemplates = [];
    for (let c = 1; c <= cols; c++) {
        colTemplates.push("1fr");
        if (corridors.includes(c) && c < cols) {
            colTemplates.push("40px"); // Corridor Spacer width
        }
    }
    grid.style.gridTemplateColumns = colTemplates.join(' ');
    
    // 2. Generate Grid Cells (including spacers)
    let cellIndex = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 1; c <= cols; c++) {
            // Index of the current seat in our flat array
            const currentIndex = r * cols + (c - 1);
            const studentId = state.assignedSeats[currentIndex];
            const student = state.students.find(s => s.id === studentId);
            const isLocked = state.lockedSeats.has(currentIndex);
            
            // Create Seat Card Element
            const seat = document.createElement('div');
            seat.className = `seat ${student ? 'assigned' : 'empty'} ${isLocked ? 'locked' : ''}`;
            seat.dataset.seatIndex = currentIndex;
            
            if (student) {
                seat.draggable = true;
                seat.dataset.studentId = studentId;
                
                seat.innerHTML = `
                    <div class="seat-header">
                        <span class="seat-num">${currentIndex + 1}번 자리</span>
                        <button class="btn-lock" onclick="event.stopPropagation(); toggleLock(${currentIndex})" title="자리 고정/해제">
                            <i class="fa-solid fa-lock-open"></i>
                        </button>
                    </div>
                    <div class="seat-body">
                        <span class="student-name">${student.name}</span>
                    </div>
                    <div class="seat-footer">
                        <span class="seat-points">${student.points}P</span>
                    </div>
                `;
                
                // Add Drag Events
                seat.addEventListener('dragstart', handleDragStart);
                seat.addEventListener('dragend', handleDragEnd);
            } else {
                seat.innerHTML = `
                    <div class="seat-header">
                        <span class="seat-num">${currentIndex + 1}번 자리</span>
                        <button class="btn-lock" onclick="event.stopPropagation(); toggleLock(${currentIndex})" title="자리 고정/해제">
                            <i class="fa-solid fa-lock-open"></i>
                        </button>
                    </div>
                    <div class="seat-body">
                        <span class="student-name">-</span>
                    </div>
                    <div class="seat-footer">
                        <span class="seat-points" style="visibility:hidden">0P</span>
                    </div>
                `;
            }
            
            // Grid Over/Drop Listeners
            seat.addEventListener('dragover', handleDragOver);
            seat.addEventListener('dragleave', handleDragLeave);
            seat.addEventListener('drop', handleDrop);
            
            grid.appendChild(seat);
            
            // Insert Corridor Column if specified
            if (corridors.includes(c) && c < cols) {
                const spacer = document.createElement('div');
                spacer.className = 'corridor-spacer';
                grid.appendChild(spacer);
            }
        }
    }
    
    // Apply styling gaps depending on pair mode
    if (style === 'pair') {
        grid.style.columnGap = '0px';
        grid.style.rowGap = '25px';
        
        // Give left card and right card in a pair custom margins
        const seats = grid.querySelectorAll('.seat');
        seats.forEach((seat, idx) => {
            const gridCol = (idx % cols) + 1;
            // For pairs, add spacing after every odd column, except corridors
            if (gridCol % 2 === 1 && gridCol < cols) {
                seat.style.marginRight = '8px';
            } else if (gridCol % 2 === 0) {
                seat.style.marginLeft = '8px';
                seat.style.marginRight = '20px'; // gap between pairs
            }
        });
    } else {
        grid.style.columnGap = '20px';
        grid.style.rowGap = '20px';
        const seats = grid.querySelectorAll('.seat');
        seats.forEach(seat => {
            seat.style.margin = '0';
        });
    }
}

// ==========================================================================
// LOCKED / VIP SEAT MANAGEMENT
// ==========================================================================
function toggleLock(seatIndex) {
    const isLocked = state.lockedSeats.has(seatIndex);
    const studentId = state.assignedSeats[seatIndex];
    
    if (!isLocked) {
        // Lock requested
        if (!studentId) {
            toast('학생이 배치된 자리만 고정(지정석)할 수 있습니다.', 'warn');
            playSound('error');
            return;
        }
        
        const student = state.students.find(s => s.id === studentId);
        const cost = parseInt(document.getElementById('lockCost').value) || 0;
        const policy = document.getElementById('insufficientPointsPolicy').value;
        
        if (student.points < cost && policy === 'block') {
            toast(`${student.name} 학생의 포인트(${student.points}P)가 부족하여 지정석 설정이 차단되었습니다. (비용: ${cost}P)`, 'error');
            playSound('error');
            return;
        }
        
        // Deduct points
        student.points -= cost;
        state.lockedSeats.add(seatIndex);
        
        // Spawn text effect
        const seatEl = document.querySelector(`.seat[data-seat-index="${seatIndex}"]`);
        if (seatEl) {
            spawnFloatingText(seatEl, `-${cost}P`);
        }
        
        addLog(student.name, '지정석 고정', -cost, `${seatIndex + 1}번 자리를 지정석으로 고정함 (포인트 차감)`);
        toast(`${student.name} 학생의 자리를 고정했습니다. (-${cost}P)`, 'success');
        playSound('select');
    } else {
        // Unlock requested
        state.lockedSeats.delete(seatIndex);
        const student = state.students.find(s => s.id === studentId);
        if (student) {
            addLog(student.name, '지정석 해제', 0, `${seatIndex + 1}번 지정석 고정을 해제함`);
            toast(`${student.name} 학생의 자리 고정을 해제했습니다.`, 'info');
        }
        playSound('click');
    }
    
    saveToLocalStorage();
    renderStudentTable();
    renderClassroomGrid();
}

// ==========================================================================
// SEATING ASSIGNMENT ALGORITHMS (RANDOM & ROULETTE)
// ==========================================================================

// Fisher-Yates Shuffle
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function getUnassignedStudents() {
    // Collect student IDs that are locked/pinned
    const lockedIds = new Set();
    state.lockedSeats.forEach(index => {
        const id = state.assignedSeats[index];
        if (id) lockedIds.add(id);
    });
    
    // Return student objects who are NOT locked
    return state.students.filter(s => !lockedIds.has(s.id));
}

function arrangeRandom() {
    let pool = getUnassignedStudents();
    if (pool.length === 0 && state.students.length > 0) {
        toast("모든 자리가 고정(잠금)되어 배치할 대상을 찾을 수 없습니다.", "warn");
        playSound('error');
        return;
    }
    if (state.students.length === 0) {
        toast("등록된 학생이 없습니다. 설정에서 명단부터 저장해주세요.", "error");
        playSound('error');
        return;
    }
    
    // Shuffle pool
    pool = shuffle(pool);
    
    // Fill unlocked positions
    let poolIndex = 0;
    for (let i = 0; i < state.assignedSeats.length; i++) {
        if (!state.lockedSeats.has(i)) {
            if (poolIndex < pool.length) {
                state.assignedSeats[i] = pool[poolIndex].id;
                poolIndex++;
            } else {
                state.assignedSeats[i] = null; // empty seat
            }
        }
    }
    
    saveToLocalStorage();
    renderClassroomGrid();
    
    // Celebrate!
    triggerCelebration();
    playSound('success');
    toast("모든 자리가 공정하게 무작위 배치되었습니다!", "success");
}

function arrangeRoulette() {
    let pool = getUnassignedStudents();
    if (pool.length === 0 && state.students.length > 0) {
        toast("모든 자리가 고정(잠금)되어 배치할 대상을 찾을 수 없습니다.", "warn");
        playSound('error');
        return;
    }
    if (state.students.length === 0) {
        toast("등록된 학생이 없습니다.", "error");
        playSound('error');
        return;
    }
    
    pool = shuffle(pool);
    
    // Disable all action buttons during animation
    const controlButtons = document.querySelectorAll('.control-bar button, .sidebar-panel button, select, input');
    controlButtons.forEach(btn => btn.disabled = true);
    
    // Find all unlocked index list
    const targetSeatIndices = [];
    for (let i = 0; i < state.assignedSeats.length; i++) {
        if (!state.lockedSeats.has(i)) {
            targetSeatIndices.push(i);
        }
    }
    
    // Clear all unpinned seats name representation first for dramatic effect
    targetSeatIndices.forEach(idx => {
        state.assignedSeats[idx] = null;
    });
    renderClassroomGrid();
    
    let currentTargetIndex = 0;
    
    function assignNextSeatAnimated() {
        if (currentTargetIndex >= targetSeatIndices.length || currentTargetIndex >= pool.length) {
            // Done! Enable UI
            controlButtons.forEach(btn => btn.disabled = false);
            triggerCelebration();
            playSound('success');
            toast("두근두근 룰렛 매칭 배정이 성공적으로 완료되었습니다!", "success");
            saveToLocalStorage();
            return;
        }
        
        const seatIndex = targetSeatIndices[currentTargetIndex];
        const targetSeatEl = document.querySelector(`.seat[data-seat-index="${seatIndex}"]`);
        const nameEl = targetSeatEl.querySelector('.student-name');
        
        let blinkCount = 0;
        const totalBlinks = 12;
        const blinkSpeed = 50; // ms
        
        let interval = setInterval(() => {
            targetSeatEl.classList.add('blinking');
            playSound('click');
            
            // Pick a random student name to flicker
            const randomTickerStudent = pool[Math.floor(Math.random() * pool.length)];
            nameEl.innerText = randomTickerStudent.name;
            
            setTimeout(() => {
                targetSeatEl.classList.remove('blinking');
            }, blinkSpeed - 10);
            
            blinkCount++;
            if (blinkCount >= totalBlinks) {
                clearInterval(interval);
                
                // Set final student
                const student = pool[currentTargetIndex];
                state.assignedSeats[seatIndex] = student.id;
                
                // Render final seat state
                targetSeatEl.classList.add('selected');
                nameEl.innerText = student.name;
                
                const pointsEl = targetSeatEl.querySelector('.seat-points');
                if (pointsEl) {
                    pointsEl.innerText = `${student.points}P`;
                    pointsEl.style.visibility = 'visible';
                }
                
                // Bind drag events to new seat
                targetSeatEl.draggable = true;
                targetSeatEl.dataset.studentId = student.id;
                targetSeatEl.addEventListener('dragstart', handleDragStart);
                targetSeatEl.addEventListener('dragend', handleDragEnd);
                
                playSound('select');
                
                // Move to next seat with delay
                currentTargetIndex++;
                setTimeout(assignNextSeatAnimated, 150);
            }
        }, blinkSpeed);
    }
    
    assignNextSeatAnimated();
}

function resetPlacement() {
    if (confirm("지정석 고정을 포함한 모든 자리 배치를 지우시겠습니까?")) {
        state.assignedSeats = Array(state.settings.rows * state.settings.cols).fill(null);
        state.lockedSeats.clear();
        saveToLocalStorage();
        renderClassroomGrid();
        toast("자리가 비워지고 지정석이 모두 초기화되었습니다.", "info");
        playSound('click');
    }
}

// Confetti effects
function triggerCelebration() {
    try {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    } catch(e) {
        console.warn("Confetti library not loaded properly", e);
    }
}

// ==========================================================================
// DRAG AND DROP SWAP API & POINT DEDUCTION TRANSITION
// ==========================================================================
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    document.getElementById('dragInstruction').style.display = 'block';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.getElementById('dragInstruction').style.display = 'none';
    
    // Clear drag-over classes just in case
    document.querySelectorAll('.seat').forEach(s => s.classList.remove('drag-over'));
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault(); 
    }
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    this.classList.remove('drag-over');
    
    if (!draggedElement || draggedElement === this) return;
    
    const sourceIndex = parseInt(draggedElement.dataset.seatIndex);
    const targetIndex = parseInt(this.dataset.seatIndex);
    
    const sourceStudentId = state.assignedSeats[sourceIndex];
    const targetStudentId = state.assignedSeats[targetIndex];
    
    if (!sourceStudentId) return; // Dragged an empty space? Should not happen
    
    const sourceStudent = state.students.find(s => s.id === sourceStudentId);
    const targetStudent = targetStudentId ? state.students.find(s => s.id === targetStudentId) : null;
    
    // Check if swap point policy allows transaction
    const swapCost = parseInt(document.getElementById('swapCost').value) || 0;
    const policy = document.getElementById('insufficientPointsPolicy').value;
    const swapPolicy = document.getElementById('swapPolicy').value;
    
    // Determine point changes based on policy
    let sourceChange = 0;
    let targetChange = 0;
    
    if (swapPolicy === 'deduct-initiator') {
        sourceChange = -swapCost;
    } else if (swapPolicy === 'deduct-both') {
        sourceChange = -swapCost;
        if (targetStudent) targetChange = -swapCost;
    } else if (swapPolicy === 'pay-target') {
        sourceChange = -swapCost;
        if (targetStudent) targetChange = swapCost;
    }
    
    // Validate points for source student
    if (sourceStudent.points + sourceChange < 0 && policy === 'block') {
        toast(`포인트가 부족하여 자리를 바꿀 수 없습니다! (${sourceStudent.name}: ${sourceStudent.points}P 필요: ${Math.abs(sourceChange)}P)`, 'error');
        playSound('error');
        return;
    }
    
    // Validate points for target student if they also have to pay
    if (targetStudent && targetStudent.points + targetChange < 0 && policy === 'block') {
        toast(`상대 학생의 포인트가 부족하여 자리를 바꿀 수 없습니다! (${targetStudent.name}: ${targetStudent.points}P 필요: ${Math.abs(targetChange)}P)`, 'error');
        playSound('error');
        return;
    }
    
    // Perform seat swap
    state.assignedSeats[sourceIndex] = targetStudentId;
    state.assignedSeats[targetIndex] = sourceStudentId;
    
    // Locks carry over to the position, not the student. 
    // If a seat index was locked, it remains locked, but now has the new student.
    
    // Deduct points
    sourceStudent.points += sourceChange;
    if (targetStudent) targetStudent.points += targetChange;
    
    // Floating point popups
    if (sourceChange !== 0) {
        spawnFloatingText(this, `${sourceChange > 0 ? '+' : ''}${sourceChange}P`, sourceChange > 0);
    }
    if (targetStudent && targetChange !== 0) {
        spawnFloatingText(draggedElement, `${targetChange > 0 ? '+' : ''}${targetChange}P`, targetChange > 0);
    }
    
    // Logs
    const targetNameStr = targetStudent ? targetStudent.name : '빈자리';
    addLog(sourceStudent.name, '자리 스왑', sourceChange, `${targetNameStr}(${sourceIndex + 1}번)와 자리를 교환함. 비용 차감.`);
    if (targetStudent && targetChange !== 0) {
        addLog(targetStudent.name, '자리 스왑', targetChange, `${sourceStudent.name}의 교환 요청 수락 및 정산됨.`);
    }
    
    saveToLocalStorage();
    renderStudentTable();
    renderClassroomGrid();
    
    // Animate swapped seats
    const elSource = document.querySelector(`.seat[data-seat-index="${sourceIndex}"]`);
    const elTarget = document.querySelector(`.seat[data-seat-index="${targetIndex}"]`);
    if (elSource) elSource.classList.add('selected');
    if (elTarget) elTarget.classList.add('selected');
    
    toast(`자리가 변경되었습니다. (${sourceStudent.name} ↔ ${targetNameStr})`, 'success');
    playSound('select');
}

// ==========================================================================
// EXPORTING AND IMAGE CAPTURING (HTML2CANVAS)
// ==========================================================================
function exportAsImage() {
    const target = document.getElementById('captureTarget');
    toast("이미지를 생성하는 중입니다...", "info");
    
    // Ensure all styles are loaded before capture
    html2canvas(target, {
        useCORS: true,
        backgroundColor: null, // Transparent/glassmorphic
        scale: 2 // High resolution output
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `교실_자리배치도_${new Date().toLocaleDateString()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        toast("교실 자리배치도가 PNG 이미지로 저장되었습니다!", "success");
        playSound('success');
    }).catch(err => {
        console.error("Html2canvas failed:", err);
        toast("이미지 저장 실패. 브라우저 보안 설정을 확인해보세요.", "error");
        playSound('error');
    });
}

// ==========================================================================
// APPLICATION INITIALIZATION ON LOAD
// ==========================================================================
window.onload = function() {
    loadFromLocalStorage();
    renderStudentTable();
    renderClassroomGrid();
    renderLogs();
};
