// Elements
const form = document.getElementById("passengerForm");
const tableBody = document.getElementById("tableBody");
const paxCount = document.getElementById("paxCount");
const qrInput = document.getElementById("qrInput");
const nameField = document.getElementById("name");
const flightField = document.getElementById("flightNo");
const seatField = document.getElementById("seatNo");
const numPaxField = document.getElementById("numPax");
const airlineField = document.getElementById("airline");
const fqtvField = document.getElementById("fqtv");
const serialField = document.getElementById("serial");
const remarksField = document.getElementById("remarks");
const emptyState = document.getElementById("emptyState");
const clearBtn = document.getElementById("clearBtn");
const shiftName = document.getElementById("shiftName");
const shiftStatus = document.getElementById("shiftStatus");
const shiftTime = document.getElementById("shiftTime");
const dashboardBtn = document.getElementById("dashboardBtn");
const reportBtn = document.getElementById("reportBtn");
const addPassengerBtn = document.getElementById("addPassengerBtn");

// Set current date
const today = new Date().toISOString().split("T")[0];
form.date.value = today;

// Track if current entry is from QR scan
let isQREntry = false;

// Passenger list (combined from Firebase and localStorage)
let passengerList = [];

// Track unsaved edits
const unsavedEdits = new Map();

// LocalStorage keys
const PENDING_QR_KEY = 'pendingQRPassengers';
const SYNC_IN_PROGRESS_KEY = 'syncInProgress';

// ----------- LocalStorage Functions -----------
function getPendingQRPassengers() {
    try {
        const pending = localStorage.getItem(PENDING_QR_KEY);
        return pending ? JSON.parse(pending) : [];
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return [];
    }
}

