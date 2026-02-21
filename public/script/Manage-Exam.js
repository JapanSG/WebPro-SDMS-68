function createAddExamPopup() {
    console.log("Creating Add Exam Popup");
    let popup = document.createElement("div");
    popup.setAttribute("class", "addExamPopup");

    // Create date input field
    let input = document.createElement("input");
    input.setAttribute("type", "date");
    input.setAttribute("class", "examInput");
    popup.appendChild(input);

    // Create grade dropdown
    let gradeSelect = document.createElement("select");
    gradeSelect.setAttribute("class", "gradeSelect");
    gradeSelect.setAttribute("id", "grade");
    for (let i = 1; i <= 6; i++) {
        let option = document.createElement("option");
        option.value = i;
        option.textContent = "ป." + i;
        gradeSelect.appendChild(option);
    }
    popup.appendChild(gradeSelect);

    // Create Add button
    let addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    addBtn.setAttribute("class", "addBtn");
    addBtn.addEventListener("click", addExamHandler);
    popup.appendChild(addBtn);

    // Create Cancel button
    let cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.setAttribute("class", "cancelBtn");
    cancelBtn.addEventListener("click", closeAddExamPopup);
    popup.appendChild(cancelBtn);

    let layer = document.getElementById("popupLayer");
    layer.style.display = "flex";
    layer.appendChild(popup);
}

function closeAddExamPopup() {
    let popup = document.querySelector(".addExamPopup");
    if (popup) {
        popup.remove();
    }
    let layer = document.getElementById("popupLayer");
    layer.style.display = "none";
}

function addExamHandler() {
    let input = document.querySelector(".examInput");
    if (input && input.value.trim()) {
        // Handle adding exam with input value
        console.log("Exam added:", input.value);
        fetch("/admin/exam-schedule/addExam", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                date: input.value,
                semester: document.getElementById("semester").value,
                year: document.getElementById("year").value,
                type: document.getElementById("type").value,
                grade: document.getElementById("grade").value
            })
        });
    }
    closeAddExamPopup();
}

function viewExamHandler() {
    console.log("View Exam Schedule");
    fetch("/admin/exam-schedule?" + new URLSearchParams({
        year: document.getElementById("year").value,
        semester: document.getElementById("semester").value,
        grade: document.getElementById("grade").value,
        type: document.getElementById("type").value
    }))
    .then(response => {
        if (response.ok) {
            window.location.replace('/admin/exam-schedule?' + new URLSearchParams({
                year: document.getElementById("year").value,
                semester: document.getElementById("semester").value,
                grade: document.getElementById("grade").value,
                type: document.getElementById("type").value
            }));
        }
        else {
            console.error("Failed to view exam schedule");
        }
    })
    .catch(error => {
        console.error("Error viewing exam schedule:", error);
    });
}

function createAddEntryHandlerPopup(event) {

    function createPopup(subjects) {
        const exam_id = event.target.value;

        let popup = document.createElement("div");
        popup.setAttribute("class", "addEntryPopup");

        // Create start field
        let startLabel = document.createElement("label");
        startLabel.textContent = "Start Time: ";
        popup.appendChild(startLabel);
        let startInput = document.createElement("input");
        startInput.setAttribute("type", "time");
        startInput.setAttribute("class", "startTime");
        popup.appendChild(startInput);

        // Create end field
        let endLabel = document.createElement("label");
        endLabel.textContent = "End Time: ";
        popup.appendChild(endLabel);
        let endInput = document.createElement("input");
        endInput.setAttribute("type", "time");
        endInput.setAttribute("class", "endTime");
        popup.appendChild(endInput);

        // Create subject dropdown
        let subjectLabel = document.createElement("label");
        subjectLabel.textContent = "Subject: ";
        popup.appendChild(subjectLabel);
        let subjectSelect = document.createElement("select");
        subjectSelect.setAttribute("class", "subjectSelect");
        subjectSelect.setAttribute("name", "subject");
        subjects.forEach(subject => {
            let option = document.createElement("option");
            option.value = subject.subject_id;
            option.textContent = subject.subject_name;
            subjectSelect.appendChild(option);
        });
        popup.appendChild(subjectSelect);

        // Create Confirm button
        let confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Confirm";
        confirmBtn.setAttribute("class", "confirmBtn");
        confirmBtn.addEventListener("click", () => addEntryHandler(exam_id));
        popup.appendChild(confirmBtn);

        // Create Cancel button
        let cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.setAttribute("class", "cancelBtn");
        cancelBtn.addEventListener("click", closeAddEntryPopup);
        popup.appendChild(cancelBtn);

        let layer = document.getElementById("popupLayer");
        layer.style.display = "flex";
        layer.appendChild(popup);
    }

    fetch("/admin/exam-schedule/get-subjects?grade=" + document.getElementById("grade").value)
    .then(response => response.json())
    .then(subjects => {
        createPopup(subjects);
    })
    .catch(error => {
        console.error("Error fetching subjects:", error);
    });
}

function closeAddEntryPopup() {
    let popup = document.querySelector(".addEntryPopup");
    if (popup) {
        popup.remove();
    }
    let layer = document.getElementById("popupLayer");
    layer.style.display = "none";
}

function addEntryHandler(exam_id) {
    let startTime = document.querySelector(".startTime").value;
    let endTime = document.querySelector(".endTime").value;
    let subject = document.querySelector(".subjectSelect").value;
    
    if (startTime && endTime && subject) {
        console.log("Entry being added - Exam ID:", exam_id, "Start:", startTime, "End:", endTime, "Subject:", subject);
        fetch("/admin/exam-schedule/addEntry", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                exam_id: exam_id,
                start: startTime,
                end: endTime,
                subject_id: subject
            })
        })
        .then(() => {
            window.location.reload();
        }).catch(error => {
            console.error("Error adding exam entry:", error);
        });
    }
    closeAddEntryPopup();
}

function init(){
    let addExam = document.getElementById("addExam");
    addExam.addEventListener("click", createAddExamPopup);
    let viewExam = document.getElementById("viewExam");
    viewExam.addEventListener("click", viewExamHandler);
    document.querySelectorAll(".addEntry").forEach(button => {
        button.addEventListener("click", createAddEntryHandlerPopup);
    });
}

init();
