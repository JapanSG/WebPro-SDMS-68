function changeSubject(event){
    let form = event.target.parentNode;
    form.submit();
}

function submitGrade(){
    let fields = document.querySelectorAll(".grade-field");
    console.log(fields);
    let data = {};
    data.subject = document.getElementById("form-subject").value;
    data.values = {};
    fields.forEach(field => {
        data.values[`${field.getAttribute('name')}`] = field.value;
    });
    console.log(data);
    fetch("/teacher/grade/submit", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(() => {
        window.location.reload();
    })
    .catch((err) => {
        console.error("Error adding exam:", error);
    });
}

function init(){
    let dropdowns = document.querySelectorAll(".subject-dropdown");
    dropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', changeSubject);
    });
    let submit = document.getElementById("submit");
    submit.addEventListener('click', submitGrade);
}

init();
