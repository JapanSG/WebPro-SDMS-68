function createAddExamPopup() {
    console.log("Creating Add Exam Popup");
    let popup = document.createElement("div");
    popup.setAttribute("class", "addExamPopup");

    let title = document.createElement("h2");
    title.textContent = "Add Exam Schedule";
    popup.appendChild(title);

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

    let btnsDiv = document.createElement("div");
    btnsDiv.setAttribute("class", "popupBtns");
    popup.appendChild(btnsDiv);

    // Create Cancel button
    let cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.setAttribute("class", "cancelBtn");
    cancelBtn.addEventListener("click", closeAddExamPopup);
    btnsDiv.appendChild(cancelBtn);

    // Create Add button
    let addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    addBtn.setAttribute("class", "confirmBtn");
    addBtn.addEventListener("click", addExamHandler);
    btnsDiv.appendChild(addBtn);
    
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
        }).then(() => {
            window.location.reload();
        }).catch(error => {
            console.error("Error adding exam:", error);
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

        let title = document.createElement("h2");
        title.textContent = "Add Exam Entry";
        popup.appendChild(title);

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

        let btnsDiv = document.createElement("div");
        btnsDiv.setAttribute("class", "popupBtns");
        popup.appendChild(btnsDiv);
        
        // Create Cancel button
        let cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.setAttribute("class", "cancelBtn");
        cancelBtn.addEventListener("click", closeAddEntryPopup);
        btnsDiv.appendChild(cancelBtn);

        // Create Confirm button
        let confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Add";
        confirmBtn.setAttribute("class", "confirmBtn");
        confirmBtn.addEventListener("click", () => addEntryHandler(exam_id));
        btnsDiv.appendChild(confirmBtn);

        let layer = document.getElementById("popupLayer");
        layer.style.display = "flex";
        layer.appendChild(popup);
    }

    fetch("/admin/exam-schedule/get-subjects?grade=" + event.target.value)
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

function createEditEntryHandlerPopup(event) {

    function createPopup(subjects) {
        const entry_id = event.target.parentNode.value;
        console.log("Editing entry with ID:", entry_id);

        let popup = document.createElement("div");
        popup.setAttribute("class", "editEntryPopup");

        let title = document.createElement("h2");
        title.textContent = "Edit Exam Entry";
        popup.appendChild(title);

        console.log(event.target.parentNode.parentNode.parentNode.parentNode.children);
        let time = event.target.parentNode.parentNode.parentNode.parentNode.children[0].textContent.split("-");
        let start = time[0].trim();
        let end = time[1].trim();
        let subject_id = event.target.parentNode.parentNode.parentNode.parentNode.children[1].textContent.trim();
        console.log(subject_id);

        // Create start field
        let startLabel = document.createElement("label");
        startLabel.textContent = "Start Time: ";
        popup.appendChild(startLabel);
        let startInput = document.createElement("input");
        startInput.setAttribute("type", "time");
        startInput.setAttribute("class", "startTime");
        startInput.value = start;
        popup.appendChild(startInput);

        // Create end field
        let endLabel = document.createElement("label");
        endLabel.textContent = "End Time: ";
        popup.appendChild(endLabel);
        let endInput = document.createElement("input");
        endInput.setAttribute("type", "time");
        endInput.setAttribute("class", "endTime");
        endInput.value = end;
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
            if (subject.subject_id == subject_id) {
                option.selected = true;
            }
        });
        popup.appendChild(subjectSelect);

        let btnsDiv = document.createElement("div");
        btnsDiv.setAttribute("class", "popupBtns");
        popup.appendChild(btnsDiv);
        
        // Create Cancel button
        let cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.setAttribute("class", "cancelBtn");
        cancelBtn.addEventListener("click", closeEditEntryPopup);
        btnsDiv.appendChild(cancelBtn);

        // Create Confirm button
        let confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Edit";
        confirmBtn.setAttribute("class", "confirmBtn");
        confirmBtn.addEventListener("click", () => editEntryHandler(entry_id));
        btnsDiv.appendChild(confirmBtn);

        let layer = document.getElementById("popupLayer");
        layer.style.display = "flex";
        layer.appendChild(popup);
    }
    fetch("/admin/exam-schedule/get-subjects-entry?entry_id=" + event.target.parentNode.value)
    .then(response => response.json())
    .then(subjects => {
        createPopup(subjects);
    })
    .catch(error => {
        console.error("Error fetching subjects:", error);
    });
}

function closeEditEntryPopup() {
    let popup = document.querySelector(".editEntryPopup");
    if (popup) {
        popup.remove();
    }
    let layer = document.getElementById("popupLayer");
    layer.style.display = "none";
}

function editEntryHandler(entry_id) {
    let startTime = document.querySelector(".startTime").value;
    let endTime = document.querySelector(".endTime").value;
    let subject = document.querySelector(".subjectSelect").value;
    
    if (startTime && endTime && subject) {
        console.log("Entry being edited - Entry_id:", entry_id, "Start:", startTime, "End:", endTime, "Subject:", subject);
        fetch("/admin/exam-schedule/editEntry", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                entry_id: entry_id,
                start: startTime,
                end: endTime,
                subject_id: subject
            })
        })
        .then(() => {
            window.location.reload();
        }).catch(error => {
            console.error("Error editing exam entry:", error);
        });
    }
    closeEditEntryPopup();
}

