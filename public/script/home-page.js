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


async function showEvents(day, month, year) {
    eventDateEl.textContent = `กิจกรรมประจำวันที่ ${day} ${monthNames[month]} ${year + 543}`;

    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    eventListEl.innerHTML = '<div class="no_event">กำลังโหลดข้อมูล...</div>';
    try {

        const response = await fetch(`/event/list?date=${dateKey}`);
        const events = await response.json();
        eventListEl.innerHTML = '';

        if (events.length > 0) {
            events.forEach(ev => {
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
    } catch (error) {
        console.error('Error fetching events:', error);
        eventListEl.innerHTML = '<div class="no_event" style="color:red;">เกิดข้อผิดพลาดในการดึงข้อมูล</div>';
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

            selectedDateForEvent = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

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
    const api = `/student/attendance_history?student_id=${studentId}`;

    try {
        const response = await fetch(api);
        const data = await response.json()
        console.log(`ข้อมูลการเข้าเรียนของรหัส ${studentId}:`, data);

        const container = document.getElementById('recordList');

        container.innerHTML = '';

        if (data.length === 0) {
            const messages = document.createElement('p');
            messages.textContent = 'ไม่มีประวัติการเช็คชื่อ';
            messages.className = "no_event";
            container.appendChild(messages);
            updateStats(0, 0, 0, 0);
            return;
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
                div.classList.add('danger');
                countAbsent++;
            } else if (item.status === "Personal Leave" || item.status === "Sick Leave") {
                div.classList.add('leave');
                countLeave++;
            } else if (item.status === "Late") {
                div.classList.add('warning');
                countLate++;
            } else if (item.status === "Present") {
                div.classList.add('good');
                countPresent++;
            }

            const spanDate = document.createElement('span');
            spanDate.className = "record_date";
            spanDate.textContent = item.date;


            const spanStatus = document.createElement('span');
            spanStatus.className = "record_status";
            spanStatus.textContent = translateStatus(item.status);;


            div.append(spanDate, spanStatus);
            container.appendChild(div);
        });


        countPresent = totalDays - countAbsent - countLeave - countLate;


        let presentPercentage = totalDays > 0 ? ((countPresent / totalDays) * 100).toFixed(0) : 0;


        updateStats(countAbsent, countLate, countLeave, presentPercentage);
    }
    catch (error) {
        console.error('Error:', error);
    }
}

function translateStatus(status) {
    const statuses = {
        'Present': 'มาเรียน',
        'Absent': 'ขาดเรียน',
        'Late': 'มาสาย',
        'Personal Leave': 'ลากิจ',
        'Sick Leave': 'ลาป่วย'
    };
    return statuses[status] || status;
}


function updateStats(absent, late, leave, percent) {
    document.getElementById('statDanger').textContent = absent;
    document.getElementById('statWarning').textContent = late;
    document.getElementById('statLeave').textContent = leave;
    document.getElementById('statGood').textContent = `${percent}%`;
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

// ---------- Add Event Logic ---------- //


let selectedDateForEvent = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(displayDate.getDate()).padStart(2, '0')}`;

const addEventBtn = document.getElementById('btn-add-event');
const eventOverlay = document.getElementById('event-overlay');
const cancelEventBtn = document.getElementById('btn-cancel-event');
const saveEventBtn = document.getElementById('btn-save-event');
const eventTimeInput = document.getElementById('event-time');
const eventTitleInput = document.getElementById('event-title');
const eventModalDate = document.getElementById('event-modal-date');


addEventBtn.addEventListener('click', () => {
    eventModalDate.textContent = `วันที่บันทึก: ${selectedDateForEvent}`;
    eventOverlay.classList.remove('hidden');
});


cancelEventBtn.addEventListener('click', () => {
    eventOverlay.classList.add('hidden');
    eventTimeInput.value = '';
    eventTitleInput.value = '';
});


saveEventBtn.addEventListener('click', async () => {
    const time = eventTimeInput.value.trim();
    const title = eventTitleInput.value.trim();

    if (!time || !title) return alert("กรุณากรอกเวลาและชื่อกิจกรรมให้ครบครับ");

    try {
        const response = await fetch('/event/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: selectedDateForEvent,
                time: time,
                title: title
            })
        });

        const result = await response.json();
        if (result.success) {
            alert('เพิ่มกิจกรรมสำเร็จ!');
            eventOverlay.classList.add('hidden');
            eventTimeInput.value = '';
            eventTitleInput.value = '';

            const [y, m, d] = selectedDateForEvent.split('-');
            showEvents(parseInt(d), parseInt(m) - 1, parseInt(y));
        } else {
            alert('เกิดข้อผิดพลาด: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
});