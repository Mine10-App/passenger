// Elements
const tableBody = document.getElementById("tableBody");
const filterDate = document.getElementById("filterDate");
const filterFlight = document.getElementById("filterFlight");
const emptyState = document.getElementById("emptyState");
const passengerCount = document.getElementById("passengerCount");
const firstPaxTimeInput = document.getElementById("firstPaxTimeInput");
const stdTimeInput = document.getElementById("stdTimeInput");
const lastPaxTimeInput = document.getElementById("lastPaxTimeInput");
const toggleFlightBtn = document.getElementById("toggleFlightBtn");
const flightStatusBadge = document.getElementById("flightStatusBadge");
const printBtn = document.getElementById("printBtn");
const closedWarning = document.getElementById("closedWarning");
const companyLogo = document.getElementById("companyLogo");
const companyName = document.getElementById("companyName");
const loggedInUserElement = document.getElementById("loggedInUser");

let passengers = [], flightDocId = null, flightStatus = "Open", flightListener = null;
let loggedInUserName = "Loading...";
let autoSaveTimeout = null;
let currentFlightNumber = '';

// Default date
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth()+1).padStart(2,'0');
const dd = String(today.getDate()).padStart(2,'0');
filterDate.value = `${yyyy}-${mm}-${dd}`;

// Time format validation
function setupTimeInputs() {
    const timeInputs = [firstPaxTimeInput, stdTimeInput, lastPaxTimeInput];
    
    timeInputs.forEach(input => {
        // Auto-format as user types
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            
            if (value.length > 4) {
                value = value.substring(0, 4);
            }
            
            if (value.length >= 3) {
                e.target.value = value.substring(0, 2) + ':' + value.substring(2);
            } else {
                e.target.value = value;
            }
            
            // Auto-save after user stops typing (1 second delay)
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(saveFlightTimes, 1000);
        });
        
        // Validate on blur
        input.addEventListener('blur', function(e) {
            const value = e.target.value;
            if (value && !isValidTime(value)) {
                alert('Please enter a valid time in 24-hour format (HH:MM)');
                e.target.focus();
            } else if (value) {
                // Format with leading zeros
                const [hours, minutes] = value.split(':');
                const formattedHours = hours.padStart(2, '0');
                const formattedMinutes = minutes.padStart(2, '0');
                e.target.value = `${formattedHours}:${formattedMinutes}`;
                
                // Save immediately on blur
                saveFlightTimes();
            }
        });
    });
}

// Validate time format (HH:MM)
function isValidTime(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}

// Check if user is logged in from localStorage
function checkAuthState() {
    const userData = localStorage.getItem('loggedInUser');
    
    if (userData) {
        // User is logged in
        const user = JSON.parse(userData);
        loggedInUserName = user.name || user.email || "User";
        loggedInUserElement.textContent = loggedInUserName;
        
        // Initialize the rest of the app
        initializeCompanyInfo();
        populateFlights();
        setupTimeInputs();
    } else {
        // User is not logged in, redirect to login
        window.location.href = "login.html";
    }
}

// Initialize company info
function initializeCompanyInfo() {
    if (typeof companyInfo !== 'undefined' && companyInfo.name) {
        companyName.textContent = companyInfo.name;
        if (companyInfo.logo) {
            companyLogo.textContent = companyInfo.logo.charAt(0).toUpperCase();
        }
    } else {
        companyName.textContent = "Airline Management";
        companyLogo.textContent = "A";
    }
}

