const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

const app = express();
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

let db = new sqlite3.Database('school.db', (err) => {    
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const initializePassport = require('./passport-config');
initializePassport(passport, db);

app.use(express.static('public'));
app.set('view engine', 'ejs');
// app.use(express.urlencoded({ extended: false })); @WarakonTangcharoenarri Hey why is this false shouldn't it be turned on

app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: '.',
        concurrentDB: true
    }),
    secret: 'webPro2026_super_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 5
    }
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.get('/', checkAuthenticated, (req, res) => {
    const userRole = req.user.role;

    if (userRole === 'admin') {
        return res.redirect('/admin/home')
    }
    else if (userRole === 'ao') {
        return res.redirect('/ao/submit')
    }
    else if (userRole === 'teacher') {
        return res.redirect('/teacher/home')
    }
    else if (userRole === 'student') {
        return res.redirect('/student/home')
    }
    else {
        return res.status(403).send('คุณไม่มีสิทธิ์เข้าถึงระบบ');
    }
})
app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login');
});
app.post('/login', checkNotAuthenticated, (req, res, next) => {

    console.log("User:", req.body);

    next();
}, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));
app.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.session.destroy(function (err) {

            res.clearCookie('connect.sid');

            res.redirect('/login');
        });
    });
});

app.use('/admin', checkAuthenticated, checkRole('admin'));
app.use('/student', checkAuthenticated, checkRole('student'));
app.use('/teacher', checkAuthenticated, checkRole('teacher'));
app.use('/ao', checkAuthenticated, checkRole('ao'));

app.get('/student/home', checkAuthenticated, checkRole('student'), (req, res) => {
    res.render('Home-Student',{ user: req.user });
});
app.get('/teacher/home',function(req,res){
    res.render('Home-Teacher');
});
app.get('/admin/home', checkAuthenticated, checkRole('admin'), (req, res) => {
    res.render('Home-Admin',{ user: req.user });
});
app.get('/ao/submit', checkAuthenticated, checkRole('ao'), (req, res) => {
    res.render('Submit-Attendance',{ user: req.user });
});

const DEFAULT_PASSWORD = 'webPro2026';

function createAccount(role) {
    return new Promise(async (resolve, reject) => {
        try {
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

            db.get(`SELECT MAX(user_id) as maxId FROM Users`, (err, row) => {
                if (err) {
                    console.error('Database Error:', err.message);
                    return resolve({ success: false, error: err.message });
                }
                let nextId = (row.maxId || 0) + 1;


                let prefix = 'u';
                if (role === 'student') prefix = 's';
                if (role === 'teacher') prefix = 't';
                if (role === 'admin') prefix = 'a';
                if (role === 'ao') prefix = 'ao';

                const generatedUsername = `${prefix}${String(nextId).padStart(4, '0')}`;

                const sql = `INSERT INTO Users (username, password, role) VALUES (?,?,?)`;

                db.run(sql, [generatedUsername, hashedPassword, role], function (err) {
                    if (err) {
                        console.error('INSERT Error:', err.message);
                        return resolve({ success: false, error: err.message });
                    }
                    resolve({
                        success: true,
                        user: {
                            id: this.lastID,
                            username: generatedUsername,
                            role: role
                        }
                    });
                });
            })
        } catch (error) {
            console.error('Hash Error:', error);
            resolve({ success: false, error: error.message });
        }
    });
};

app.post('/admin/add-users/:role', checkAuthenticated, checkRole('admin'), async (req, res) => {
    const requestedRole = req.params.role;
    console.log('requestedRole: ',requestedRole);

    const allowedRoles = ['student', 'teacher', 'admin', 'ao'];

    if (!allowedRoles.includes(requestedRole)) {
        return res.status(400).json({
            message: 'ไม่สามารถสร้างบัญชีได้',
            error: 'รูปแบบ Role ไม่ถูกต้อง (รับเฉพาะ student, teacher, admin, ao เท่านั้น)'
        });
    }

    const result = await createAccount(requestedRole);

    if (result.success) {
        res.status(201).json({
            message: 'สร้างบัญชีเรียบร้อย',
            details: result.user
        })
    } else {
        res.status(500).json({
            message: 'ไม่สามารถสร้างบัญชีได้',
            error: result.error
        });
    }
});


function checkRole(role) {
    return function (req, res, next) {
        if (req.user && req.user.role === role) {
            return next();
        }
        console.log(`user: ${req.user.username} พยายามเข้าถึงหน้าที่ไม่มีสิทธิ์`);
        res.redirect('/');
    }
}
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}
app.get('/admin/home',function(req,res){
    res.render('Home-Admin');
});

// Japan's Pages
function handleError(err, res) {
    console.error(err);
    res.status(500).send("Error retrieving exam schedule");
    return;
}

