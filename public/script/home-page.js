const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

let displayDate = new Date();
let currentMonth = displayDate.getMonth();
let currentYear = displayDate.getFullYear();

const monthTitle = document.getElementById('monthTitle');
const calendarGrid = document.getElementById('calendarGrid');
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');

const eventDateEl = document.getElementById('eventDate');
const eventListEl = document.getElementById('eventList');


const mockEvents = {
    "2026-02-1": [
        { time: "08:00 - 9:00", title: "" },
        { time: "9:00 - 10:00", title: "" }
    ]
};


function showEvents(day, month, year) {

    eventDateEl.textContent = `กิจกรรมประจำวันที่ ${day} ${monthNames[month]} ${year + 543}`;

    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    eventListEl.innerHTML = '';

    if (mockEvents[dateKey] && mockEvents[dateKey].length > 0) {
        mockEvents[dateKey].forEach(ev => {
            const item = document.createElement('div');
            item.classList.add('event_item');
            item.innerHTML = `
                <div class="time">${ev.time}</div>
                <div class="desc">${ev.title}</div>
            `;
            eventListEl.appendChild(item);
        });
    } else {
        eventListEl.innerHTML = '<div class="no_event">ไม่มีกิจกรรมในวันนี้</div>';
    }
}

function renderCalendar(month, year) {
    calendarGrid.innerHTML = '';

    weekdays.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('weekday');
        dayDiv.textContent = day;
        calendarGrid.appendChild(dayDiv);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    monthTitle.textContent = `${monthNames[month]} ${year + 543}`;

    for (let i = 0; i < firstDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('day', 'empty');
        calendarGrid.appendChild(emptyDiv);
    }

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day');
        dayDiv.textContent = i;


        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add('today');
        }


        dayDiv.addEventListener('click', () => {

            document.querySelectorAll('.day').forEach(d => d.classList.remove('active_day'));

            dayDiv.classList.add('active_day');

            showEvents(i, month, year);
        });

        calendarGrid.appendChild(dayDiv);
    }
}


renderCalendar(currentMonth, currentYear);
showEvents(displayDate.getDate(), displayDate.getMonth(), displayDate.getFullYear());

prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar(currentMonth, currentYear);
});

nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar(currentMonth, currentYear);
});


function backToday() {
    displayDate = new Date();
    currentMonth = displayDate.getMonth();
    currentYear = displayDate.getFullYear();
    renderCalendar(currentMonth, currentYear);
    showEvents(displayDate.getDate(), currentMonth, currentYear);
}


async function createAtdRecord() {

    const studentDisplay = document.getElementById('student-id-display');
    const studentId = studentDisplay.dataset.id;

    if (!studentId || studentId === 'undefined') {
        console.log("ไม่พบรหัสนักเรียน ไม่สามารถดึงข้อมูล API ได้");
        return;
    }
    const api = `/student/attendance_history?year=${currentYear}&student_id=${studentId}`;

    try {
        const response = await fetch(api);
        const data = await response.json()
        console.log(`ข้อมูล API ของนักเรียนรหัส ${studentId}:`, data);

        const container = document.getElementById('recordList');

        container.innerHTML = '';

        if (data.length === 0) {
            const messages = document.createElement('p');
            messages.textContent = 'ไม่มีประวัติการเช็คชื่อ';
            container.appendChild(messages);;
        }


        let countAbsent = 0;
        let countLeave = 0;
        let countLate = 0;
        let countPresent = 0;

        const totalDays = data.length;


        data.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('record_item');

            if (item.status === "Absent") {
                div.classList.add('record_item', 'danger');
                countAbsent++;
            }
            else if (item.status === "Personal Leave") {
                div.classList.add('record_item', 'leave');
                countLeave++;
            }
            else if (item.status === "Late") {
                div.classList.add('record_item', 'warning');
                countLate++;
            }
            else{
                return;
            }
            
            const spanDate = document.createElement('span');
            spanDate.className = "record_date";
            spanDate.textContent = item.date;


            const spanStatus = document.createElement('span');
            spanStatus.className = "record_status";
            spanStatus.textContent = item.status;


            div.append(spanDate, spanStatus);
            container.appendChild(div);
        });

        
        countPresent = totalDays - countAbsent - countLeave - countLate;

        
        let presentPercentage = totalDays > 0 ? ((countPresent / totalDays) * 100).toFixed(0) : 0;

        
        document.getElementById('statDanger').textContent = countAbsent;
        document.getElementById('statWarning').textContent = countLate;
        document.getElementById('statLeave').textContent = countLeave;
        document.getElementById('statGood').textContent = `${presentPercentage}%`;
    }
    catch (error) {
        console.error('Error:', error);
    }
}

createAtdRecord();

// ---------- upload profile image ---------- //

const editBtn = document.getElementById('btn-edit-profile');
const overlay = document.getElementById('upload-overlay');
const cancelBtn = document.getElementById('btn-cancel');
const saveBtn = document.getElementById('btn-save');
const fileInput = document.getElementById('file-input');
const previewImg = document.getElementById('preview-img');
const profileImg = document.getElementById('profile-img');

editBtn.addEventListener('click', () => overlay.classList.remove('hidden'));
cancelBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    fileInput.value = '';
    previewImg.style.display = 'none';
});


fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewImg.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
    }
});


saveBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return alert("กรุณาเลือกรูปภาพก่อน");

    const formData = new FormData();
    formData.append('profile_pic', file);

    try {
        const response = await fetch('/user/upload-profile', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            alert('เปลี่ยนรูปโปรไฟล์สำเร็จ!');
            profileImg.src = previewImg.src; 
            overlay.classList.add('hidden');
        } else {
            alert('เกิดข้อผิดพลาด: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
});