function savePendingQRPassenger(passenger) {
    try {
        const pending = getPendingQRPassengers();
        pending.push(passenger);
        localStorage.setItem(PENDING_QR_KEY, JSON.stringify(pending));
        console.log('Saved to localStorage, total pending:', pending.length);
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

function updatePendingQRPassenger(passengerId, updates) {
    try {
        const pending = getPendingQRPassengers();
        const updated = pending.map(p => {
            if (p.id === passengerId) {
                return {
                    ...p,
                    data: { ...p.data, ...updates },
                    timestamp: new Date().toISOString() // Update timestamp
                };
            }
            return p;
        });
        localStorage.setItem(PENDING_QR_KEY, JSON.stringify(updated));
        console.log('Updated passenger in localStorage:', passengerId);
        return true;
    } catch (error) {
        console.error('Error updating localStorage:', error);
        return false;
    }
}

function removePendingQRPassenger(passengerId) {
    try {
        const pending = getPendingQRPassengers();
        const updated = pending.filter(p => p.id !== passengerId);
        localStorage.setItem(PENDING_QR_KEY, JSON.stringify(updated));
        console.log('Removed from localStorage, remaining:', updated.length);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
}

function clearPendingQRPassengers() {
    try {
        localStorage.removeItem(PENDING_QR_KEY);
        console.log('Cleared all pending QR passengers');
        return true;
    } catch (error) {
        console.error('Error clearing localStorage:', error);
        return false;
    }
}

// ----------- Sync LocalStorage to Firebase -----------
async function syncPendingToFirebase() {
    // Check if sync is already in progress
    if (localStorage.getItem(SYNC_IN_PROGRESS_KEY) === 'true') {
        console.log('Sync already in progress, skipping...');
        return;
    }
    
    const pending = getPendingQRPassengers();
    if (pending.length === 0) {
        return;
    }
    
    console.log(`Syncing ${pending.length} pending passengers to Firebase...`);
    localStorage.setItem(SYNC_IN_PROGRESS_KEY, 'true');
    
    let successCount = 0;
    let errorCount = 0;
    
    try {
        for (const passenger of pending) {
            // Skip if this passenger has unsaved edits
            if (unsavedEdits.has(passenger.id)) {
                console.log(`Skipping ${passenger.id} - has unsaved edits`);
                continue;
            }
            
            try {
                const docId = passenger.id;
                const existingDoc = await db.collection("passengers").doc(docId).get();
                
                if (existingDoc.exists) {
                    // Update existing document (without approval)
                    await db.collection("passengers").doc(docId).update(passenger.data);
                    console.log(`Updated passenger in Firebase: ${docId}`);
                } else {
                    // Create new document (without approval)
                    await db.collection("passengers").doc(docId).set(passenger.data);
                    console.log(`Added passenger to Firebase: ${docId}`);
                }
                
                // Remove from localStorage after successful sync
                removePendingQRPassenger(passenger.id);
                successCount++;
                
            } catch (error) {
                console.error(`Error syncing passenger ${passenger.id}:`, error);
                errorCount++;
                // Continue with next passenger even if one fails
            }
        }
        
        console.log(`Sync completed: ${successCount} successful, ${errorCount} failed`);
        if (successCount > 0) {
            showNotification(`Synced ${successCount} passengers to cloud`, 'success');
            // Refresh the list after sync
            fetchPendingPassengers();
        }
        
    } catch (error) {
        console.error('Error during sync:', error);
    } finally {
        localStorage.setItem(SYNC_IN_PROGRESS_KEY, 'false');
    }
}

// ----------- Check and Sync LocalStorage -----------
function checkAndSyncLocalStorage() {
    const pending = getPendingQRPassengers();
    if (pending.length > 0) {
        console.log(`Found ${pending.length} passengers in localStorage, syncing...`);
        syncPendingToFirebase();
    }
}

// ----------- Generate document ID -----------
function generateDocumentId(name, flightNo) {
    if (!name || !flightNo) {
        console.error("Name and flight number are required for document ID");
        return null;
    }
    
    // Remove spaces and special characters, convert to uppercase
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanFlight = flightNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Combine name and flight number
    return `${cleanName}_${cleanFlight}`;
}

// ----------- Fetch current shift -----------
async function fetchCurrentShift() {
    try {
        const snapshot = await db.collection("shifts").limit(1).get();
        
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            const data = snapshot.docs[0].data();
            
            // Handle date change if both shifts were closed yesterday
            if (data.date !== today && 
                data.shift1?.status === "Closed" && 
                data.shift2?.status === "Closed") {

                await docRef.update({
                    date: today,
                    "shift1.status": "Pending",
                    "shift1.openedAt": "",
                    "shift1.closedAt": "",
                    "shift2.status": "Pending",
                    "shift2.openedAt": "",
                    "shift2.closedAt": ""
                });

                data.date = today;
                data.shift1.status = "Pending";
                data.shift2.status = "Pending";
            }

            // Determine which shift is open
            let shiftLabel = "No Shift Open";
            let enableEntry = false;
            let isActive = false;
            let currentShift = "";
            let shiftOpenedAt = "";

            if (data.shift1?.status === "Open") {
                shiftLabel = "Morning Shift";
                enableEntry = true;
                isActive = true;
                currentShift = "Morning";
                shiftOpenedAt = data.shift1.openedAt || "";
            } else if (data.shift2?.status === "Open") {
                shiftLabel = "Evening Shift";
                enableEntry = true;
                isActive = true;
                currentShift = "Evening";
                shiftOpenedAt = data.shift2.openedAt || "";
            }

            shiftName.textContent = shiftLabel;
            
            // Update shift time display
            if (shiftOpenedAt) {
                shiftTime.textContent = `Opened at: ${shiftOpenedAt}`;
            } else {
                shiftTime.textContent = "";
            }

            // Update shift status display
            if (isActive) {
                shiftStatus.className = "shift-status open";
            } else {
                shiftStatus.className = "shift-status closed";
            }
        } else {
            shiftName.textContent = "No Shift Data";
            shiftStatus.className = "shift-status closed";
        }
    } catch (error) {
        console.error("Error fetching shift status:", error);
        shiftName.textContent = "Error Loading Shift";
        shiftStatus.className = "shift-status closed";
    }
}

// ----------- Fetch pending passengers -----------
async function fetchPendingPassengers() {
    try {
        // Fetch all passengers and filter those without approved field or approved: false
        const snapshot = await db.collection("passengers").get();
        
        // Filter passengers where approved field is missing or explicitly false
        const firebasePassengers = snapshot.docs
            .map(doc => ({...doc.data(), id: doc.id, source: 'firebase'}))
            .filter(passenger => 
                passenger.approved === undefined || 
                passenger.approved === false
            );
        
        // Get passengers from localStorage
        const localStoragePassengers = getPendingQRPassengers().map(p => ({
            ...p.data,
            id: p.id,
            source: 'localStorage',
            timeAdded: p.data.timeAdded || 'Local'
        }));
        
        // Combine both lists
        passengerList = [...firebasePassengers, ...localStoragePassengers];
        
        // Sort by timeAdded descending manually (newest first)
        passengerList.sort((a, b) => (b.timeAdded || '').localeCompare(a.timeAdded || ''));
        
        renderPassengers();
        console.log(`Loaded ${passengerList.length} pending passengers (${firebasePassengers.length} from Firebase, ${localStoragePassengers.length} from localStorage)`);
    } catch (error) {
        console.error("Error fetching passengers:", error);
        showNotification("Error loading passengers", "error");
    }
}

// ----------- Render passengers -----------
function renderPassengers() {
    if (passengerList.length === 0) {
        tableBody.innerHTML = "";
        emptyState.style.display = "block";
        paxCount.textContent = "0";
        return;
    }
    
    emptyState.style.display = "none";
    paxCount.textContent = passengerList.reduce((sum, p) => sum + (p.numPax || 1), 0);
    tableBody.innerHTML = "";
    
    passengerList.forEach(p => {
        const row = document.createElement("tr");
        
        // Check if this passenger has unsaved edits
        const hasUnsavedEdits = unsavedEdits.has(p.id);
        
        // Highlight localStorage entries and entries with unsaved edits
        if (p.source === 'localStorage') {
            row.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; // Light yellow background
        }
        if (hasUnsavedEdits) {
            row.style.borderLeft = '4px solid #F59E0B'; // Orange border for unsaved edits
        }
        
        // Date
        const dateTd = document.createElement("td");
        dateTd.textContent = p.date;
        row.appendChild(dateTd);
        
        // Airline
        const airlineTd = document.createElement("td");
        airlineTd.textContent = p.airline || "";
        row.appendChild(airlineTd);
        
        // Flight
        const flightTd = document.createElement("td");
        flightTd.textContent = p.flightNo || "";
        row.appendChild(flightTd);
        
        // Name - Make editable for both Firebase and localStorage
        const nameTd = document.createElement("td");
        const nameContent = document.createElement("div");
        nameContent.className = "info-box";
        nameContent.textContent = p.name || "";
        nameContent.contentEditable = true;
        
        nameContent.onblur = () => {
            const newName = nameContent.textContent;
            if (newName !== p.name) {
                // Store the edit in memory, don't save to database yet
                if (!unsavedEdits.has(p.id)) {
                    unsavedEdits.set(p.id, {});
                }
                const edits = unsavedEdits.get(p.id);
                edits.name = newName;
                unsavedEdits.set(p.id, edits);
                
                // Update visual indicator
                row.style.borderLeft = '4px solid #F59E0B';
                console.log(`Unsaved edit for ${p.id}: name`);
            }
        };
        
        nameTd.appendChild(nameContent);
        row.appendChild(nameTd);
        
        // Seat - Make editable for both
        const seatTd = document.createElement("td");
        const seatContent = document.createElement("div");
        seatContent.className = "info-box";
        seatContent.textContent = p.seatNo || "";
        seatContent.contentEditable = true;
        
        seatContent.onblur = () => {
            const newSeat = seatContent.textContent;
            if (newSeat !== p.seatNo) {
                if (!unsavedEdits.has(p.id)) {
                    unsavedEdits.set(p.id, {});
                }
                const edits = unsavedEdits.get(p.id);
                edits.seatNo = newSeat;
                unsavedEdits.set(p.id, edits);
                
                row.style.borderLeft = '4px solid #F59E0B';
                console.log(`Unsaved edit for ${p.id}: seat`);
            }
        };
        
        seatTd.appendChild(seatContent);
        row.appendChild(seatTd);
        
        // FQTV - Make editable for both
        const fqtvTd = document.createElement("td");
        const fqtvContent = document.createElement("div");
        fqtvContent.className = "info-box";
        fqtvContent.textContent = p.fqtv || "";
        fqtvContent.contentEditable = true;
        
        fqtvContent.onblur = () => {
            const newFqtv = fqtvContent.textContent;
            if (newFqtv !== p.fqtv) {
                if (!unsavedEdits.has(p.id)) {
                    unsavedEdits.set(p.id, {});
                }
                const edits = unsavedEdits.get(p.id);
                edits.fqtv = newFqtv;
                unsavedEdits.set(p.id, edits);
                
                row.style.borderLeft = '4px solid #F59E0B';
                console.log(`Unsaved edit for ${p.id}: fqtv`);
            }
        };
        
        fqtvTd.appendChild(fqtvContent);
        row.appendChild(fqtvTd);
        
        // Serial - Make editable for both
        const serialTd = document.createElement("td");
        const serialContent = document.createElement("div");
        serialContent.className = "info-box";
        serialContent.textContent = p.serial || "";
        serialContent.contentEditable = true;
        
        serialContent.onblur = () => {
            const newSerial = serialContent.textContent;
            if (newSerial !== p.serial) {
                if (!unsavedEdits.has(p.id)) {
                    unsavedEdits.set(p.id, {});
                }
                const edits = unsavedEdits.get(p.id);
                edits.serial = newSerial;
                unsavedEdits.set(p.id, edits);
                
                row.style.borderLeft = '4px solid #F59E0B';
                console.log(`Unsaved edit for ${p.id}: serial`);
            }
        };
        
        serialTd.appendChild(serialContent);
        row.appendChild(serialTd);
        
        // Remarks - Make editable for both
        const remarksTd = document.createElement("td");
        const remarksContent = document.createElement("div");
        remarksContent.className = "info-box";
        remarksContent.textContent = p.remarks || "";
        remarksContent.contentEditable = true;
        
        remarksContent.onblur = () => {
            const newRemarks = remarksContent.textContent;
            if (newRemarks !== p.remarks) {
                if (!unsavedEdits.has(p.id)) {
                    unsavedEdits.set(p.id, {});
                }
                const edits = unsavedEdits.get(p.id);
                edits.remarks = newRemarks;
                unsavedEdits.set(p.id, edits);
                
                row.style.borderLeft = '4px solid #F59E0B';
                console.log(`Unsaved edit for ${p.id}: remarks`);
            }
        };
        
        remarksTd.appendChild(remarksContent);
        row.appendChild(remarksTd);
        
        // Pax - Make editable for both
        const paxTd = document.createElement("td");
        const paxContent = document.createElement("div");
        paxContent.className = "info-box";
        paxContent.textContent = p.numPax || 1;
        paxContent.contentEditable = true;
        
        paxContent.onblur = () => {
            const newPax = parseInt(paxContent.textContent) || 1;
            if (newPax !== p.numPax) {
                if (!unsavedEdits.has(p.id)) {
                    unsavedEdits.set(p.id, {});
                }
                const edits = unsavedEdits.get(p.id);
                edits.numPax = newPax;
                unsavedEdits.set(p.id, edits);
                
                row.style.borderLeft = '4px solid #F59E0B';
                console.log(`Unsaved edit for ${p.id}: numPax`);
            }
        };
        
        paxTd.appendChild(paxContent);
        row.appendChild(paxTd);
        
        // Time Added
        const timeTd = document.createElement("td");
        timeTd.textContent = p.timeAdded || "";
        row.appendChild(timeTd);
        
        // Status
        const statusTd = document.createElement("td");
        const statusBadge = document.createElement("span");
        if (p.source === 'localStorage') {
            statusBadge.className = "status-badge";
            statusBadge.style.background = "rgba(59, 130, 246, 0.1)";
            statusBadge.style.color = "#1E3A8A";
            statusBadge.textContent = hasUnsavedEdits ? "Local*" : "Local";
            statusBadge.title = hasUnsavedEdits ? "Saved locally with unsaved edits" : "Saved locally - click to sync now";
            statusBadge.style.cursor = "pointer";
            statusBadge.onclick = () => {
                checkAndSyncLocalStorage();
                showNotification("Syncing local data to cloud...", "success");
            };
        } else {
            statusBadge.className = "status-badge status-pending";
            statusBadge.textContent = hasUnsavedEdits ? "Pending*" : "Pending";
            statusBadge.title = hasUnsavedEdits ? "Pending approval with unsaved edits" : "Pending approval";
        }
        statusTd.appendChild(statusBadge);
        row.appendChild(statusTd);
        
        // Actions - Show for both Firebase and localStorage
        const actionTd = document.createElement("td");
        actionTd.className = "actions-cell";
        
        // Approve button - works for both
        const approveBtn = document.createElement("button");
        approveBtn.className = "icon-btn approve-btn";
        approveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        approveBtn.title = hasUnsavedEdits ? "Save edits and approve passenger" : "Approve passenger";
        
        approveBtn.onclick = async () => {
            try {
                const edits = unsavedEdits.get(p.id);
                const finalData = edits ? { ...p, ...edits } : p;
                
                if (p.source === 'firebase') {
                    // Save edits and approve in Firebase
                    await db.collection("passengers").doc(p.id).update({
                        ...edits,
                        approved: true,
                        approvedAt: new Date().toISOString()
                    });
                    showNotification("Passenger approved successfully", "success");
                } else {
                    // For localStorage, save to Firebase with approval
                    const approvedPassenger = {
                        ...finalData,
                        approved: true,
                        approvedAt: new Date().toISOString()
                    };
                    
                    // Remove from localStorage first
                    removePendingQRPassenger(p.id);
                    
                    // Save to Firebase with approval
                    await db.collection("passengers").doc(p.id).set(approvedPassenger);
                    showNotification("Passenger approved and saved to cloud", "success");
                }
                
                // Clear unsaved edits
                unsavedEdits.delete(p.id);
                
                // Refresh the list
                fetchPendingPassengers();
                
            } catch (error) {
                console.error("Error approving passenger:", error);
                showNotification("Error approving passenger", "error");
            }
        };
        actionTd.appendChild(approveBtn);
        
        // Delete button - works for both
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn delete-btn";
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
        deleteBtn.title = "Delete passenger";
        deleteBtn.onclick = async () => {
            if (confirm("Are you sure you want to delete this passenger?")) {
                try {
                    if (p.source === 'firebase') {
                        await db.collection("passengers").doc(p.id).delete();
                        showNotification("Passenger deleted successfully", "success");
                    } else {
                        removePendingQRPassenger(p.id);
                        showNotification("Passenger deleted from local storage", "success");
                    }
                    
                    // Clear unsaved edits if any
                    unsavedEdits.delete(p.id);
                    
                    // Refresh the list
                    fetchPendingPassengers();
                } catch (error) {
                    console.error("Error deleting passenger:", error);
                    showNotification("Error deleting passenger", "error");
                }
            }
        };
        actionTd.appendChild(deleteBtn);
        
        row.appendChild(actionTd);
        tableBody.appendChild(row);
    });
}

// ---------- QR PARSER (Remove Last 6 Letters from Name) ----------
function parseQR(code) {
    code = code.trim().toUpperCase().replace(/\s+/g, ' ');
    let name = "", flightNo = "", seatNo = "", fqtv = "";
    const allParts = code.split(' ');

    if (code.startsWith("TKVCPO")) {
        const tkIndex = code.indexOf("TK0");
        if (tkIndex != -1) { 
            flightNo = code.substring(tkIndex, tkIndex + 6); 
            name = code.substring(6, tkIndex).trim();
        }
        const mlePos = code.indexOf("MLE");
        if (mlePos != -1) { 
            const afterMLE = code.substring(mlePos).split(' ')[0]; 
            if (afterMLE.length >= 11) seatNo = afterMLE.substring(8, 11); 
        }
    } else {
        // ----- NAME FIX -----
        const mleIndex = allParts.findIndex(w => w.includes("MLE"));
        if (mleIndex > 0) {
            // Join everything from the first word (without "M1") up to before "MLE"
            let nameParts = allParts.slice(0, mleIndex);
            nameParts[0] = nameParts[0].substring(2); // remove "M1"
            name = nameParts.join(' ').trim();
        } else {
            name = allParts[0].substring(2); // fallback
        }

        // ----- REMOVE LAST 6 CHARACTERS FROM NAME -----
        if (name.length > 6) {
            name = name.substring(0, name.length - 6).trim();
        }

        // ----- FLIGHT / SEAT -----
        if (mleIndex != -1) {
            const mleWord = allParts[mleIndex];
            const nextWord = (mleIndex + 1 < allParts.length) ? allParts[mleIndex + 1] : "";
            flightNo = mleWord.slice(-2) + nextWord;
            const partsAfterMLE = allParts.slice(mleIndex + 1);
            for (let w of partsAfterMLE) { 
                if (w.length >= 9 && !w.includes("QR") && !w.includes("MLE")) { 
                    seatNo = w.substring(5, w.length - 4); 
                    break; 
                }
            }
        }
    }

    // ----- FQTV DETECTION -----
    fqtv = detectFQTVDynamic(allParts, flightNo);

    console.log("QR Parser Result:", { name, flightNo, seatNo, fqtv });
    return { name, flightNo, seatNo, fqtv };
}



// ---------- FQTV DETECTOR ----------
function detectFQTVDynamic(parts, flightNo) {
    if (!flightNo || flightNo.length < 2) return "";
    
    const airlineCode = flightNo.substring(0, 2).toUpperCase();
    let fqtv = "";

    // Method 1: Look for airline code followed by numbers
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === airlineCode && /^\d+$/.test(parts[i + 1] || "")) {
            fqtv = `${airlineCode}-${parts[i + 1]}`;
            
            // Check for status codes
            const lastPart = parts[parts.length - 1];
            if (lastPart.endsWith("Y1") || lastPart.endsWith("N1")) {
                fqtv += "/G"; // Gold status
            } else if (lastPart.endsWith("N2")) {
                fqtv += "/S"; // Silver status
            }
            break;
        }
    }

    // Method 2: Look for FQTV patterns in the text
    if (!fqtv) {
        const fqtvPattern = new RegExp(`${airlineCode}\\s*(\\d+)`, 'i');
        const match = parts.join(' ').match(fqtvPattern);
        if (match) {
            fqtv = `${airlineCode}-${match[1]}`;
        }
    }

    // Method 3: Look for common FQTV formats
    if (!fqtv) {
        for (let part of parts) {
            // Pattern: XX123456789 (airline code followed by numbers)
            const pattern = /^([A-Z]{2})(\d{6,12})$/;
            const match = part.match(pattern);
            if (match && match[1] === airlineCode) {
                fqtv = `${match[1]}-${match[2]}`;
                break;
            }
        }
    }

    console.log("FQTV Detection Result:", fqtv);
    return fqtv;
}

