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

app.get('/student/home', checkAuthenticated, (req, res) => {
    const userId = req.user.user_id; 

    const sql = `SELECT * FROM Users
                 JOIN Students ON Students.user_id = Users.user_id
                 JOIN Rooms ON Students.room_id = Rooms.room_id
                 WHERE Students.user_id = ?`;

    db.get(sql, [userId], (err, studentData) => {
        if (err) {
            console.error(err.message);
            return res.render('Home-Student', { user: req.user, student: {} });
        }

        res.render('Home-Student', { 
            user: req.user,
            student: studentData || {} 
        });
    });
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

// Attendance Page

app.get('/student/attendance', checkAuthenticated, checkRole('student'), async (req, res) => {
    try {
        const userId = req.user.user_id; 

        // 1. ดึงข้อมูลนักเรียน (ใช้ db.get ของ SQLite)
        const sqlStudent = `
    SELECT 
        s.student_id, 
        s.first_name, 
        s.last_name, 
        s.year, 
        s.room_id, 
        s.enroll_year, 
        r.room_name, 
        r.grade_level
    FROM Students s
    LEFT JOIN Rooms r ON r.room_id = s.room_id
    WHERE s.user_id = ?
`;
        const student = await new Promise((resolve, reject) => {
            db.get(sqlStudent, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!student) {
            return res.status(404).send('ไม่พบข้อมูลนักเรียนในระบบ');
        }

        // --- ระบบ FILTER (แบบไดนามิก) ---
        const today = new Date();
        let currentAcademicYear = today.getFullYear();
        
        // เช็กเดือนปัจจุบัน: ถ้าเป็น ม.ค. - เม.ย. (เดือน 0-3) ถือเป็นปีการศึกษาเก่า
        if (today.getMonth() < 4) {
            currentAcademicYear--;
        }

        // สร้างรายการปีการศึกษาทั้งหมดที่เลือกได้ (ดึงค่า enroll_year ถ้าไม่มีใช้ปีปัจจุบัน)
        let enrollYear = student.enroll_year || currentAcademicYear;
        if (enrollYear > 2500) {
            enrollYear = enrollYear - 543;
        }
        const availableYears = [];
        for (let y = enrollYear; y <= currentAcademicYear; y++) {
            availableYears.push(y);
        }

        // กำหนดค่า Default หากเปิดหน้าเว็บครั้งแรก (เทอมปัจจุบัน)
        const currentTerm = (today.getMonth() >= 4 && today.getMonth() <= 9) ? '1' : '2';
        
        // รับค่าที่เลือกมาจาก Dropdown
        const selectedTerm = req.query.term || currentTerm;
        const selectedYear = req.query.year || currentAcademicYear.toString();

        // แปลงเทอมเป็นช่วงวันที่ เพื่อเอาไป Query Database
        let startDate, endDate;
        if (selectedTerm === '1') {
            startDate = `${selectedYear}-05-01`; 
            endDate = `${selectedYear}-10-31`;   
        } else {
            startDate = `${selectedYear}-11-01`;             
            endDate = `${parseInt(selectedYear) + 1}-03-31`; 
        }

        // 2. ดึงประวัติการเข้าเรียนเฉพาะช่วงวันที่ Filter ไว้
        const sqlAttendance = `
            SELECT date, status 
            FROM Attendance 
            WHERE student_id = ? AND date >= ? AND date <= ? 
            ORDER BY date DESC
        `;
        const attendanceHistory = await new Promise((resolve, reject) => {
            db.all(sqlAttendance, [student.student_id, startDate, endDate], (err, rows) => {
                if (err) reject(err);
                // ถ้าไม่มีข้อมูลเลย ให้ส่ง Array ว่าง [] กลับไป จะได้ไม่ Error ตอน forEach
                else resolve(rows || []); 
            });
        });

        // 3. คำนวณยอดรวม (Summary)
        // คราวนี้ attendanceHistory จะเป็น Array แล้ว ใช้ forEach ได้เลยครับ!
        const summary = { present: 0, absent: 0, late: 0 };
        attendanceHistory.forEach(record => {
            if (record.status === 'Present') summary.present++;
            if (record.status === 'Absent') summary.absent++;
            if (record.status === 'Late') summary.late++;
        }); 

        // 4. เตรียมข้อมูลให้ Chart.js (แยกนับยอดรายเดือน)
        const chartData = { labels: [], present: [], late: [], absent: [] };
        const months = selectedTerm === '1' 
            ? [{m:5, l:'May'}, {m:6, l:'Jun'}, {m:7, l:'Jul'}, {m:8, l:'Aug'}, {m:9, l:'Sep'}, {m:10, l:'Oct'}]
            : [{m:11, l:'Nov'}, {m:12, l:'Dec'}, {m:1, l:'Jan'}, {m:2, l:'Feb'}, {m:3, l:'Mar'}];

        months.forEach(month => {
            chartData.labels.push(month.l);
            const recordsInMonth = attendanceHistory.filter(r => {
                const rMonth = new Date(r.date).getMonth() + 1; 
                return rMonth === month.m;
            });
            
            chartData.present.push(recordsInMonth.filter(r => r.status === 'Present').length);
            chartData.late.push(recordsInMonth.filter(r => r.status === 'Late').length);
            chartData.absent.push(recordsInMonth.filter(r => r.status === 'Absent').length);
        });

        // 5. ส่งข้อมูลทั้งหมดไปที่ EJS
        res.render('attendance', { 
            user: req.user, 
            student: student, 
            attendance: attendanceHistory, 
            summary: summary,
            selectedTerm: selectedTerm,
            selectedYear: selectedYear,
            availableYears: availableYears,
            chartData: JSON.stringify(chartData) 
        });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send("Internal Server Error");
    }
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