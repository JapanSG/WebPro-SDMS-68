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