// Populate flights
async function populateFlights() {
    const dateVal = filterDate.value;
    if (!dateVal) return;
    
    try {
        const snapshot = await db.collection("passengers").where("date", "==", dateVal).get();
        const flights = [...new Set(snapshot.docs.map(doc => doc.data().flightNo))];
        
        filterFlight.innerHTML = '<option value="">Select Flight</option>';
        flights.forEach(f => {
            const option = document.createElement("option");
            option.value = f;
            option.textContent = f;
            filterFlight.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching flights:", error);
        // Fallback to demo data if Firebase fails
        const flights = ["EK0653", "QR0642", "UL0417", "SG0109", "AA0123", "UA0456"];
        filterFlight.innerHTML = '<option value="">Select Flight</option>';
        flights.forEach(f => {
            const option = document.createElement("option");
            option.value = f;
            option.textContent = f;
            filterFlight.appendChild(option);
        });
    }
}

// Find earliest check-in time from passengers
function findEarliestCheckinTime() {
    if (passengers.length === 0) return null;
    
    // Filter only approved passengers
    const approvedPassengers = passengers.filter(p => p.approved === true);
    if (approvedPassengers.length === 0) return null;
    
    // Find the earliest timeAdded
    let earliestTime = null;
    approvedPassengers.forEach(p => {
        if (p.timeAdded) {
            if (!earliestTime || p.timeAdded < earliestTime) {
                earliestTime = p.timeAdded;
            }
        }
    });
    
    return earliestTime;
}

// Listen flight info
function listenFlightInfo(dateVal, flightVal) {
    if (flightListener) flightListener();
    
    if (!dateVal || !flightVal) {
        flightStatus = "Open";
        stdTimeInput.value = lastPaxTimeInput.value = firstPaxTimeInput.value = "";
        updateFlightButtonLabel();
        return;
    }
    
    try {
        flightListener = db.collection("flightInfo")
            .where("date", "==", dateVal)
            .where("flightNo", "==", flightVal)
            .limit(1)
            .onSnapshot(snapshot => {
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    flightDocId = snapshot.docs[0].id;
                    flightStatus = data.status || "Open";
                    stdTimeInput.value = data.std || "";
                    lastPaxTimeInput.value = data.lastPaxLeft || "";
                    
                    // Only set first passenger time if it's not already set in Firebase
                    // Otherwise, use the earliest timeAdded from passengers
                    if (data.firstPax) {
                        firstPaxTimeInput.value = data.firstPax;
                    } else {
                        const earliestTime = findEarliestCheckinTime();
                        if (earliestTime) {
                            firstPaxTimeInput.value = earliestTime;
                        } else {
                            firstPaxTimeInput.value = "";
                        }
                    }
                    
                    updateFlightButtonLabel();
                } else {
                    flightDocId = null;
                    flightStatus = "Open";
                    stdTimeInput.value = lastPaxTimeInput.value = "";
                    
                    // Set first passenger time from earliest timeAdded
                    const earliestTime = findEarliestCheckinTime();
                    firstPaxTimeInput.value = earliestTime || "";
                    
                    updateFlightButtonLabel();
                }
            }, error => {
                console.error("Error listening to flight info:", error);
                // Fallback if Firebase fails
                flightStatus = "Open";
                stdTimeInput.value = "14:30";
                lastPaxTimeInput.value = "14:15";
                
                // Set first passenger time from earliest timeAdded
                const earliestTime = findEarliestCheckinTime();
                firstPaxTimeInput.value = earliestTime || "12:45";
                
                updateFlightButtonLabel();
            });
    } catch (error) {
        console.error("Error setting up flight listener:", error);
    }
}

// Render table - Only show approved transactions
function renderTable() {
    tableBody.innerHTML = "";
    
    // Filter to show only approved passengers
    const approvedPassengers = passengers.filter(p => p.approved === true);
    
    if (approvedPassengers.length === 0) {
        emptyState.style.display = "block";
        passengerCount.textContent = "0 Passengers";
        return;
    }
    
    emptyState.style.display = "none";
    passengerCount.textContent = `${approvedPassengers.length} Passenger${approvedPassengers.length !== 1 ? 's' : ''}`;
    
    approvedPassengers.forEach((p, index) => {
        const row = document.createElement("tr");
        
        // Use timeAdded instead of checkinTime
        ["name", "seatNo", "numPax", "flightNo", "airline", "fqtv", "serial", "timeAdded"].forEach(field => {
            const td = document.createElement("td");
            const content = document.createElement("div");
            content.className = "editable-cell";
            content.textContent = p[field] || "";
            content.contentEditable = false;
            td.appendChild(content);
            row.appendChild(td);
        });
        
        const actionsTd = document.createElement("td");
        actionsTd.className = "actions-cell";
        
        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn edit-btn";
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        let editing = false;
        
        editBtn.onclick = () => {
            if (flightStatus === "Closed") {
                alert("Flight is closed. Editing not allowed.");
                return;
            }
            
            editing = !editing;
            row.querySelectorAll(".editable-cell").forEach(c => c.contentEditable = editing);
            editBtn.innerHTML = editing ? '<i class="fas fa-save"></i>' : '<i class="fas fa-edit"></i>';
            
            if (!editing) {
                // Save changes to Firebase - use timeAdded instead of checkinTime
                try {
                    db.collection("passengers").doc(p.id).update({
                        name: row.children[0].textContent,
                        seatNo: row.children[1].textContent,
                        numPax: parseInt(row.children[2].textContent) || 1,
                        flightNo: row.children[3].textContent,
                        airline: row.children[4].textContent,
                        fqtv: row.children[5].textContent,
                        serial: row.children[6].textContent,
                        timeAdded: row.children[7].textContent  // Updated to timeAdded
                    });
                } catch (error) {
                    console.error("Error updating passenger:", error);
                    alert("Error updating passenger. Please try again.");
                }
            }
        };
        
        actionsTd.appendChild(editBtn);
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn delete-btn";
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        
        deleteBtn.onclick = () => {
            if (flightStatus === "Closed") {
                alert("Flight is closed. Cannot delete.");
                return;
            }
            
            if (confirm("Are you sure you want to delete this passenger?")) {
                try {
                    db.collection("passengers").doc(p.id).delete();
                    passengers = passengers.filter(pass => pass.id !== p.id);
                    renderTable();
                } catch (error) {
                    console.error("Error deleting passenger:", error);
                    alert("Error deleting passenger. Please try again.");
                }
            }
        };
        
        actionsTd.appendChild(deleteBtn);
        row.appendChild(actionsTd);
        tableBody.appendChild(row);
    });
}

// Flight button label & status
function updateFlightButtonLabel() {
    // Updated button text and icon based on flight status
    if (flightStatus === "Open") {
        toggleFlightBtn.innerHTML = '<i class="fas fa-lock-open"></i> Flight Open';
        toggleFlightBtn.className = "btn btn-success";
    } else {
        toggleFlightBtn.innerHTML = '<i class="fas fa-lock"></i> Flight Closed';
        toggleFlightBtn.className = "btn btn-danger";
    }
    
    flightStatusBadge.textContent = `Status: ${flightStatus}`;
    flightStatusBadge.className = `status-badge ${flightStatus === "Open" ? "status-open" : "status-closed"}`;
    printBtn.disabled = flightStatus !== "Closed";
    closedWarning.style.display = flightStatus === "Closed" ? "flex" : "none";
}

// Save flight times automatically
async function saveFlightTimes() {
    if (!filterFlight.value) {
        return;
    }
    
    // Validate times
    const times = [firstPaxTimeInput.value, lastPaxTimeInput.value, stdTimeInput.value];
    for (let time of times) {
        if (time && !isValidTime(time)) {
            return; // Don't save invalid times
        }
    }
    
    try {
        if (flightDocId) {
            // Update existing flight info
            await db.collection("flightInfo").doc(flightDocId).update({
                std: stdTimeInput.value,
                firstPax: firstPaxTimeInput.value,
                lastPaxLeft: lastPaxTimeInput.value
            });
        } else {
            // Create new flight info
            const docRef = await db.collection("flightInfo").add({
                date: filterDate.value,
                flightNo: filterFlight.value,
                status: "Open",
                std: stdTimeInput.value,
                firstPax: firstPaxTimeInput.value,
                lastPaxLeft: lastPaxTimeInput.value
            });
            flightDocId = docRef.id;
        }
        
        console.log("Flight times saved automatically");
    } catch (error) {
        console.error("Error saving flight times:", error);
    }
}

// Toggle flight
function setupToggleFlightButton() {
    toggleFlightBtn.onclick = async () => {
        if (!filterFlight.value) {
            alert("No flight selected");
            return;
        }
        
        if (flightStatus === "Open") {
            // Validate times before closing flight
            const times = [firstPaxTimeInput.value, lastPaxTimeInput.value, stdTimeInput.value];
            for (let time of times) {
                if (time && !isValidTime(time)) {
                    alert(`Please enter a valid time in 24-hour format (HH:MM) for all time fields.`);
                    return;
                }
            }
            
            if (!firstPaxTimeInput.value || !lastPaxTimeInput.value || !stdTimeInput.value) {
                alert("Cannot close flight. Enter First Passenger, Last Passenger, and STD.");
                return;
            }
        }
        
        const newStatus = flightStatus === "Open" ? "Closed" : "Open";
        
        try {
            if (flightDocId) {
                // Update existing flight info
                await db.collection("flightInfo").doc(flightDocId).update({
                    status: newStatus,
                    std: stdTimeInput.value,
                    firstPax: firstPaxTimeInput.value,
                    lastPaxLeft: lastPaxTimeInput.value
                });
            } else {
                // Create new flight info
                const docRef = await db.collection("flightInfo").add({
                    date: filterDate.value,
                    flightNo: filterFlight.value,
                    status: newStatus,
                    std: stdTimeInput.value,
                    firstPax: firstPaxTimeInput.value,
                    lastPaxLeft: lastPaxTimeInput.value
                });
                flightDocId = docRef.id;
            }
            
            flightStatus = newStatus;
            updateFlightButtonLabel();
        } catch (error) {
            console.error("Error updating flight status:", error);
            alert("Error updating flight status. Please try again.");
        }
    };
}

// Flight selection handler
function setupFlightSelection() {
    filterFlight.addEventListener('change', async function() {
        const dateVal = filterDate.value;
        const flightVal = this.value;
        currentFlightNumber = flightVal;
        
        if (!dateVal || !flightVal) {
            tableBody.innerHTML = "";
            passengers = [];
            renderTable();
            return;
        }
        
        // Set default STD times based on flight number patterns
        setDefaultSTD(flightVal);
        
        // Rest of your existing code...
        try {
            const snapshot = await db.collection("passengers")
                .where("date", "==", dateVal)
                .where("flightNo", "==", flightVal)
                .get();
                
            passengers = snapshot.docs.map(doc => ({...doc.data(), id: doc.id}));
            renderTable();
            listenFlightInfo(dateVal, flightVal);
        } catch (error) {
            console.error("Error fetching passengers:", error);
            passengers = getDemoPassengers(flightVal);
            renderTable();
            listenFlightInfo(dateVal, flightVal);
        }
    });
}

// Set default STD based on flight number patterns
function setDefaultSTD(flightNumber) {
    // Common airline patterns and typical departure times
    const airlinePatterns = {
        'EK': '23:00',  // Emirates - typically evening/night
        'QR': '09:00',  // Qatar Airways - morning
        'UL': '14:00',  // SriLankan Airlines - afternoon
        'SG': '18:00',  // SpiceJet - evening
        'IX': '20:00',  // Air India Express - night
        'AA': '10:00',  // American Airlines - morning
        'UA': '11:00',  // United Airlines - late morning
        'DL': '12:00'   // Delta Airlines - noon
    };
    
    const airlineCode = flightNumber.substring(0, 2).toUpperCase();
    
    if (airlinePatterns[airlineCode] && !stdTimeInput.value) {
        stdTimeInput.value = airlinePatterns[airlineCode];
        showNotification(`Default STD set to ${airlinePatterns[airlineCode]} for ${airlineCode} flights`, 'info');
    }
}

// Enhanced demo data with realistic flight numbers - updated to use timeAdded
function getDemoPassengers(flightVal) {
    // Extract airline code for realistic demo data
    const airlineCode = flightVal.substring(0, 2).toUpperCase();
    const airlines = {
        'EK': 'Emirates',
        'QR': 'Qatar Airways',
        'UL': 'SriLankan Airlines',
        'SG': 'SpiceJet',
        'IX': 'Air India Express',
        'AA': 'American Airlines',
        'UA': 'United Airlines',
        'DL': 'Delta Airlines'
    };
    
    const airlineName = airlines[airlineCode] || 'Airline';
    
    return [
        {
            id: "demo1",
            name: "John Smith",
            seatNo: "12A",
            numPax: 1,
            flightNo: flightVal,
            airline: airlineName,
            fqtv: "Yes",
            serial: "001",
            timeAdded: "12:45",  // Updated to timeAdded
            approved: true
        },
        {
            id: "demo2",
            name: "Maria Garcia",
            seatNo: "15B",
            numPax: 2,
            flightNo: flightVal,
            airline: airlineName,
            fqtv: "No",
            serial: "002",
            timeAdded: "13:20",  // Updated to timeAdded
            approved: true
        }
    ];
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) {
        // Create notification element if it doesn't exist
        const notificationEl = document.createElement('div');
        notificationEl.id = 'notification';
        notificationEl.className = 'notification';
        document.body.appendChild(notificationEl);
    }
    
    const notificationElement = document.getElementById('notification');
    notificationElement.textContent = message;
    notificationElement.className = `notification ${type} show`;
    
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, 3000);
}