// Manage Exam Schedule Page
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
    const sql1 = 'SELECT year FROM Year ORDER BY year DESC';
    const sql2 = 'SELECT * FROM Exam_Schedule WHERE year = ? AND semester = ? AND grade_level = ? AND type = ? ORDER BY date;';
    db.all(sql1, (err, year) => {
        if (err) {
            handleError(err, res);
            return;
        }
        let list;
        if (req.query.year && req.query.semester && req.query.grade && req.query.type) {
            list = [req.query.year, req.query.semester, req.query.grade, req.query.type];
        }
        else{
            list = [year[0].year, 1, 1, "กลางภาค"];
        }
        db.all(sql2, list, (err, result1) => {
            if (err) {
                handleError(err, res);
                return;
            }
            let exam_ids = [];
            let dates = [];
            let entries = {};
            result1.forEach(exam => {
                exam_ids.push(exam.exam_id);
                entries[`${exam.exam_id}`] = [];
                dates.push(exam.date);
            });
            const sql3 = `
            SELECT entry_id, start, end, subject_id, exam_id
            FROM Exam_Schedule_Entries 
            JOIN EXAM_Schedule
            USING (exam_id)
            WHERE exam_id IN (${exam_ids.map(() => '?').join(',')})
            ORDER BY date;`;
            db.all(sql3, exam_ids, (err, result2) => {
                if (err) {
                    handleError(err, res);
                    return;
                }
                result2.forEach(entry => {
                    entries[`${entry.exam_id}`].push(entry);
                });
                res.render('Manage-Exam', {year: year, exam_ids: exam_ids, entries: entries, dates: dates, query: req.query});
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

app.delete('/admin/exam-schedule/deleteExam', (req, res) => {
    console.log(req.body);
    const sql1 = 'DELETE FROM Exam_Schedule_Entries WHERE exam_id = ?';
    const sql2 = 'DELETE FROM Exam_Schedule WHERE exam_id = ?';
    db.run(sql1, [req.body.exam_id], err => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error deleting exam entries");
        }
        else {
            db.run(sql2, [req.body.exam_id], err => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send("Error deleting exam schedule");
                } 
                else {
                    console.log("Exam Schedule Deleted");
                    res.status(200).send("Exam schedule deleted successfully");
                }
            });
        }
    });
});

app.delete('/admin/exam-schedule/deleteAll', (req, res) => {
    const sql1 = 'DELETE FROM Exam_Schedule_Entries';
    const sql2 = 'DELETE FROM Exam_Schedule';
    db.run(sql1, err => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error deleting exam entries");
        } else {
            db.run(sql2, err => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send("Error deleting exam schedules");
                } else {
                    console.log("All Exam Schedules Deleted");
                    res.status(200).send("All exam schedules deleted successfully");
                }
            });
        }
    });
});

// Student view exam schedule
app.get('/student/exam-schedule', (req, res) => {
    const sqlGetStudent = 'SELECT *  FROM Users JOIN Students USING(user_id) JOIN Rooms USING(room_id) WHERE user_id = ?';
    const sqlGetExamSchedule = 'SELECT * FROM Exam_Schedule WHERE grade_level = ? AND semester = ? AND year = ? AND type = ?';
    db.get(sqlGetStudent, [req.user.user_id], (err, student) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error retrieving student information");
            return;
        }
        let type;
        if (req.query.type) {
            type = req.query.type;
        }
        else {
            type = "กลางภาค";
        }
        db.all(sqlGetExamSchedule, [student.year-student.enroll_year+1, student.semester, student.year, type], (err, examSchedule) => {
            if (err) {
                console.error(err.message);
                res.status(500).send("Error retrieving exam schedule");
            }
            let entries = {};
            examSchedule.forEach(exam => {
                entries[`${exam.exam_id}`] = [];
            });
            const sqlGetEntries = `SELECT * FROM Exam_Schedule_Entries JOIN Subjects USING(subject_id) WHERE exam_id IN (${examSchedule.map(exam => exam.exam_id).join(',')});`;
            db.all(sqlGetEntries, (err, result) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send("Error retrieving exam entries");
                }
                result.forEach(entry => {
                    entries[`${entry.exam_id}`].push(entry);
                });
                // console.log(entries);
                console.log(student);
                res.render('View-Exam.ejs', {examSchedule: examSchedule, entries: entries, student: student, type: type});
            });
        });
    });
});

app.listen(port, () => {
    console.log("Server started.");
    // createAccount('student').then(result => {
    //     if (result.success) {
    //         console.log('Admin account created:', result.user);
    //     } else {
    //         console.error('Error creating admin account:', result.error);
    //     }
    // });
});