// ---------- Add passenger WITHOUT approval (for both QR and manual entries) ----------
async function addPendingPassenger() {
    if (!nameField.value || !seatField.value || !flightField.value) {
        showNotification("Name, Seat, and Flight Number are required", "error");
        return;
    }

    // Get current time in 24-hour format
    const now = new Date();
    const timeAdded = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const passengerData = {
        date: form.date.value,
        flightNo: flightField.value,
        airline: airlineField.value,
        name: nameField.value,
        seatNo: seatField.value,
        fqtv: fqtvField.value,
        serial: serialField.value,
        remarks: remarksField.value,
        numPax: parseInt(numPaxField.value) || 1,
        timeAdded: timeAdded
        // Don't include approved field - it's implied as not approved
    };

    // DEBUG: Log passenger data before saving
    console.log("Saving passenger data:", passengerData);

    try {
        // Generate document ID using passenger name and flight number
        const docId = generateDocumentId(nameField.value, flightField.value);
        
        if (!docId) {
            showNotification("Error: Name and Flight Number are required", "error");
            return;
        }

        // Save to localStorage first for instant response
        const pendingPassenger = {
            id: docId,
            data: passengerData,
            timestamp: new Date().toISOString()
        };

        console.log("Saving to localStorage:", pendingPassenger);

        if (savePendingQRPassenger(pendingPassenger)) {
            showNotification("Passenger saved locally - pending approval", "success");
            
            // Immediately reset form for next entry
            quickResetForm();
            
            // Update the list to show locally saved passengers
            await fetchPendingPassengers();
            
            // Check and sync localStorage after a short delay
            setTimeout(checkAndSyncLocalStorage, 1000);
        } else {
            showNotification("Error saving passenger locally", "error");
        }
        
    } catch (error) {
        console.error("Error processing passenger:", error);
        showNotification("Error processing passenger", "error");
    }
}

