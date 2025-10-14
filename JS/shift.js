let shiftDocId = null;
let shiftListener = null;

function formatDateTime(date) {
  return `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
}

function getDateOnly(str) {
  if (!str) return null;
  return new Date(str.split(",")[0]);
}

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

function updateStatusDisplay(shiftKey, status, openedAt, closedAt) {
  const statusElement = document.getElementById(`${shiftKey}Status`);
  const openedAtElement = document.getElementById(`${shiftKey}OpenedAt`);
  const closedAtElement = document.getElementById(`${shiftKey}ClosedAt`);
  
  // Remove all status classes
  statusElement.classList.remove('status-open', 'status-closed', 'status-waiting', 'loading');
  
  // Update status text and styling
  if (status === 'Open') {
    statusElement.textContent = `${shiftKey === 'shift1' ? '🌅 Morning' : '🌇 Evening'} Shift is OPEN`;
    statusElement.classList.add('status-open');
  } else if (status === 'Closed') {
    statusElement.textContent = `${shiftKey === 'shift1' ? '🌅 Morning' : '🌇 Evening'} Shift is CLOSED`;
    statusElement.classList.add('status-closed');
  } else if (status === 'Waiting') {
    statusElement.textContent = `${shiftKey === 'shift1' ? '🌅 Morning' : '🌇 Evening'} Shift is WAITING`;
    statusElement.classList.add('status-waiting');
  }
  
  // Update time displays
  openedAtElement.textContent = openedAt || '-';
  closedAtElement.textContent = closedAt || '-';
}

function updateButtonVisibility(shift1Status, shift2Status) {
  const openShift1Btn = document.getElementById("openShift1Btn");
  const closeShift1Btn = document.getElementById("closeShift1Btn");
  const openShift2Btn = document.getElementById("openShift2Btn");
  const closeShift2Btn = document.getElementById("closeShift2Btn");

  // Shift 1 buttons
  if (shift1Status === 'Open') {
    openShift1Btn.style.display = "none";
    closeShift1Btn.style.display = "flex";
  } else {
    openShift1Btn.style.display = "flex";
    closeShift1Btn.style.display = "none";
  }

  // Shift 2 buttons
  if (shift2Status === 'Open') {
    openShift2Btn.style.display = "none";
    closeShift2Btn.style.display = "flex";
  } else {
    openShift2Btn.style.display = "flex";
    closeShift2Btn.style.display = "none";
  }
}

async function handleShiftLogic(data) {
  const { shift1, shift2, date } = data;
  const today = new Date();
  const currentDate = new Date(today.toLocaleDateString());
  const shift1CloseDate = getDateOnly(shift1?.closedAt);
  const shift1OpenDate = getDateOnly(shift1?.openedAt);
  const shift2CloseDate = getDateOnly(shift2?.closedAt);

  // CASE 1: New day - shift1 should open
  if (shift1CloseDate && currentDate > shift1CloseDate) {
    await db.collection("shifts").doc(shiftDocId).update({
      date: today.toLocaleDateString(),
      "shift1.status": "Closed",
      "shift1.openedAt": "",
      "shift1.closedAt": "",
      "shift2.status": "Closed",
      "shift2.openedAt": "",
      "shift2.closedAt": ""
    });
    return;
  }

  // CASE 2: shift1 open > close → must close first
  if (shift1?.status === "Open" && shift1OpenDate > shift1CloseDate) {
    updateStatusDisplay('shift1', 'Open', shift1.openedAt, shift1.closedAt);
    updateStatusDisplay('shift2', 'Waiting');
    updateButtonVisibility('Open', 'Waiting');
    return;
  }

  // CASE 3: shift1 closed and same day → shift2 can open
  if (shift1?.status === "Closed" && shift1CloseDate?.toDateString() === currentDate.toDateString()) {
    updateStatusDisplay('shift1', 'Closed', shift1.openedAt, shift1.closedAt);
    
    if (shift2?.status === "Open") {
      updateStatusDisplay('shift2', 'Open', shift2.openedAt, shift2.closedAt);
      updateButtonVisibility('Closed', 'Open');
    } else {
      updateStatusDisplay('shift2', 'Closed', shift2.openedAt, shift2.closedAt);
      updateButtonVisibility('Closed', 'Closed');
    }
    return;
  }

  // CASE 4: both shifts closed and today → next day setup
  if (
    shift1?.status === "Closed" &&
    shift2?.status === "Closed" &&
    shift1CloseDate?.toDateString() === currentDate.toDateString() &&
    shift2CloseDate?.toDateString() === currentDate.toDateString()
  ) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);
    await db.collection("shifts").doc(shiftDocId).update({
      date: nextDate.toLocaleDateString(),
      "shift1.status": "Closed",
      "shift2.status": "Closed"
    });
    return;
  }

  // Normal display logic
  if (shift1?.status === "Open") {
    updateStatusDisplay('shift1', 'Open', shift1.openedAt, shift1.closedAt);
    updateStatusDisplay('shift2', 'Waiting');
    updateButtonVisibility('Open', 'Waiting');
  } else {
    updateStatusDisplay('shift1', 'Closed', shift1.openedAt, shift1.closedAt);
    updateStatusDisplay('shift2', 'Closed', shift2.openedAt, shift2.closedAt);
    updateButtonVisibility('Closed', 'Closed');
  }
}

function setupShiftListener() {
  // Set up real-time listener for shifts collection
  shiftListener = db.collection("shifts")
    .limit(1)
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        // Create initial shift document if none exists
        createInitialShift();
        return;
      }

      snapshot.forEach(doc => {
        shiftDocId = doc.id;
        const data = doc.data();
        handleShiftLogic(data);
      });
    }, error => {
      console.error("Error listening to shifts:", error);
      showNotification('Error loading shift data', 'error');
    });
}

async function createInitialShift() {
  const today = new Date();
  try {
    const docRef = await db.collection("shifts").add({
      date: today.toLocaleDateString(),
      shift1: {
        status: "Closed",
        openedAt: "",
        closedAt: ""
      },
      shift2: {
        status: "Closed",
        openedAt: "",
        closedAt: ""
      }
    });
    shiftDocId = docRef.id;
  } catch (error) {
    console.error("Error creating initial shift:", error);
    showNotification('Error creating shift data', 'error');
  }
}

async function openShift(shiftKey) {
  if (!shiftDocId) {
    showNotification('No shift document found', 'error');
    return;
  }
  
  const now = new Date();
  const openedAt = formatDateTime(now);

  try {
    await db.collection("shifts").doc(shiftDocId).update({
      [`${shiftKey}.status`]: "Open",
      [`${shiftKey}.openedAt`]: openedAt,
      [`${shiftKey}.closedAt`]: ""
    });
    showNotification(`${shiftKey === "shift1" ? "Morning" : "Evening"} shift opened!`);
  } catch (error) {
    console.error("Error opening shift:", error);
    showNotification('Error opening shift', 'error');
  }
}

async function closeShift(shiftKey) {
  if (!shiftDocId) {
    showNotification('No shift document found', 'error');
    return;
  }
  
  const now = new Date();
  const closedAt = formatDateTime(now);

  try {
    await db.collection("shifts").doc(shiftDocId).update({
      [`${shiftKey}.status`]: "Closed",
      [`${shiftKey}.closedAt`]: closedAt
    });
    showNotification(`${shiftKey === "shift1" ? "Morning" : "Evening"} shift closed!`);
  } catch (error) {
    console.error("Error closing shift:", error);
    showNotification('Error closing shift', 'error');
  }
}

// Initialize event listeners
function initializeEventListeners() {
  document.getElementById("openShift1Btn").addEventListener("click", () => openShift("shift1"));
  document.getElementById("closeShift1Btn").addEventListener("click", () => closeShift("shift1"));
  document.getElementById("openShift2Btn").addEventListener("click", () => openShift("shift2"));
  document.getElementById("closeShift2Btn").addEventListener("click", () => closeShift("shift2"));
}

// Initialize the app
function initializeApp() {
  initializeEventListeners();
  setupShiftListener();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);