function createDeleteEntryWarningPopup(event) {
    const entry_id = event.target.value;

    let popup = document.createElement("div");
    popup.setAttribute("class", "deleteWarningPopup");

    let message = document.createElement("p");
    message.textContent = "Are you sure you want to delete this entry?";
    popup.appendChild(message);

    let btnsDiv = document.createElement("div");
    btnsDiv.setAttribute("class", "popupBtns");
    popup.appendChild(btnsDiv);

    let cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.setAttribute("class", "cancelBtn");
    cancelBtn.addEventListener("click", closeDeleteEntryWarningPopup);
    btnsDiv.appendChild(cancelBtn);

    let confirmBtn = document.createElement("button");
    confirmBtn.textContent = "DELETE";
    confirmBtn.setAttribute("class", "deleteBtn");
    confirmBtn.addEventListener("click", () => deleteEntryHandler(entry_id));
    btnsDiv.appendChild(confirmBtn);

    let layer = document.getElementById("popupLayer");
    layer.style.display = "flex";
    layer.appendChild(popup);
}

function closeDeleteEntryWarningPopup() {
    let popup = document.querySelector(".deleteWarningPopup");
    if (popup) {
        popup.remove();
    }
    let layer = document.getElementById("popupLayer");
    layer.style.display = "none";
}

function deleteEntryHandler(entry_id) {
    fetch("/admin/exam-schedule/deleteEntry", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            entry_id: entry_id
        })
    })
    .then(() => {
        window.location.reload();
    })
    .catch(error => {
        console.error("Error deleting exam entry:", error);
    });
}

function createDeleteExamWarningPopup(event) {
    const exam_id = event.target.value;

    let popup = document.createElement("div");
    popup.setAttribute("class", "deleteWarningPopup");

    let message = document.createElement("p");
    message.textContent = "Are you sure you want to delete this exam schedule?";
    popup.appendChild(message);

    let btnsDiv = document.createElement("div");
    btnsDiv.setAttribute("class", "popupBtns");
    popup.appendChild(btnsDiv);

    let cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.setAttribute("class", "cancelBtn");
    cancelBtn.addEventListener("click", closeDeleteExamWarningPopup);
    btnsDiv.appendChild(cancelBtn);

    let confirmBtn = document.createElement("button");
    confirmBtn.textContent = "DELETE";
    confirmBtn.setAttribute("class", "deleteBtn");
    confirmBtn.addEventListener("click", () => deleteExamHandler(exam_id));
    btnsDiv.appendChild(confirmBtn);

    let layer = document.getElementById("popupLayer");
    layer.style.display = "flex";
    layer.appendChild(popup);
}

function closeDeleteExamWarningPopup() {
    let popup = document.querySelector(".deleteWarningPopup");
    if (popup) {
        popup.remove();
    }
    let layer = document.getElementById("popupLayer");
    layer.style.display = "none";
}

function deleteExamHandler(exam_id) {
    fetch("/admin/exam-schedule/deleteExam", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            exam_id: exam_id
        })
    })
    .then(() => {
        window.location.reload();
    })
    .catch(error => {
        console.error("Error deleting exam schedule:", error);
    });
}

function createDeleteAllWarningPopup() {
    let popup = document.createElement("div");
    popup.setAttribute("class", "deleteWarningPopup");

    let message = document.createElement("p");
    message.textContent = "Are you sure you want to delete all exam schedules?";
    popup.appendChild(message);

    let btnsDiv = document.createElement("div");
    btnsDiv.setAttribute("class", "popupBtns");
    popup.appendChild(btnsDiv);

    let cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.setAttribute("class", "cancelBtn");
    cancelBtn.addEventListener("click", closeDeleteAllWarningPopup);
    btnsDiv.appendChild(cancelBtn);

    let confirmBtn = document.createElement("button");
    confirmBtn.textContent = "DELETE";
    confirmBtn.setAttribute("class", "deleteBtn");
    confirmBtn.addEventListener("click", deleteAllHandler);
    btnsDiv.appendChild(confirmBtn);

    let layer = document.getElementById("popupLayer");
    layer.style.display = "flex";
    layer.appendChild(popup);
}

function closeDeleteAllWarningPopup() {
    let popup = document.querySelector(".deleteWarningPopup");
    if (popup) {
        popup.remove();
    }
    let layer = document.getElementById("popupLayer");
    layer.style.display = "none";
}

function deleteAllHandler() {
  fetch("/admin/exam-schedule/deleteAll", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        }
  })
  .then(() => {
      window.location.reload();
  })
  .catch(error => {
      console.error("Error deleting all exam schedules:", error);
  });
}

function init(){
    let addExam = document.getElementById("addExam");
    addExam.addEventListener("click", createAddExamPopup);
    let viewExam = document.getElementById("viewExam");
    viewExam.addEventListener("click", viewExamHandler);
    let deleteAll = document.getElementById("deleteAll");
    deleteAll.addEventListener("click", createDeleteAllWarningPopup);
    document.querySelectorAll(".addEntry").forEach(button => {
        button.addEventListener("click", createAddEntryHandlerPopup);
    });
    let editEntryButtons = document.querySelectorAll(".editEntry");
    editEntryButtons.forEach(button => {
        button.addEventListener("click", createEditEntryHandlerPopup); 
    });
    let deleteEntryButtons = document.querySelectorAll(".deleteEntry");
    deleteEntryButtons.forEach(button => {
        button.addEventListener("click", createDeleteEntryWarningPopup);
    });
    let deleteExamButtons = document.querySelectorAll(".deleteExam");
    deleteExamButtons.forEach(button => {
        button.addEventListener("click", createDeleteExamWarningPopup);
    });
}

init();
