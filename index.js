const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

const app = express();


let db = new sqlite3.Database('school.db', (err) => {    
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/',function(req,res){
    res.render('login');
});
app.get('/student/home',function(req,res){
    res.render('Home-Student');
});
app.get('/teacher/home',function(req,res){
    res.render('Home-Teacher');
});
app.get('/admin/home',function(req,res){
    res.render('Home-Admin');
});

// Japan's Pages
function handleError(err, res) {
    console.error(err);
    res.status(500).send("Error retrieving exam schedule");
    return;
}

app.get('/teacher/grade', (req, res) => {
    res.render('Submit-grades');
});

app.get('/admin/exam-schedule/get-subjects-entry', (req, res) => {
    const subquery = `SELECT grade_level 
    FROM exam_schedule 
    JOIN exam_schedule_entries 
    USING (exam_id)
    WHERE entry_id = ?`;
    const sql = `SELECT subject_id, subject_name FROM Subjects WHERE grade_level = (${subquery})`;
    db.all(sql, [req.query.entry_id], (err, subjects) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error retrieving subjects");
            return;
        }
        res.json(subjects);
    });
});

app.get('/admin/exam-schedule/get-subjects', (req, res) => {
    const subquery = 'SELECT grade_level FROM exam_schedule WHERE exam_id = ?';
    const sql = `SELECT subject_id, subject_name FROM Subjects WHERE grade_level = (${subquery})`;
    db.all(sql, [req.query.grade], (err, subjects) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error retrieving subjects");
            return;
        }
        res.json(subjects);
    });
});

app.get('/admin/exam-schedule', (req, res) => {
    const sql1 = 'SELECT * FROM Exam_Schedule DESC WHERE year = ? AND semester = ? AND grade_level = ? AND type = ? ORDER BY year;';
    const sql2 = 'SELECT year FROM Year ORDER BY year DESC';
    const sql3 = `
        SELECT entry_id, start, end, subject_id, exam_id
        FROM Exam_Schedule_Entries 
        RIGHT JOIN EXAM_Schedule
        USING (exam_id)
        WHERE year = ? AND semester = ? AND grade_level = ? AND type = ?
        ORDER BY date;`;
    let list;
    let sql;
    if (req.query.year && req.query.semester && req.query.grade && req.query.type) {
        list = [req.query.year, req.query.semester, req.query.grade, req.query.type];
        sql = sql1;
    }
    else{
        list = [];
        sql = 'SELECT * FROM Exam_Schedule ORDER BY year DESC;'
    }

    db.all(sql, list, (err, result1) => {
        if (err) {
            handleError(err, res);
            return;
        }
        db.all(sql2, (err, year) => {
            if (err) {
                handleError(err, res);
                return;
            }
            // if (result1.length === 0) {
            //     res.render('Manage-Exam', {year: year, exam_ids: exam_ids, entries: entries, dates: dates});
            //     return;
            // }
            let list;
            if (req.query.year && req.query.semester && req.query.grade && req.query.type) {
                console.log("Query parameters provided:", req.query);
                list = [req.query.year, req.query.semester, req.query.grade, req.query.type];
            }
            else{
                list = [result1[0].year, result1[0].semester, result1[0].grade_level, result1[0].type];
            }
            db.all(sql3, list, (err, result2) => {
                if (err) {
                    handleError(err, res);
                    return;
                }
                let exam_ids = [];
                let dates = [];
                let entries = {};
                result2.forEach(entry => {
                    if (!exam_ids.includes(entry.exam_id)) {
                        exam_ids.push(entry.exam_id);
                        entries[entry.exam_id] = [];
                    }
                    if (entry.entry_id !== null) {
                        entries[entry.exam_id].push(entry);
                    }
                });
                result1.forEach(exam => {
                    if (!dates.includes(exam.date)) {
                        dates.push(exam.date);
                    }
                });
                console.log("Exam IDs:", exam_ids);
                res.render('Manage-Exam', {year: year, exam_ids: exam_ids, entries: entries, dates: dates});
            });
        });
    });
});

app.get('/admin/exam-schedule/view', (req, res) => {
    console.log(req.query);
    const sql = 'SELECT * FROM Exam_Schedule WHERE year = ? AND semester = ? AND grade_level = ? AND type = ?';
    db.all(sql, [req.query.year, req.query.semester, req.query.grade, req.query.type], (err, result) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error retrieving exam schedule");
            return;
        }
        console.log(result);
        res.render('View-Exam', {exam: result});
    });
});

app.post('/admin/exam-schedule/addExam', (req, res) => {
    console.log("", req.body);
    db.run('INSERT INTO Exam_Schedule (exam_id, date, semester, year, type, grade_level) VALUES (NULL, ?, ?, ?, ?, ?)', [req.body.date, req.body.semester, req.body.year, req.body.type, req.body.grade], function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error adding exam");
        } else {
            console.log("Exam Scheduled Added");
            res.status(200).send("Exam added successfully");
        }
    });
});

app.post('/admin/exam-schedule/addEntry', (req, res) => {
    console.log(req.body);
    const sql = 'INSERT INTO Exam_Schedule_Entries (entry_id, start, end, subject_id, exam_id) VALUES (NULL, ?, ?, ?, ?)';
    let params = [req.body.start, req.body.end, req.body.subject_id, req.body.exam_id];
    db.run(sql, params, function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error adding exam entry");
        } else {
            console.log("Exam Entry Added");
            res.status(200).send("Exam entry added successfully");
        }
    });
});

app.put('/admin/exam-schedule/editEntry', (req, res) => {
    console.log(req.body);
    const sql = 'UPDATE Exam_Schedule_Entries SET start = ?, end = ?, subject_id = ? WHERE entry_id = ?';
    let params = [req.body.start, req.body.end, req.body.subject_id, req.body.entry_id];
    db.run(sql, params, err => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error editing exam entry");
        } else {
            console.log("Exam Entry Edited");
            res.status(200).send("Exam entry edited successfully");
        }
    });
});

app.delete('/admin/exam-schedule/deleteEntry', (req, res) => {
    console.log(req.body);
    const sql = 'DELETE FROM Exam_Schedule_Entries WHERE entry_id = ?';
    db.run(sql, [req.body.entry_id], err => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error deleting exam entry");
        } else {
            console.log("Exam Entry Deleted");
            res.status(200).send("Exam entry deleted successfully");
        }
    });
});

app.listen(port, () => {
   console.log("Server started.");
});