// ---------- Quick reset form function ----------
function quickResetForm() {
    // Clear only the main fields, keep date and numPax
    nameField.value = "";
    seatField.value = "";
    flightField.value = "";
    airlineField.value = "";
    fqtvField.value = "";
    serialField.value = "";
    remarksField.value = "";
    qrInput.value = "";
    
    // Keep numPax as 1 for next entry
    numPaxField.value = 1;
    
    // Immediately focus on QR input for next scan
    setTimeout(() => {
        qrInput.focus();
    }, 50);
}

// ---------- Airline detection ----------
function getAirline(flightNo) {
    if (!flightNo || flightNo.length < 2) return "Unknown";
    
    const airlineCode = flightNo.substring(0, 2).toUpperCase();
    
    const iataAirlines = {
        "BA": "British Airways",
        "TK": "Turkish Airlines",
        "QR": "Qatar Airways",
        "EK": "Emirates",
        "EY": "Etihad Airways",
        "LH": "Lufthansa",
        "AF": "Air France",
        "KL": "KLM",
        "AA": "American Airlines",
        "UA": "United Airlines",
        "DL": "Delta Air Lines",
        "SQ": "Singapore Airlines",
        "CX": "Cathay Pacific",
        "NH": "All Nippon Airways",
        "JL": "Japan Airlines",
        "KE": "Korean Air",
        "PG": "Bangkok Airways",
        "TG": "Thai Airways",
        "MH": "Malaysia Airlines",
        "GA": "Garuda Indonesia",
        "QF": "Qantas",
        "NZ": "Air New Zealand",
        "AI": "Air India",
        "LX": "Swiss International Air Lines",
        "OS": "Austrian Airlines",
        "SN": "Brussels Airlines",
        "SK": "SAS Scandinavian Airlines",
        "AY": "Finnair",
        "LO": "LOT Polish Airlines",
        "SU": "Aeroflot",
        "AZ": "Alitalia",
        "IB": "Iberia",
        "Q2": "Maldivian",
        "SV": "Saudia",
        "ET": "Ethiopian Airlines",
        "MS": "EgyptAir",
        "G9": "Indigo",
        "OD": "Batik Air",
        "JD": "Beijing Capital Airlines",
    };
    
    return iataAirlines[airlineCode] || "Unknown";
}