// Print report function
// Print report function - UPDATED VERSION
function setupPrintButton() {
    printBtn.addEventListener("click", () => {
        console.log("Print button clicked"); // Debug log
        
        if (flightStatus !== "Closed") {
            alert("You must close the flight before printing the report.");
            return;
        }

        // Filter to show only approved passengers
        const approvedPassengers = passengers.filter(p => p.approved === true);
        
        if (approvedPassengers.length === 0) { 
            alert("No approved passengers to print!"); 
            return; 
        }

        const flightNo = filterFlight.value;
        const dateVal = filterDate.value;
        const std = stdTimeInput.value || "--:--";
        const firstPax = firstPaxTimeInput.value || "--:--";
        const lastPax = lastPaxTimeInput.value || "--:--";
        
        const shift = approvedPassengers.length > 0 ? approvedPassengers[0].shift || "--" : "--";
        const airline = approvedPassengers.length > 0 ? approvedPassengers[0].airline || "--" : "--";
        const totalPax = approvedPassengers.reduce((sum, p) => sum + (p.numPax || 0), 0);

        // Get company info
        const companyName = companyInfo?.name || "Company Name";
        const companyaddress = companyInfo?.address || "Company Address";
        const companyphone = companyInfo?.phone || "Company Phone";

        // Format date to dd/mm/yyyy
        const dateObj = new Date(dateVal);
        const formattedDate = 
            String(dateObj.getDate()).padStart(2, '0') + '/' +
            String(dateObj.getMonth() + 1).padStart(2, '0') + '/' +
            dateObj.getFullYear();

        // Create print window
        let printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert("Popup blocked! Please allow popups for this site to print the report.");
            return;
        }

        let html = `<!DOCTYPE html>
<html>
<head>
    <title>Flight ${flightNo} Report</title>
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #2c3e50;
            font-size: 12px;
            line-height: 1.4;
            background: white;
        }
        .print-container { 
            max-width: 100%; 
            margin: 0 auto;
        }
        .header-section { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 3px solid #3498db;
        }
        .company-info { 
            flex: 1;
        }
        .company-header {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 15px;
            text-align: left;
        }
        .company-logo {
            width: 50px;
            height: 50px;
            background: #3498db;
            border-radius: 20%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 20px;
            margin-bottom: 10px;
        }
        .company-name { 
            font-size: 22px; 
            font-weight: bold; 
            color: #2c3e50;
            margin-bottom: 3px;
        }
        .company-details {
            font-size: 11px;
            color: #7f8c8d;
            line-height: 1.4;
        }
        .flight-info { 
            text-align: right;
            flex: 1;
        }
        .flight-details-left {
            margin-bottom: 12px;
            padding: 12px;
            background: #ffffff;
            border-radius: 6px;
            text-align: left;
        }
        .flight-details-right {
            padding: 12px;
            background: #ffffff;
            border-radius: 6px;
            text-align: left;
            margin-top: 130px; /* More space above */
        }
        .detail-label {
            font-weight: 600;
            color: #34495e;
            display: inline-block;
            width: 120px;
        }
        .detail-value {
            color: #2c3e50;
        }
        .passenger-table {
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
            font-size: 11px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .passenger-table th { 
            background: #3498db; 
            color: white; 
            padding: 10px 8px; 
            text-align: left; 
            border: 1px solid #2980b9;
            font-weight: 600;
            font-size: 11px;
        }
        .passenger-table td { 
            padding: 8px; 
            border: 1px solid #bdc3c7; 
            font-size: 10px;
        }
        .passenger-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        .total-row {
            font-weight: bold;
            background: #e8f4fd !important;
            font-size: 11px;
        }
        .footer-section { 
            margin-top: 25px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 10px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            color: #7f8c8d;
        }
        .disclaimer {
            margin-top: 15px;
            padding: 10px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            font-size: 10px;
            text-align: center;
            color: #856404;
        }
        .signature-area {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
        }
        .signature-line {
            border-top: 1px solid #333;
            width: 200px;
            padding-top: 5px;
            font-size: 10px;
            text-align: center;
        }
        @media print {
            body { 
                margin: 0; 
                padding: 15px;
            }
            .print-container { 
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="print-container">
        <div class="header-section">
            <div class="company-info">
                <div class="company-header">
                    <img src="macl.png" alt="Company Logo" style="height:60px;">
                    <div class="company-name">${companyName}</div>
                    <div class="company-details">
                        ${companyaddress}<br>
                        ${companyphone}
                    </div>
                </div>
                <div class="flight-details-left">
                    <div><span class="detail-label">Airline:</span> <span class="detail-value">${airline}</span></div>
                    <div><span class="detail-label">Flight No:</span> <span class="detail-value">${flightNo}</span></div>
                    <div><span class="detail-label">Date:</span> <span class="detail-value">${formattedDate}</span></div>
                </div>
            </div>
            <div class="flight-info">
                <div class="flight-details-right">
                    <div><span class="detail-label">STD:</span> <span class="detail-value">${std}</span></div>
                    <div><span class="detail-label">First Pax Enter:</span> <span class="detail-value">${firstPax}</span></div>
                    <div><span class="detail-label">Last Pax Left:</span> <span class="detail-value">${lastPax}</span></div>
                    <div><span class="detail-label">Shift:</span> <span class="detail-value">${shift}</span></div>
                </div>
            </div>
        </div>

        <table class="passenger-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Seat No</th>
                    <th>Pax</th>
                    <th>FQTV</th>
                    <th>Serial No</th>
                    
                </tr>
            </thead>
            <tbody>`;

        approvedPassengers.forEach(p => {
            html += `<tr>
                <td>${p.name || ""}</td>
                <td>${p.seatNo || ""}</td>
                <td>${p.numPax || 0}</td>
                <td>${p.fqtv || ""}</td>
                <td>${p.serial || ""}</td>
                
            </tr>`;
        });

        html += `</tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="2">TOTAL PASSENGERS</td>
                    <td>${totalPax}</td>
                    <td colspan="3"></td>
                </tr>
            </tfoot>
        </table>

        <div class="disclaimer">
            <strong>Any discrepancy should be notified within 48 hours. Any delay claims will not be accepted.</strong>
        </div>

        <div class="signature-area">
            <div class="signature-line">Prepared By: ${loggedInUserName}</div>
            <div class="signature-line">Checked By: __________________</div>
        </div>

        <div class="footer-section">
            <div>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
            <div>Page 1 of 1</div>
        </div>
    </div>
    
    <script>
        // Auto-print when the window loads
        window.onload = function() {
            setTimeout(function() {
                window.print();
                // Optional: close window after printing
                // setTimeout(function() { window.close(); }, 500);
            }, 250);
        };
    </script>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        
        console.log("Print window opened successfully"); // Debug log
    });
}

// Initialize the app
function initializeApp() {
    checkAuthState();
    setupTimeInputs();
    setupFlightSelection();
    setupToggleFlightButton();
    setupPrintButton(); // Make sure this is called
    
    filterDate.addEventListener("change", populateFlights);
}

// Start the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});