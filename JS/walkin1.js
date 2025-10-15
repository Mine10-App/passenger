// JS/cardentry.js
class PassengerApprovalSystem {
    constructor() {
        this.initializeElements();
        this.currentShift = "Morning"; // Default shift
        this.isSaving = false;
        this.pendingPassengers = [];
        this.initializeApp();
    }

    initializeElements() {
        // Form elements
        this.passengerForm = document.getElementById('passengerForm');
        this.qrInput = document.getElementById('qrInput');
        this.nameInput = document.getElementById('name');
        this.seatNoInput = document.getElementById('seatNo');
        this.flightNoInput = document.getElementById('flightNo');
        this.airlineInput = document.getElementById('airline');
        this.dateInput = document.getElementById('date');
        this.numPaxInput = document.getElementById('numPax');
        this.fqtvInput = document.getElementById('fqtv');
        this.serialInput = document.getElementById('serial');
        this.remarksInput = document.getElementById('remarks');
        
        // Action buttons
        this.addPassengerBtn = document.getElementById('addPassengerBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Table elements
        this.tableBody = document.getElementById('tableBody');
        this.emptyState = document.getElementById('emptyState');
        this.paxCount = document.getElementById('paxCount');
        
        // Shift elements
        this.shiftStatus = document.getElementById('shiftStatus');
        this.shiftName = document.getElementById('shiftName');
        this.shiftTime = document.getElementById('shiftTime');
        
        // Navigation buttons
        this.dashboardBtn = document.getElementById('dashboardBtn');
        this.reportBtn = document.getElementById('reportBtn');
        
        // Notification
        this.notification = document.getElementById('notification');
    }

    async initializeApp() {
        this.initializeUser();
        this.setCurrentDate();
        await this.fetchCurrentShift();
        this.initializeEventListeners();
        await this.loadPendingApprovals();
        
        // Focus on QR input
        setTimeout(() => {
            if (this.qrInput) this.qrInput.focus();
        }, 500);
    }

    initializeUser() {
        const userData = JSON.parse(localStorage.getItem("loggedInUser"));
        if (!userData) {
            window.location.href = "login.html";
        }
    }

    setCurrentDate() {
        const today = new Date().toISOString().split('T')[0];
        if (this.dateInput) {
            this.dateInput.value = today;
        }
    }

    parseQR(code) {
        code = code.trim().toUpperCase().replace(/\s+/g, ' ');
        let name = "", flightNo = "", seatNo = "";
        const allParts = code.split(' ');

        if (code.startsWith("TKVCPO")) {
            const tkIndex = code.indexOf("TK0");
            if (tkIndex !== -1) {
                flightNo = code.substring(tkIndex, tkIndex + 6);
                name = code.substring(6, tkIndex).trim();
            }
            const mlePos = code.indexOf("MLE");
            if (mlePos !== -1) {
                const afterMLE = code.substring(mlePos).split(' ')[0];
                if (afterMLE.length >= 11) seatNo = afterMLE.substring(8, 11);
            }
        } else {
            const mleIndex = allParts.findIndex(w => w.includes("MLE"));
            if (mleIndex > 0) {
                let nameParts = allParts.slice(0, mleIndex);
                nameParts[0] = nameParts[0].substring(2);
                name = nameParts.join(' ').trim();
            } else {
                name = allParts[0].substring(2);
            }
            if (name.length > 6) name = name.substring(0, name.length - 6).trim();

            if (mleIndex !== -1) {
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
        return { name, flightNo, seatNo };
    }

    getAirline(flightNo) {
        if (!flightNo || flightNo.length < 2) return "Unknown";
        const code = flightNo.substring(0, 2).toUpperCase();
        const iata = {
            "GF": "GULF AIR",
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
            "AC": "Air Canada",
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
            "RJ": "Royal Jordanian",
            "OD": "Batik Air",
            "JD": "Beijing Capital Airlines",
            "UL": "Srilankan Airlines"
        };
        return iata[code] || "Unknown";
    }

    async fetchCurrentShift() {
        try {
            if (!db) {
                this.updateShiftInfo(null);
                return;
            }
            
            const snapshot = await db.collection("shifts").limit(1).get();
            const shiftData = !snapshot.empty ? snapshot.docs[0].data() : null;
            this.updateShiftInfo(shiftData);
        } catch (error) {
            console.error("Error fetching shift:", error);
            this.updateShiftInfo(null);
        }
    }

    updateShiftInfo(shiftData) {
        let shiftName = "No Shift Open";
        let shiftTime = "";
        
        if (shiftData) {
            if (shiftData.shift1?.status === "Open") {
                shiftName = "Morning Shift";
                this.currentShift = "Morning";
                shiftTime = shiftData.shift1.time || "";
            } else if (shiftData.shift2?.status === "Open") {
                shiftName = "Evening Shift";
                this.currentShift = "Evening";
                shiftTime = shiftData.shift2.time || "";
            }
        }
        
        if (this.shiftName) this.shiftName.textContent = shiftName;
        if (this.shiftTime) this.shiftTime.textContent = shiftTime;
    }

    async savePassenger(passengerData) {
        if (this.isSaving) return;
        this.isSaving = true;

        try {
            // Save to Firebase in the exact format you specified
            const passengerDoc = {
                airline: passengerData.airline,
                approved: false, // Default to false for pending approvals
                checkinTime: "", // Empty string as per your format
                date: passengerData.date,
                flightNo: passengerData.flightNo,
                fqtv: passengerData.fqtv || "-",
                name: passengerData.name,
                numPax: passengerData.numPax,
                remarks: passengerData.remarks || "",
                seatNo: passengerData.seatNo,
                serial: passengerData.serial || "-",
                shift: this.currentShift,
                timeAdded: this.getCurrentTime()
            };

            // Add to Firebase
            await db.collection("passengers").add(passengerDoc);
            
            this.showNotification("Passenger added successfully!", "success");
            await this.loadPendingApprovals(); // Refresh the table
            this.clearForm();

        } catch (error) {
            console.error("Error saving passenger:", error);
            this.showNotification("Error saving passenger. Please try again.", "error");
        } finally {
            this.isSaving = false;
        }
    }

    async loadPendingApprovals() {
        try {
            if (!db) return;

            const snapshot = await db.collection("passengers")
                .where("approved", "==", false)
                .orderBy("timeAdded", "desc")
                .get();

            this.pendingPassengers = [];
            snapshot.forEach(doc => {
                this.pendingPassengers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.updateTable();
            this.updatePassengerCount();

        } catch (error) {
            console.error("Error loading pending approvals:", error);
            this.showNotification("Error loading pending approvals", "error");
        }
    }

    updateTable() {
        if (!this.tableBody) return;

        this.tableBody.innerHTML = '';

        if (this.pendingPassengers.length === 0) {
            if (this.emptyState) this.emptyState.style.display = 'block';
            return;
        }

        if (this.emptyState) this.emptyState.style.display = 'none';

        this.pendingPassengers.forEach(passenger => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${passenger.date}</td>
                <td>${passenger.airline}</td>
                <td>${passenger.flightNo}</td>
                <td>${passenger.name}</td>
                <td>${passenger.seatNo}</td>
                <td>${passenger.fqtv}</td>
                <td>${passenger.serial}</td>
                <td>${passenger.remarks}</td>
                <td>${passenger.numPax}</td>
                <td>${passenger.timeAdded}</td>
                <td><span class="status-badge pending">Pending</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-approve" data-id="${passenger.id}">Approve</button>
                        <button class="btn-reject" data-id="${passenger.id}">Reject</button>
                    </div>
                </td>
            `;

            this.tableBody.appendChild(row);
        });

        // Add event listeners to action buttons
        this.initializeTableEventListeners();
    }

    initializeTableEventListeners() {
        // Approve buttons
        document.querySelectorAll('.btn-approve').forEach(button => {
            button.addEventListener('click', (e) => {
                const passengerId = e.target.getAttribute('data-id');
                this.approvePassenger(passengerId);
            });
        });

        // Reject buttons
        document.querySelectorAll('.btn-reject').forEach(button => {
            button.addEventListener('click', (e) => {
                const passengerId = e.target.getAttribute('data-id');
                this.rejectPassenger(passengerId);
            });
        });
    }

    async approvePassenger(passengerId) {
        if (!confirm("Are you sure you want to approve this passenger?")) return;

        try {
            await db.collection("passengers").doc(passengerId).update({
                approved: true,
                checkinTime: this.getCurrentTime()
            });

            this.showNotification("Passenger approved successfully!", "success");
            await this.loadPendingApprovals(); // Refresh table

        } catch (error) {
            console.error("Error approving passenger:", error);
            this.showNotification("Error approving passenger", "error");
        }
    }

    async rejectPassenger(passengerId) {
        if (!confirm("Are you sure you want to reject this passenger?")) return;

        try {
            await db.collection("passengers").doc(passengerId).delete();
            this.showNotification("Passenger rejected successfully!", "success");
            await this.loadPendingApprovals(); // Refresh table

        } catch (error) {
            console.error("Error rejecting passenger:", error);
            this.showNotification("Error rejecting passenger", "error");
        }
    }

    updatePassengerCount() {
        if (this.paxCount) {
            this.paxCount.textContent = this.pendingPassengers.length;
        }
    }

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    showNotification(message, type = "info") {
        if (!this.notification) return;

        this.notification.textContent = message;
        this.notification.className = `notification ${type}`;
        this.notification.style.display = 'block';

        setTimeout(() => {
            this.notification.style.display = 'none';
        }, 3000);
    }

    clearForm() {
        if (this.passengerForm) this.passengerForm.reset();
        this.setCurrentDate(); // Reset date to today
        if (this.numPaxInput) this.numPaxInput.value = 1;
        if (this.fqtvInput) this.fqtvInput.value = "";
        if (this.serialInput) this.serialInput.value = "";
        if (this.remarksInput) this.remarksInput.value = "";
        
        // Focus back on QR input
        if (this.qrInput) {
            this.qrInput.focus();
        }
    }

    validateForm() {
        if (!this.nameInput.value.trim()) {
            this.showNotification("Please enter passenger name", "error");
            this.nameInput.focus();
            return false;
        }

        if (!this.seatNoInput.value.trim()) {
            this.showNotification("Please enter seat number", "error");
            this.seatNoInput.focus();
            return false;
        }

        if (!this.flightNoInput.value.trim()) {
            this.showNotification("Please enter flight number", "error");
            this.flightNoInput.focus();
            return false;
        }

        if (!this.dateInput.value) {
            this.showNotification("Please select date", "error");
            this.dateInput.focus();
            return false;
        }

        return true;
    }

    initializeEventListeners() {
        // QR Code input with auto-fill
        let qrTimeout = null;
        if (this.qrInput) {
            this.qrInput.addEventListener('input', (e) => {
                clearTimeout(qrTimeout);
                qrTimeout = setTimeout(() => {
                    const qr = e.target.value;
                    if (qr.length > 5) {
                        const { name, flightNo, seatNo } = this.parseQR(qr);
                        if (this.nameInput) this.nameInput.value = name;
                        if (this.flightNoInput) this.flightNoInput.value = flightNo;
                        if (this.seatNoInput) this.seatNoInput.value = seatNo;
                        if (this.airlineInput) this.airlineInput.value = this.getAirline(flightNo);
                    }
                }, 300);
            });
        }

        // Auto-fill airline when flight number changes
        if (this.flightNoInput) {
            this.flightNoInput.addEventListener('blur', () => {
                const flightNo = this.flightNoInput.value.trim();
                if (flightNo && this.airlineInput) {
                    this.airlineInput.value = this.getAirline(flightNo);
                }
            });
        }

        // Form submission
        if (this.passengerForm) {
            this.passengerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!this.validateForm()) return;

                const passengerData = {
                    name: this.nameInput.value.trim(),
                    seatNo: this.seatNoInput.value.trim(),
                    flightNo: this.flightNoInput.value.trim(),
                    airline: this.airlineInput.value,
                    date: this.dateInput.value,
                    numPax: parseInt(this.numPaxInput.value) || 1,
                    fqtv: this.fqtvInput.value.trim() || "-",
                    serial: this.serialInput.value.trim() || "-",
                    remarks: this.remarksInput.value.trim() || ""
                };

                await this.savePassenger(passengerData);
            });
        }

        // Clear form
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => {
                this.clearForm();
            });
        }

        // Navigation buttons
        if (this.dashboardBtn) {
            this.dashboardBtn.addEventListener('click', () => {
                window.location.href = "dashboard.html";
            });
        }

        if (this.reportBtn) {
            this.reportBtn.addEventListener('click', () => {
                window.location.href = "airlinereport.html";
            });
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    window.passengerApp = new PassengerApprovalSystem();
});