// ---------- Notification ----------
function showNotification(message, type) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add("show");
    
    setTimeout(() => {
        notification.classList.remove("show");
    }, 3000);
}

// ---------- Event Listeners ----------

// Manual QR input handling - optimized for quick entry
qrInput.addEventListener("change", async () => {
    if (!qrInput.value.trim()) return;
    
    isQREntry = true;
    
    const parsed = parseQR(qrInput.value);
    
    console.log("QR Parsed Data:", parsed);
    
    if (parsed.name) nameField.value = parsed.name;
    if (parsed.flightNo) {
        flightField.value = parsed.flightNo;
        airlineField.value = getAirline(parsed.flightNo);
    }
    if (parsed.seatNo) seatField.value = parsed.seatNo;
    if (parsed.fqtv) fqtvField.value = parsed.fqtv; // FQTV POPULATION ADDED
    
    // Auto-submit immediately after QR scan (without approval)
    await addPendingPassenger();
});

// Also add Enter key support for QR input
qrInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
        await addPendingPassenger();
    }
});

// On flightNo input, update airline automatically
flightField.addEventListener("input", () => {
    const airline = getAirline(flightField.value);
    airlineField.value = airline;
});

// Form submit - prevent default and handle async
form.addEventListener("submit", async e => {
    e.preventDefault();
    isQREntry = false;
    // When form is submitted via button, also go to pending list (no auto-approve)
    await addPendingPassenger();
});

// Clear form button - optimized for quick reset
clearBtn.addEventListener("click", () => {
    quickResetForm();
    showNotification("Form cleared", "success");
});

// Floating button event listeners
dashboardBtn.addEventListener("click", () => {
    window.location.href = "dashboard.html";
});

reportBtn.addEventListener("click", () => {
    window.location.href = "updateCard.html";
});

// ---------- Wait for Firebase to be ready ----------
document.addEventListener('DOMContentLoaded', function() {
    // Check if db is available (from fireC.js)
    if (typeof db !== 'undefined') {
        console.log("Firebase initialized successfully");
        
        // Initial fetch
        fetchCurrentShift();
        fetchPendingPassengers();

        // Check and sync localStorage on startup
        setTimeout(() => {
            checkAndSyncLocalStorage();
        }, 2000);

        // Real-time listener for instant updates
        db.collection("passengers")
            .onSnapshot((snapshot) => {
                console.log("Real-time update - all passengers:", snapshot.docs.length);
                fetchPendingPassengers(); // Refresh the combined list
            }, (error) => {
                console.error("Error in real-time listener:", error);
            });

    } else {
        console.error("Firebase not initialized. Please check fireC.js");
        showNotification("Database connection error", "error");
    }
});

// Sync when window gains focus
window.addEventListener('focus', () => {
    checkAndSyncLocalStorage();
});

// Sync when network connection is restored
window.addEventListener('online', () => {
    checkAndSyncLocalStorage();

});
