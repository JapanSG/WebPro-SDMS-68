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

const multer = require('multer');
const storage = multer.memoryStorage();
const uploads = multer({ storage: storage });

let db = new sqlite3.Database('school.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    db.run("PRAGMA foreign_keys = ON;", (err) => {
        if (err) {
            console.log("Failed to turn on foreign key check");
        }
    })
    console.log('Connected to the SQlite database.');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const initializePassport = require('./passport-config');
const { create } = require("domain");
initializePassport(passport, db);

app.use(express.static('public'));
app.set('view engine', 'ejs');


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
        maxAge: 1000 * 60 * 60 * 24
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
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.render('login', {
                messages: { error: info.message },
                lastUsername: req.body.username
            });
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            if (req.body.remember) {
                const age = 1000 * 60 * 60 * 24;
                req.session.cookie.maxAge = age;
            } else {
                req.session.cookie.expires = false;
            }
            console.log(`System: User ${user.username} successfully logged in.`);
            return res.redirect('/');
        });
    })(req, res, next);
});

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

app.get('/student/home', (req, res) => {
    const userId = req.user.user_id;

    const sql = `SELECT * FROM Students
                 JOIN Users ON Students.user_id = Users.user_id
                 JOIN Rooms ON Students.room_id = Rooms.room_id
                 WHERE Students.user_id = ?`;

    db.get(sql, [userId], (err, studentData) => {
        if (err) {
            console.error(err.message);
            return res.render('Home-Student', { user: req.user, student: {} });
        }

        if (studentData && studentData.profile_picture) {
            const base64Image = studentData.profile_picture.toString('base64');
            studentData.profilePictureBase64 = `data:image/jpeg;base64,${base64Image}`;
        } else if (studentData) {
            studentData.profilePictureBase64 = '/images/icons/User.svg';
        }

        res.render('Home-Student', {
            user: req.user,
            student: studentData || {}
        });
    });
});

app.get('/teacher/home', function (req, res) {
    const userId = req.user.user_id;

    const sql = `SELECT * FROM Teacher 
                JOIN Users ON Teacher.user_id = Users.user_id 
                WHERE Teacher.user_id = ?`;

    db.get(sql, [userId], (err, teacherData) => {
        if (err) {
            console.error(err.message);
            return res.render('Home-Teacher', { user: req.user, student: {} });
        }

        if (teacherData && teacherData.profile_picture) {
            const base64Image = teacherData.profile_picture.toString('base64');
            teacherData.profilePictureBase64 = `data:image/jpeg;base64,${base64Image}`;
        } else if (teacherData) {
            teacherData.profilePictureBase64 = '/images/icons/User.svg';
        }

        res.render('Home-Teacher', {
            user: req.user,
            teacher: teacherData || {}
        });
    });
});

app.get('/admin/home', async (req, res) => {
    try {
        const getCount = (sql) => {
            return new Promise((resolve, reject) => {
                db.get(sql, [], (err, row) => {
                    if (err) reject(err);
                    resolve(row && row.count ? row.count : 0);
                });
            });
        };

        const [totalStudents, totalTeachers, totalSubjects, activeClasses] = await Promise.all([
            getCount("SELECT COUNT(*) as count FROM Students"),
            getCount("SELECT COUNT(*) as count FROM Teacher"),
            getCount("SELECT COUNT(*) as count FROM Subjects"),
            getCount("SELECT COUNT(*) as count FROM Rooms WHERE status = 'Active'")
        ]);

        res.render('Home-Admin', {
            user: req.user,
            stats: { totalStudents, totalTeachers, totalSubjects, activeClasses }
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.render('Home-Admin', {
            user: req.user,
            stats: { totalStudents: 0, totalTeachers: 0, totalSubjects: 0, activeClasses: 0 }
        });
    }
});

//  Submit Attendance Page
// =====================================================================
// [GET] หน้าเว็บสำหรับเช็คชื่อนักเรียน (Submit Attendance)
// =====================================================================
app.get('/ao/submit', (req, res) => {
    const { grade, room, date } = req.query;

    // ถ้าเปิดมาครั้งแรก (ยังไม่กด Filter) ให้แสดงหน้าเปล่าๆ รอไว้
    if (!grade || !room || !date) {
        return res.render('Submit-Attendance', {
            user: req.user,
            students: [],
            filterData: { grade: '', room: '', date: '' }
        });
    }

    // แปลงข้อมูลให้ตรงกับ Database
    // grade_level ใน DB เป็น Int (เช่น 1)
    const gradeInt = parseInt(grade);

    // room_name ใน DB เป็น Text (เช่น "1/1")
    const roomNameStr = `${grade}/${room}`;

    // คำสั่ง SQL ดึงรายชื่อเด็กในห้อง + สถานะการมาเรียนของวันนั้น (ถ้ามี)
    const sql = `
        SELECT s.student_id, s.first_name, s.last_name, a.status
        FROM Students s
        JOIN Rooms r ON s.room_id = r.room_id
        LEFT JOIN Attendance a ON s.student_id = a.student_id AND a.date = ?
        WHERE r.grade_level = ? AND r.room_name = ?
        ORDER BY s.student_id ASC
    `;

    db.all(sql, [date, gradeInt, roomNameStr], (err, students) => {
        if (err) {
            console.error("Error fetching students:", err.message);
            students = [];
        }

        res.render('Submit-Attendance', {
            user: req.user,
            students: students,
            filterData: { grade, room, date }
        });
    });
});

// =====================================================================
// [POST] บันทึกข้อมูลการเช็คชื่อลง Database
// =====================================================================
app.post('/ao/submit/save', checkAuthenticated, checkRole('ao'), (req, res) => {
    const data = req.body;
    const attendanceDate = data.attendance_date;
    const grade = data.grade;
    const room = data.room;

    // ลูปหาเฉพาะข้อมูลที่มาจากปุ่มสถานะ (status_รหัสนักเรียน)
    for (const key in data) {
        if (key.startsWith('status_')) {
            const studentId = key.replace('status_', ''); // ตัดคำว่า status_ ออก เหลือแค่รหัส
            const status = data[key]; // จะได้ค่า 'Present', 'Absent', หรือ 'Late'

            console.log(studentId);
            console.log(status);
            console.log(attendanceDate);

            // คำสั่ง UPSERT: ถ้าไม่เคยเช็คชื่อวันนี่ให้เพิ่มใหม่ แต่ถ้าเคยแล้วให้อัปเดตสถานะทับ
            const sqlUpsert = `
                INSERT INTO Attendance (student_id, date, status) 
                VALUES (?, ?, ?)
                ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status
            `;

            db.run(sqlUpsert, [studentId, attendanceDate, status], (err) => {
                if (err) {
                    console.error(`Error saving attendance for ${studentId}:`, err.message);
                }
            });
        }
    }

    // บันทึกเสร็จแล้ว Redirect กลับไปหน้าเดิมพร้อมตัวกรอง จะได้เห็นข้อมูลที่อัปเดต
    res.redirect(`/ao/submit?grade=${grade}&room=${room}&date=${attendanceDate}`);
});

// Attendance Page

// =====================================================================
// [GET] หน้าเว็บสำหรับดูประวัติการเข้าเรียน (Attendance)
// =====================================================================
app.get('/student/attendance', checkAuthenticated, checkRole('student'), async (req, res) => {
    try {
        const userId = req.user.user_id;

        // 1. ดึงข้อมูลนักเรียน
        const sqlStudent = `
            SELECT s.student_id, s.first_name, s.last_name, s.year, s.room_id, s.enroll_year, r.room_name, r.grade_level
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

        // ==========================================
        // 2. ระบบ FILTER (ค้นหารายเดือน แบบอิสระ)
        // ==========================================
        const today = new Date();
        const currentYear = today.getFullYear().toString(); // ค.ศ.
        // ทำให้เดือนเป็น 2 หลักเสมอ เช่น '03', '12'
        const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0'); 

        // รับค่า ปี และ เดือน จาก Dropdown (ถ้าเปิดมาครั้งแรกให้โชว์เดือนปัจจุบัน)
        const selectedYear = req.query.year || currentYear;
        const selectedMonth = req.query.month || currentMonth;

        // แปลงเป็นช่วงวันที่ เช่น '2026-03-01' ถึง '2026-03-31'
        const startDate = `${selectedYear}-${selectedMonth}-01`;
        // ทริค: หาวันสุดท้ายของเดือนนั้นๆ อัตโนมัติ (เผื่อกุมภาพันธ์มี 28 หรือ 29 วัน)
        const lastDayOfMonth = new Date(selectedYear, parseInt(selectedMonth), 0).getDate();
        const endDate = `${selectedYear}-${selectedMonth}-${lastDayOfMonth}`;

        // 3. ดึงประวัติการเข้าเรียนเฉพาะในเดือนที่เลือก
        const sqlAttendance = `
            SELECT date, status 
            FROM Attendance 
            WHERE student_id = ? AND date >= ? AND date <= ? 
            ORDER BY date DESC
        `;
        const attendanceHistory = await new Promise((resolve, reject) => {
            db.all(sqlAttendance, [student.student_id, startDate, endDate], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // 4. คำนวณยอดรวม (Summary) ประจำเดือน
        const summary = { present: 0, absent: 0, late: 0, personal_leave: 0 };
        attendanceHistory.forEach(record => {
            if (record.status === 'Present') summary.present++;
            if (record.status === 'Absent') summary.absent++;
            if (record.status === 'Late') summary.late++;
            if (record.status === 'Personal Leave') summary.personal_leave++;
        });

        // 5. เตรียมข้อมูลให้ Chart.js (โชว์กราฟรายวัน 1-31 ของเดือนนั้น)
        const chartData = { labels: [], present: [], late: [], absent: [], personal_leave: [] };
        
        for (let d = 1; d <= lastDayOfMonth; d++) {
            chartData.labels.push(d.toString()); // แกน X เป็นวันที่ 1, 2, 3...
            
            // หาวันที่ตรงกับลูป (เช่น '2026-03-05')
            const dateStr = `${selectedYear}-${selectedMonth}-${d.toString().padStart(2, '0')}`;
            const record = attendanceHistory.find(r => r.date === dateStr);

            // ถ้าวันนั้นมาเรียน ใส่ 1 ถ้าไม่มา ใส่ 0
            chartData.present.push(record && record.status === 'Present' ? 1 : 0);
            chartData.late.push(record && record.status === 'Late' ? 1 : 0);
            chartData.absent.push(record && record.status === 'Absent' ? 1 : 0);
            chartData.personal_leave.push(record && record.status === 'Personal Leave' ? 1 : 0);
        }

        // สร้างรายการปีให้ Dropdown (ย้อนหลัง 5 ปี)
        const availableYears = [];
        for (let y = parseInt(currentYear) - 5; y <= parseInt(currentYear); y++) {
            availableYears.push(y);
        }

        // 6. ส่งข้อมูลทั้งหมดไปที่ EJS
        res.render('attendance', {
            user: req.user,
            student: student,
            attendance: attendanceHistory,
            summary: summary,
            selectedMonth: selectedMonth, 
            selectedYear: selectedYear,
            availableYears: availableYears,
            chartData: JSON.stringify(chartData)
        });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send("Internal Server Error");
    }
});






app.get('/student/attendance_history', (req, res) => {
    const studentId = req.query.student_id;


    if (!studentId) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลนักเรียน' });
    }

    const sql = `
        SELECT * FROM Attendance 
        WHERE student_id = ? 
        ORDER BY date DESC 
        LIMIT 7
    `;
    const params = [studentId];

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json(rows);
    })
})


const upload = multer({ storage: multer.memoryStorage() });

app.post('/user/upload-profile', upload.single('profile_pic'), checkAuthenticated, (req, res) => {
    const userId = req.user.user_id;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, error: 'ไม่มีไฟล์ส่งมา' });
    }

    const imageBuffer = file.buffer;

    const sql = `UPDATE Users SET profile_picture = ? WHERE user_id = ?`;
    const params = [imageBuffer, userId];

    db.run(sql, params, function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, message: 'อัปเดตโปรไฟล์เรียบร้อย' });
    });
});

app.post('/event/add', checkAuthenticated, (req, res) => {
    const { date, time, title } = req.body;

    const userId = req.user.user_id;

    if (!date || !time || !title) {
        return res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const sql = `INSERT INTO Todo_List (date, time, title, user_id) VALUES (?, ?, ?, ?)`;

    db.run(sql, [date, time, title, userId], function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, message: 'บันทึกกิจกรรมเรียบร้อย' });
    });
});

app.get('/event/list', checkAuthenticated, (req, res) => {
    const targetDate = req.query.date;

    const userId = req.user.user_id;

    if (!targetDate) {
        return res.status(400).json({ error: 'กรุณาระบุวันที่' });
    }

    const sql = `SELECT * FROM Todo_List WHERE date = ? AND user_id = ? ORDER BY time ASC`;

    db.all(sql, [targetDate, userId], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

function createAccount(role) {
    return new Promise(async (resolve, reject) => {
        try {
            const DEFAULT_PASSWORD = 'webPro2026';
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

            db.get(`SELECT username FROM Users WHERE role = ? ORDER BY user_id DESC LIMIT 1`, [role], (err, row) => {
                if (err) {
                    console.error('Database Error:', err.message);
                    return resolve({ success: false, error: err.message });
                }
                let nextId = 1;

                if (row && row.username) {
                    const numberPart = row.username.match(/\d+/);
                    if (numberPart) {
                        nextId = parseInt(numberPart[0], 10) + 1;
                    }
                }

                const allowedRoles = ['student', 'teacher', 'admin', 'ao'];

                if (!allowedRoles.includes(role)) {
                    console.log('Invalid Role');
                    return resolve({
                        success: false,
                        error: 'Invalid Role: Only student, teacher, admin, and ao are allowed.'
                    });
                }

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
                    console.log("Create User Account Success:", generatedUsername);
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
    console.log('requestedRole: ', requestedRole);

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


// Japan's Pages
function handleError(err, res) {
    console.error(err);
    res.status(500).send("Error retrieving exam schedule");
    return;
}

// Manage Exam Schedule Page
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
        else {
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
            SELECT entry_id, start, end, subject_id, exam_id, subject_name
            FROM Exam_Schedule_Entries 
            JOIN EXAM_Schedule
            USING (exam_id)
            JOIN Subjects
            USING (subject_id)
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
                res.render('Manage-Exam', { year: year, exam_ids: exam_ids, entries: entries, dates: dates, query: req.query });
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
        res.render('View-Exam', { exam: result });
    });
});

app.post('/admin/exam-schedule/addExam', (req, res) => {
    console.log("", req.body);
    db.run('INSERT INTO Exam_Schedule (exam_id, date, semester, year, type, grade_level) VALUES (NULL, ?, ?, ?, ?, ?)', [req.body.date, req.body.semester, req.body.year, req.body.type, req.body.grade], function (err) {
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
    db.run(sql, params, function (err) {
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

// ==========================================
// Muftee's Pages (Subject Management)
// ==========================================


app.get('/admin/subject', checkAuthenticated, checkRole('admin'), (req, res) => {
    const searchQuery = req.query.search || '';
    const currentPage = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (currentPage - 1) * limit;

    let sql = "SELECT * FROM Subjects";
    let countSql = "SELECT COUNT(*) as count FROM Subjects";
    let params = [];

    if (searchQuery) {
        sql += " WHERE subject_id LIKE ? OR subject_name LIKE ?";
        countSql += " WHERE subject_id LIKE ? OR subject_name LIKE ?";
        params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    sql += " LIMIT ? OFFSET ?";

    db.get(countSql, params, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database Error");
        }

        const totalItems = row.count;
        const totalPages = Math.ceil(totalItems / limit);
        const finalParams = [...params, limit, offset];

        db.all(sql, finalParams, (err, subjects) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database Error");
            }

            res.render('Manage-Subject-Admin', {
                user: req.user,
                subjects: subjects,
                searchQuery: searchQuery,
                currentPage: currentPage,
                totalPages: totalPages,
                errorMsg: req.query.error || null,
                successMsg: req.query.success || null
            });
        });
    });
});

app.get('/admin/subject/add', checkAuthenticated, checkRole('admin'), (req, res) => {

    const sql = "SELECT teacher_id, first_name, last_name FROM Teacher";

    db.all(sql, [], (err, teachers) => {
        if (err) {
            console.error("Error fetching teachers:", err.message);
            return res.status(500).send("Database Error");
        }
        // ส่งทั้ง user และ teachers ไปที่หน้า Add-Subject-Admin
        res.render('Add-Subject-Admin', {
            user: req.user,
            teachers: teachers || []
        });
    });
});
app.post('/admin/subject/add', checkAuthenticated, checkRole('admin'), (req, res) => {

    const { subject_id, subject_name, credit, grade_level, teacher_id } = req.body;


    const sql = "INSERT INTO Subjects (subject_id, subject_name, grade_level, credit, teacher_id) VALUES (?, ?, ?, ?, ?)";


    db.run(sql, [subject_id, subject_name, grade_level, credit, teacher_id || null], function (err) {
        if (err) {
            console.error("Error inserting subject:", err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการบันทึกข้อมูล (รหัสวิชาอาจซ้ำ หรือข้อมูลไม่ครบ)");
        }

        res.redirect('/admin/subject');
    });
});



app.get('/admin/subject/edit/:id', checkAuthenticated, checkRole('admin'), (req, res) => {
    const subjectId = req.params.id;
    const sql = "SELECT * FROM Subjects WHERE subject_id = ?";

    db.get(sql, [subjectId], (err, subject) => {
        if (err) {
            console.error("Error fetching subject:", err.message);
            return res.status(500).send("Database Error");
        }
        if (!subject) {
            return res.status(404).send("ไม่พบวิชานี้ในระบบ");
        }


        res.render('Edit-Subject-Admin', { user: req.user, subject: subject });
    });
});

app.post('/admin/subject/edit/:id', checkAuthenticated, checkRole('admin'), (req, res) => {
    const old_subject_id = req.params.id;

    const { subject_id, subject_name, credit, grade_level, teacher_id } = req.body;


    const t_id = (teacher_id && teacher_id.trim() !== "") ? teacher_id : null;

    const sql = `
        UPDATE Subjects 
        SET subject_id = ?, subject_name = ?, grade_level = ?, credit = ?, teacher_id = ? 
        WHERE subject_id = ?
    `;


    db.run(sql, [subject_id, subject_name, grade_level, credit, t_id, old_subject_id], function (err) {
        if (err) {
            console.error("Error updating subject:", err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการอัปเดตข้อมูล (รหัสวิชาใหม่อาจไปซ้ำ หรือรหัสอาจารย์ไม่มีจริง)");
        }

        res.redirect('/admin/subject');
    });
});

app.get('/admin/subject/delete/:id', checkAuthenticated, checkRole('admin'), (req, res) => {
    const subjectId = req.params.id;
    const sql = "DELETE FROM Subjects WHERE subject_id = ?";

    db.run(sql, [subjectId], function (err) {
        if (err) {
            console.error("Error deleting subject:", err.message);

            const errorMsg = "ไม่สามารถลบวิชานี้ได้ เนื่องจากมีการใช้งานอยู่ในตารางเรียนหรือตารางสอบ";
            return res.redirect('/admin/subject?error=' + encodeURIComponent(errorMsg));
        }


        const successMsg = "ลบรายวิชาสำเร็จ";
        res.redirect('/admin/subject?success=' + encodeURIComponent(successMsg));
    });
});

app.get('/student/class-schedule', checkAuthenticated, checkRole('student'), (req, res) => {
    const userId = req.user.user_id;
    const targetSemester = 1;
    const targetYear = 2569;


    const studentSql = `
        SELECT s.room_id, r.room_name 
        FROM Students s
        LEFT JOIN Rooms r ON s.room_id = r.room_id
        WHERE s.user_id = ?
    `;

    db.get(studentSql, [userId], (err, student) => {
        if (err) {
            console.error("Error fetching student room:", err.message);
            return res.status(500).send("Database Error: ไม่สามารถค้นหาข้อมูลห้องเรียนได้");
        }


        if (!student || !student.room_id) {
            return res.send("<h2>ไม่พบข้อมูลห้องเรียนของคุณ หรือคุณยังไม่ได้ถูกจัดเข้าห้องเรียน</h2>");
        }

        const roomId = student.room_id;
        const roomName = student.room_name || roomId;


        const scheduleSql = `
            SELECT sch.day, sch.period, sub.subject_id, sub.subject_name, t.first_name, t.last_name
            FROM Schedule sch
            LEFT JOIN Subjects sub ON sch.subject_id = sub.subject_id
            LEFT JOIN Teacher t ON sub.teacher_id = t.teacher_id
            WHERE sch.room_id = ? AND sch.semester = ? AND sch.year = ?
            ORDER BY sch.day, sch.period
        `;

        db.all(scheduleSql, [roomId, targetSemester, targetYear], (err, schedules) => {
            if (err) {
                console.error("Error fetching class schedule:", err.message);
                return res.status(500).send("Database Error: ไม่สามารถดึงข้อมูลตารางเรียนได้");
            }

            // 3. จัดกลุ่มข้อมูลลงใน Array แบบ 2 มิติ ให้หน้าเว็บเอาไปวนลูปง่ายๆ
            const timetable = { 'วันจันทร์': {}, 'วันอังคาร': {}, 'วันพุธ': {}, 'วันพฤหัสบดี': {}, 'วันศุกร์': {} };

            schedules.forEach(item => {
                if (timetable[item.day]) {
                    timetable[item.day][item.period] = item;
                }
            });

            // 4. ส่งไปที่ไฟล์ EJS (สังเกตว่าส่ง roomName ไปแทน roomId แล้ว)
            console.log(schedules);
            res.render('Schedule', {
                user: req.user,
                timetable: timetable,
                year: targetYear,
                semester: targetSemester,
                roomName: roomName
            });
        });
    });
});





// ==========================================
app.put('/admin/exam-schedule/editDate', (req, res) => {
    console.log(req.body);
    const sql = 'UPDATE Exam_Schedule SET date = ? WHERE exam_id = ?';
    db.run(sql, [req.body.date, req.body.exam_id], err => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error editing exam date");
        }
        else {
            console.log("Exam Date Edited");
            res.status(200).send("Exam date edited successfully");
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
        db.all(sqlGetExamSchedule, [student.year - student.enroll_year + 1, student.semester, student.year, type], (err, examSchedule) => {
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
                res.render('View-Exam.ejs', { examSchedule: examSchedule, entries: entries, student: student, type: type });
            });
        });
    });
});

//submit grade page
app.get('/teacher/grade', (req, res) => {
    const getSubjectSQL = `SELECT * FROM Subjects JOIN Teacher USING (teacher_id) WHERE user_id = ${req.user.user_id}`
    db.all(getSubjectSQL, (err, subjects) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error retrieving exam entries");
            return;
        }
        let selectedSubject;
        if (req.query.subject) {
            selectedSubject = req.query.subject
        }
        else if (subjects.length > 0) {
            selectedSubject = subjects[0].subject_id
        }
        const getStudentSQL = ` SELECT *
                                FROM Students st
                                JOIN Rooms
                                USING (room_id)
                                WHERE Rooms.grade_level = (SELECT grade_level 
                                                            FROM Subjects
                                                            WHERE subject_id = ${selectedSubject}
                                                            )
                                ORDER BY room_id, student_id;`
        db.all(getStudentSQL, (err, students) => {
            if (err) {
                console.error(err.message);
                res.status(500).send("Error retrieving exam entries");
                return;
            }
            let grades = {};
            const getGradesSQL = `SELECT student_id, grade FROM Grade_Entries JOIN Subjects USING (subject_id) WHERE subject_id = ${selectedSubject} AND year = (SELECT max(year) FROM Year);`;
            db.all(getGradesSQL, (err, result) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send("Error retrieving exam entries");
                    return;
                }
                result.forEach(grade => {
                    grades[`${grade.student_id}`] = grade;
                });
                res.render('Submit-Grades.ejs', { subjects: subjects, students: students, selected: selectedSubject, grades: grades });
            });
        });
    });
});

function updateGrade(student_id, value, subject, res) {
    const checkSQL = `SELECT * FROM Grade_Entries WHERE student_id = ${student_id} AND subject_id = ${subject} AND year = (SELECT max(year) FROM Year);`
    value = value.trim();
    db.get(checkSQL, (err, result) => {
        if (err) {
            console.error(err.message);
            res.status(500).send("Error getting grade entries while updating");
            return;
        }
        if (isNaN(value) || (!value)) {
            return;
        }
        if (result) {
            db.run(`UPDATE Grade_Entries SET grade = ${value} WHERE grade_id = ${result.grade_id};`, (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send("Error updating grade entries");
                    return;
                }
            });
        }
        else {
            let sql = `INSERT INTO Grade_Entries (grade_id, student_id, year, subject_id, grade) VALUES (NULL, ${student_id}, (SELECT max(year) FROM Year), ${subject}, ${value})`;
            db.run(sql, (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).send("Error inserting new grade entries");
                    return;
                }
            })
        }
    });
}

app.put("/teacher/grade/submit", (req, res) => {
    let keys = Object.keys(req.body.values);
    keys.forEach(key => {
        updateGrade(key, req.body.values[key], req.body.subject, res);
    })

    res.send("Data Sent");
});

// Transcript Page
// =====================================================================
// [GET] หน้าเว็บสำหรับดูผลการเรียน (Transcript) ของนักเรียน
// =====================================================================
app.get('/student/transcript-grade', checkAuthenticated, checkRole('student'), async (req, res) => {
    try {
        const userId = req.user.user_id;

        // 1. ดึงข้อมูลประวัตินักเรียน (เพื่อเอาไปแสดง Header)
        const sqlStudent = `
            SELECT s.student_id, s.first_name, s.last_name, s.year, s.room_id, s.enroll_year, r.room_name, r.grade_level
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

        // ถ้าหาเด็กไม่เจอให้แจ้ง Error
        if (!student) return res.status(404).send('ไม่พบข้อมูลนักเรียนในระบบ');

        // ==========================================
        // 2. จัดการตัวกรองแบบอิสระ (ไม่ล็อคตามปฏิทิน)
        // ==========================================
        const currentYear = new Date().getFullYear(); // ปี ค.ศ. ปัจจุบัน (เช่น 2026)

        // รับค่าตัวกรองจาก URL (ถ้าเพิ่งกดเข้าเมนูมาครั้งแรก ให้ Default เป็นปีปัจจุบัน และ เทอม 1)
        const selectedTerm = req.query.term || '1';
        const selectedYear = req.query.year || currentYear.toString();

        // สร้าง Array ปีการศึกษาให้ Dropdown เลือกย้อนหลังได้ 5 ปี และเดินหน้า 1 ปี
        const availableYears = [];
        for (let y = currentYear - 5; y <= currentYear + 1; y++) {
            availableYears.push(y);
        }

        // ==========================================
        // 3. ดึงข้อมูลเกรดของเทอมและปีที่เลือก 
        // ==========================================
        const sqlGrades = `
            SELECT 
                g.subject_id, 
                s.subject_name, 
                s.credit, 
                g.grade 
            FROM Grade_Entries g
            LEFT JOIN Subjects s ON g.subject_id = s.subject_id
            WHERE g.student_id = ? AND g.year = ? AND g.semester = ?
        `;

        const grades = await new Promise((resolve, reject) => {
            // หมายเหตุ: ใน Database เราเก็บปีเป็น พ.ศ. เลยต้องเอา selectedYear (ค.ศ.) + 543 ก่อนเอาไปค้นหา
            db.all(sqlGrades, [student.student_id, parseInt(selectedYear) + 543, selectedTerm], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // ==========================================
        // 4. คำนวณเกรดเฉลี่ย (GPA) ประจำเทอม
        // ==========================================
        let totalCredits = 0;
        let totalGradePoints = 0;

        grades.forEach(record => {
            const credit = parseFloat(record.credit) || 0;
            const grade = parseFloat(record.grade) || 0;

            totalCredits += credit;
            totalGradePoints += (grade * credit);
        });

        // ถ้ามีการลงทะเบียนเรียน (หน่วยกิต > 0) ให้คำนวณ GPA ทศนิยม 2 ตำแหน่ง
        const termGPA = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : '0.00';

        // 5. ส่งข้อมูลทั้งหมดแพ็คใส่กล่องไปให้ไฟล์ EJS
        res.render('Transcript', {
            user: req.user,
            student: student,
            grades: grades,
            termGPA: termGPA,
            totalCredits: totalCredits,
            selectedTerm: selectedTerm,
            selectedYear: selectedYear,
            availableYears: availableYears
        });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลผลการเรียน");
    }
});


app.get('/admin/record-stu', function (req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit; // ต้องข้ามกี่คน
    let whereSQL = '';
    const search = req.query.search || '';
    if (search !== '') { // ดูว่ามีคำค้นหา
        whereSQL = `WHERE student_id LIKE '%${search}%' OR first_name LIKE '%${search}%'`;
    }
    const query = `SELECT Students.rowid, * FROM Students JOIN Users ON Students.user_id = Users.user_id ${whereSQL} LIMIT ${limit} OFFSET ${offset}`;
    const count = `SELECT COUNT(*) AS total FROM Students ${whereSQL}`;
    db.get(count, (err, count_all) => {
        if (err) {
            console.log(err.message);
        }
        const totals = count_all ? count_all.total : 0;
        const totalPages = Math.ceil(totals / limit);
        db.all(query, (err, rows) => {
            if (err) {
                console.log(err.message);
            }
            res.render('Manage_Student_Records', { totalPeople: totals, students: rows, currentPage: page, totalPages: totalPages, searchKeyword: search });
        });
    });
});

//กด edit
app.get('/edit/student/:id', function (req, res) {
    const query = `
        SELECT Students.*, Users."profile_picture" 
        FROM Students 
        JOIN Users ON Students.user_id = Users.user_id 
        WHERE Students.rowid = ?`;

    db.get(query, [req.params.id], (err, row) => {
        if (err) return res.send("เกิดข้อผิดพลาด: " + err.message);
        if (!row) return res.send("ไม่พบข้อมูลนักเรียน");

        let imageBase64 = null;
        if (row["profile_picture"]) {
            imageBase64 = `data:image/jpeg;base64,${row["profile_picture"].toString('base64')}`;
        }

        // 1. ดึงข้อมูลตาราง Room
        db.all(`SELECT * FROM Rooms`, [], (err, rooms) => {
            if (err) return res.send("เกิดข้อผิดพลาด: " + err.message);

            // 2. ดึงข้อมูลตาราง Year
            db.all(`SELECT * FROM Year`, [], (err, years) => {
                if (err) return res.send("เกิดข้อผิดพลาด: " + err.message);

                // 3. ส่งข้อมูลทั้งหมดไปที่ EJS
                res.render('Edit-Student', {
                    data: row,
                    profileImg: imageBase64,
                    rooms: rooms || [],
                    years: years || []
                });
            });
        });
    });
});
app.post('/update/student/:id', uploads.single('profile_image'), (req, res) => {
    const studentRowId = req.params.id;
    const data = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    // 1. อัปเดตข้อมูลตัวหนังสือในตาราง Students
    const sqlUpdateStudent = `
        UPDATE Students SET 
        first_name = ?, last_name = ?, dob = ?, citizen_id = ?, sex = ?, student_id = ?,
        nationality = ?, phone = ?, email = ?, room_id = ?, 
        year = ?, semester = ?, enroll_year = ?
        WHERE rowid = ?
    `;

    const studentValues = [
        data.firstname, data.lastname, data.dob, data.citizen_id, data.gender, data.student_id,
        data.nationality, data.phone, data.email, data.room_id,
        data.year, data.semester, data.enroll_year, studentRowId
    ];

    db.run(sqlUpdateStudent, studentValues, function (err) {
        if (err) {
            console.error("Error detected:", err);
            // ส่ง Script ไปที่หน้าจอ เพื่อให้ Alert และสั่งถอยกลับ (ข้อมูลในฟอร์มจะยังอยู่)
            return res.send(`
                <script>
                    alert("เกิดข้อผิดพลาด: ${err.message}");
                    window.history.back(); 
                </script>
            `);
        }

        // 2. ถ้ามีการอัปโหลดรูปใหม่ ให้ไปอัปเดตที่ตาราง Users
        if (imageBuffer) {
            // หา user_id จาก rowid ก่อน
            db.get(`SELECT user_id FROM Students WHERE rowid = ?`, [studentRowId], (err, row) => {
                if (row && row.user_id) {
                    const sqlUpdateUser = `UPDATE Users SET "profile_picture" = ? WHERE user_id = ?`;
                    db.run(sqlUpdateUser, [imageBuffer, row.user_id], (err) => {
                        res.redirect('/admin/record-stu');
                    });
                } else {
                    res.redirect('/admin/record-stu');
                }
            });
        } else {
            res.redirect('/admin/record-stu');
        }
    });
})


app.get('/students', function (req, res) {
    // 1. ดึงข้อมูลตาราง Room
    db.all(`SELECT * FROM Rooms`, [], (err, rooms) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database Error");
        }

        // 2. ดึงข้อมูลตาราง Year
        db.all(`SELECT * FROM Year`, [], (err, years) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database Error");
            }

            // 3. ส่งข้อมูล rooms และ years ไปให้ไฟล์ EJS
            res.render('Add-Student', {
                rooms: rooms,
                years: years
            });
        });
    });
});
// ฟังก์ชันช่วยรัน SQL แบบรอผล (Promise)
const runSQL = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};
app.post('/add/student', uploads.single('profile_image'), async (req, res) => {
    let newUserId = null;
    const data = req.body;
    try {
        const imageBuffer = req.file ? req.file.buffer : null;

        // 1. สร้างบัญชีในตาราง Users
        const accountResult = await createAccount('student');

        if (!accountResult.success) {
            console.error("Create Account Error:", accountResult.error);
            return res.status(500).send("ไม่สามารถสร้างบัญชีผู้ใช้ได้: " + accountResult.error);
        }

        newUserId = accountResult.user.id;

        // 2. ถ้ามีรูปภาพ ให้อัปเดตไปที่ตาราง Users และรอจนเสร็จ (ใช้ await)
        if (imageBuffer) {
            // ตรวจสอบชื่อคอลัมน์อีกครั้ง: ถ้าเป็นขีดกลางใช้ "profile-picture"
            // ถ้าเป็น underscore ใช้ "profile_picture"
            const updateImgSql = `UPDATE Users SET "profile_picture" = ? WHERE user_id = ?`;
            try {
                await runSQL(updateImgSql, [imageBuffer, newUserId]);
                console.log("อัปเดตรูปภาพลงตาราง Users สำเร็จ");
            } catch (err) {
                console.error("Update profile picture error:", err.message);
            }
        }

        // 3. บันทึกข้อมูลลงตาราง Students
        const studentSql = `
            INSERT INTO Students 
            (first_name, last_name, dob, citizen_id, sex, nationality, phone, student_id, email, room_id, year, semester, enroll_year, user_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;

        const studentValues = [
            data.firstname, data.lastname, data.dob, data.citizen_id, data.gender,
            data.nationality, data.phone, data.student_id, data.email,
            data.room_id, data.year, data.semester, data.enroll_year,
            newUserId
        ];

        // รัน INSERT และรอจนเสร็จ
        await runSQL(studentSql, studentValues);

        console.log(`เพิ่มนักเรียนสำเร็จ: ${data.firstname}`);
        res.redirect('/admin/record-stu');

    } catch (error) {
        console.error("Error detected:", error);
        // ส่ง Script ไปที่หน้าจอ เพื่อให้ Alert และสั่งถอยกลับ (ข้อมูลในฟอร์มจะยังอยู่)
        await runSQL(`DELETE FROM Users WHERE user_id = ?`, [newUserId]);
        console.log(`ลบนักเรียนสำเร็จ: ${newUserId}`);
        res.send(`
        <script>
            alert("เกิดข้อผิดพลาด: ${error.message}");
            window.history.back(); 
        </script>
    `);
    }
});
app.get('/delete/student/:id', function (req, res) {
    const query = `SELECT user_id FROM Students WHERE student_id = ${req.params.id}`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        const sql = `DELETE FROM Users WHERE user_id = ${rows[0].user_id}`;
        db.run(sql, (err) => {
            if (err) {
                console.log(err.message);
            }
            db.get("PRAGMA foreign_keys;", (err, res) => {
                console.log(res);
            })
            res.redirect('/admin/record-stu');
        })
    });
});
app.get('/admin/record-teach', function (req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit; // ต้องข้ามกี่คน
    let whereSQL = '';
    const search = req.query.search || '';
    if (search !== '') { // ดูว่ามีคำค้นหา
        whereSQL = `WHERE teacher_id LIKE '%${search}%' OR first_name LIKE '%${search}%'`;
    }
    const query = `SELECT Teacher.rowid, * FROM Teacher JOIN Users ON Teacher.user_id = Users.user_id ${whereSQL} LIMIT ${limit} OFFSET ${offset}`;
    const count = `SELECT COUNT(*) AS total FROM Teacher ${whereSQL}`;
    db.get(count, (err, count_all) => {
        if (err) {
            console.log(err.message);
        }
        const totals = count_all ? count_all.total : 0;
        const totalPages = Math.ceil(totals / limit);
        db.all(query, (err, rows) => {
            if (err) {
                console.log(err.message);
            }
            res.render('Manage_Teacher_Records', { totalPeople: totals, teachers: rows, currentPage: page, totalPages: totalPages, searchKeyword: search });
        });
    });
});
app.get('/teachers', function (req, res) {
    // 1. ดึงข้อมูลตาราง Room
    db.all(`SELECT * FROM Rooms`, [], (err, rooms) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database Error");
        }


        // 3. ส่งข้อมูล rooms และ years ไปให้ไฟล์ EJS
        res.render('Add-Teacher', {
            rooms: rooms,
        });
    });
});

app.post('/add/teacher', uploads.single('profile_image'), async (req, res) => {
    let newUserId = null;
    try {
        const data = req.body;
        const imageBuffer = req.file ? req.file.buffer : null;
        const roomIdForDB = data.room_id === "" ? null : data.room_id;

        // 1. สร้างบัญชีในตาราง Users
        const accountResult = await createAccount('teacher');

        if (!accountResult.success) {
            console.error("Create Account Error:", accountResult.error);
            return res.status(500).send("ไม่สามารถสร้างบัญชีผู้ใช้ได้: " + accountResult.error);
        }

        newUserId = accountResult.user.id;

        // 2. ถ้ามีรูปภาพ ให้อัปเดตไปที่ตาราง Users และรอจนเสร็จ (ใช้ await)
        if (imageBuffer) {
            // ตรวจสอบชื่อคอลัมน์อีกครั้ง: ถ้าเป็นขีดกลางใช้ "profile-picture"
            // ถ้าเป็น underscore ใช้ "profile_picture"
            const updateImgSql = `UPDATE Users SET "profile_picture" = ? WHERE user_id = ?`;
            try {
                await runSQL(updateImgSql, [imageBuffer, newUserId]);
                console.log("อัปเดตรูปภาพลงตาราง Users สำเร็จ");
            } catch (err) {
                console.error("Update profile picture error:", err.message);
            }
        }

        // 3. บันทึกข้อมูลลงตาราง Teachers
        const teacherSql = `
            INSERT INTO Teacher 
            (first_name, last_name, phone, teacher_id, email, user_id, room_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?);
        `;

        const teacherValues = [
            data.firstname, data.lastname,
            data.phone, data.teacher_id, data.email,
            newUserId, roomIdForDB
        ];

        // รัน INSERT และรอจนเสร็จ
        await runSQL(teacherSql, teacherValues);

        console.log(`เพิ่มคุณครูสำเร็จ: ${data.firstname}`);
        res.redirect('/admin/record-teach');

    } catch (error) {
        console.error("Error detected:", error);
        await runSQL(`DELETE FROM Users WHERE user_id = ?`, [newUserId]);
        console.log(`ลบคุณครูสำเร็จ: ${newUserId}`);
        // ส่ง Script ไปที่หน้าจอ เพื่อให้ Alert และสั่งถอยกลับ (ข้อมูลในฟอร์มจะยังอยู่)
        res.send(`
            <script>
                alert("เกิดข้อผิดพลาด: ${error.message}");
                window.history.back(); 
            </script>
        `);
    }
});
//กด edit
app.get('/edit/teacher/:id', function (req, res) {
    const query = `
        SELECT Teacher.*, Users."profile_picture" 
        FROM Teacher 
        JOIN Users ON Teacher.user_id = Users.user_id 
        WHERE Teacher.rowid = ?`;

    db.get(query, [req.params.id], (err, row) => {
        if (err || !row) {
            const errorMsg = err ? err.message : "ไม่พบข้อมูลที่ต้องการอัปเดต";
            console.error("Error detected:", errorMsg);

            return res.send(`
                <script>
                    alert("เกิดข้อผิดพลาด: ${errorMsg}");
                    window.history.back(); 
                </script>
            `);
        }

        let imageBase64 = null;
        if (row["profile_picture"]) {
            imageBase64 = `data:image/jpeg;base64,${row["profile_picture"].toString('base64')}`;
        }

        // 1. ดึงข้อมูลตาราง Room
        db.all(`SELECT * FROM Rooms`, [], (err, rooms) => {
            if (err) return res.send("เกิดข้อผิดพลาด: " + err.message);

            // 2. ดึงข้อมูลตาราง Year
            db.all(`SELECT * FROM Year`, [], (err, years) => {
                if (err) return res.send("เกิดข้อผิดพลาด: " + err.message);

                // 3. ส่งข้อมูลทั้งหมดไปที่ EJS
                res.render('Edit-Teacher', {
                    data: row,
                    profileImg: imageBase64,
                    rooms: rooms || [],   // ส่งข้อมูลห้อง
                });
            });
        });
    });
});
app.post('/update/teacher/:id', upload.single('profile_image'), (req, res) => {
    const teacherRowId = req.params.id;
    const data = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    // 1. อัปเดตข้อมูลตัวหนังสือในตาราง Teacher
    const sqlUpdateTeacher = `
        UPDATE Teacher SET 
        first_name = ?, last_name = ?, teacher_id = ?,
        email = ? , room_id = ? 
        WHERE rowid = ?
    `;

    const teacherValues = [
        data.firstname, data.lastname, data.teacher_id,
        data.email, data.room_id,
        teacherRowId
    ];

    db.run(sqlUpdateTeacher, teacherValues, function (err) {
        if (err) {
            console.error("Error detected:", err);
            // ส่ง Script ไปที่หน้าจอ เพื่อให้ Alert และสั่งถอยกลับ (ข้อมูลในฟอร์มจะยังอยู่)
            return res.send(`
            <script>
                alert("เกิดข้อผิดพลาด: ${err.message}");
                window.history.back(); 
            </script>
        `);
        }
        // 2. ถ้ามีการอัปโหลดรูปใหม่ ให้ไปอัปเดตที่ตาราง Users
        if (imageBuffer) {
            // หา user_id จาก rowid ก่อน
            db.get(`SELECT user_id FROM Teacher WHERE rowid = ?`, [teacherRowId], (err, row) => {
                if (row && row.user_id) {
                    const sqlUpdateUser = `UPDATE Users SET "profile_picture" = ? WHERE user_id = ?`;
                    db.run(sqlUpdateUser, [imageBuffer, row.user_id], (err) => {
                        res.redirect('/admin/record-teach');
                    });
                } else {
                    res.redirect('/admin/record-teach');
                }
            });
        } else {
            res.redirect('/admin/record-teach');
        }
    });
});
app.get('/delete/teacher/:id', function (req, res) {
    const query = `SELECT user_id FROM Teacher WHERE teacher_id = ${req.params.id}`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        const sql = `DELETE FROM Users WHERE user_id = ${rows[0].user_id};`;
        console.log(sql);
        db.run(sql, (err) => {
            if (err) {
                console.log(err.message);
            }
            res.redirect('/admin/record-teach');
        });
    });
});

//Manage Schedule Page

app.get('/admin/manage-schedule', function (req, res) {

    //---ส่วนจัดการตัวกรองปีและเทอม---

    //คำสั่งหาปีเก่าที่สุดในโรงเรียน
    db.get(`SELECT MIN(year) as start_year FROM Year`, [], (err, row) => {

        //เพื่อข้อมูลไม่มีใน database ใช่ค่าคงที่เอา
        let SCHOOL_START_YEAR = 2550;

        //เช็คว่าถ้ามีข้อมูลในdatabaseก็เอามาใช้
        if (!err && row && row.start_year) {
            SCHOOL_START_YEAR = row.start_year;
        }

        //---ส่วนfilter การค้นหาปีการศึกษาเก่าๆหรือปัจจุบัน และเทอม---
        const currentYear = new Date().getFullYear() + 543;
        const selectedYear = parseInt(req.query.year) || currentYear;
        const selectedSemester = parseInt(req.query.semester) || 1;

        //สร้างArray เก็บปีการศึกษาไว่
        const years = [];
        for (let y = currentYear; y >= SCHOOL_START_YEAR; y--) {
            years.push(y);
        }
        //สร้างArray เก็บเทอม
        const semesters = [1, 2];

        //---ส่วนสร้างโครงสร้างของระดับชั้นและห้อง---
        const lockedRooms = [];
        for (let grade = 1; grade <= 6; grade++) {
            for (let roomNum = 1; roomNum <= 3; roomNum++) {
                lockedRooms.push({
                    grade_level: grade,
                    room_name: `${grade}/${roomNum}`
                });
            }
        }

        //---ส่วนดึงข้อมูลจากdatabase | schedule,room,teacher---
        const sql = `SELECT r.room_id, r.room_name, r.grade_level, t.first_name, t.last_name,
                        (
                            SELECT COUNT(id)
                            FROM Schedule s
                            WHERE s.room_id = r.room_id
                            AND s.year = ? AND s.semester = ?
                        ) as schedule_count
                    FROM Rooms r
                    LEFT JOIN Teacher t ON r.room_id = t.room_id
                    `;

        db.all(sql, [selectedYear, selectedSemester], (err, dbRooms) => {
            if (err) {
                console.error("DB Error:", err.message);
            }
            //ถ้าดึงมาแล้วมีก็จะใช้ในข้อมูลในฐานข้อมูลและ แต่ไม่มี []
            const fetchedRooms = dbRooms || [];

            //---ส่วนกรอกข้อมูลที่ดึกมาจากdatabaseมีห้องอะไรบ้าง---
            const displayRooms = lockedRooms.map(locked => {
                const foundInDb = fetchedRooms.find(r =>
                    parseInt(r.grade_level) === locked.grade_level &&
                    r.room_name === locked.room_name
                );

                if (foundInDb) return foundInDb;
                return { //ถ้าไม่เจอใช้ข้อมูลชั่วคราวไปก่อน
                    room_id: 0,
                    room_name: locked.room_name,
                    grade_level: locked.grade_level,
                    first_name: null,
                    last_name: null,
                    schedule_count: 0
                };
            });

            res.render('Manage-Schedule', {
                rooms: displayRooms, years: years, semesters: semesters,
                selectedYear: selectedYear, selectedSemester: selectedSemester
            });
        });
    });
});

app.get('/admin/manage-schedule/inside/new', function (req, res) {
    const { grade, room, year, semester } = req.query;

    const sqlCheck = `SELECT room_id FROM Rooms WHERE room_name = ? AND grade_level = ?`;

    db.get(sqlCheck, [room, grade], (err, existingRoom) => {
        if (err) {
            console.error("Error checking room:", err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการตรวจสอบห้องเรียน");
        }

        if (existingRoom) {
            return res.redirect(`/admin/manage-schedule/inside/${existingRoom.room_id}?year=${year}&semester=${semester}`);
        }

        const sqlInsertRoom = `INSERT INTO Rooms (room_name, grade_level) VALUES(?, ?)`;

        db.run(sqlInsertRoom, [room, grade], function (err) {
            if (err) {
                console.error("Error creating new room:", err.message);
                return res.status(500).send("เกิดข้อผิดพลาดในการสร้างห้อง");
            }

            const newRoomId = this.lastID;
            res.redirect(`/admin/manage-schedule/inside/${newRoomId}?year=${year}&semester=${semester}`);
        });
    });
});

app.get('/admin/manage-schedule/inside/:id', (req, res) => {
    const roomId = req.params.id;
    const { year, semester } = req.query;

    db.get(`SELECT * FROM Rooms WHERE room_id = ?`, [roomId], (err, room) => {
        if (err || !room) {
            return res.status(404).send("ไม่พบข้อมูลห้องเรียน");
        }

        db.all(`SELECT * FROM Subjects WHERE grade_level = ?`, [room.grade_level], (err, subjects) => {
            if (err) subjects = []; //เพื่อยังไม่มีข้อมูล subject

            const sqlSchedule = `SELECT s.day, s.period, sub.subject_name
                                FROM Schedule s
                                JOIN Subjects sub ON s.subject_id = sub.subject_id
                                WHERE s.room_id = ? AND s.year = ? AND s.semester = ?`;

            db.all(sqlSchedule, [roomId, year, semester], (err, schedules) => {
                if (err) schedules = [];

                res.render('Manage-Schedule-Inside', {
                    room: room,
                    subjects: subjects,
                    schedules: schedules,
                    year: year,
                    semester: semester
                });
            });
        });
    });
});

app.post('/admin/manage-schedule/inside/add', (req, res) => {
    const { room_id, day, period, subject_id, year, semester } = req.body;
    console.log(req.body);

    const sqlInsertSchedule = `INSERT INTO Schedule(room_id, day, period, subject_id, year, semester)
                                VALUES(?,?,?,?,?,?)`;

    db.run(sqlInsertSchedule, [room_id, day, period, subject_id, year, semester], (err) => {
        if (err) {
            console.error("Error adding schedule:", err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการเพิ่มวิชา");
        }
        res.redirect(`/admin/manage-schedule/inside/${room_id}?year=${year}&semester=${semester}`);
    });
});

app.post('/admin/manage-schedule/inside/delete', (req, res) => {
    const { room_id, day, period, year, semester } = req.body;

    const sqlDeleteSchedule = `
        DELETE FROM Schedule
        WHERE room_id = ? AND day= ? AND period = ? AND year = ? AND semester = ?`;

    db.run(sqlDeleteSchedule, [room_id, day, period, year, semester], (err) => {
        if (err) {
            console.error("Error deleting schedule:", err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการลบวิชา");
        }
        res.redirect(`/admin/manage-schedule/inside/${room_id}?year=${year}&semester=${semester}`);
    });
});
app.get('/teacher/record-stu', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit; // ต้องข้ามกี่คน
    let whereSQL = '';
    const search = req.query.search || '';
    if (search !== '') { // ดูว่ามีคำค้นหา
        whereSQL = `WHERE student_id LIKE '%${search}%' OR first_name LIKE '%${search}%'`;
    }
    const query = `SELECT Students.rowid, * FROM Students JOIN Users ON Students.user_id = Users.user_id ${whereSQL} LIMIT ${limit} OFFSET ${offset}`;
    const count = `SELECT COUNT(*) AS total FROM Students ${whereSQL}`;
    db.get(count, (err, count_all) => {
        if (err) {
            console.log(err.message);
        }
        const totals = count_all ? count_all.total : 0;
        const totalPages = Math.ceil(totals / limit);
        db.all(query, (err, rows) => {
            if (err) {
                console.log(err.message);
            }
            res.render('View-Student', { totalPeople: totals, students: rows, currentPage: page, totalPages: totalPages, searchKeyword: search });
        });
    });
});
app.listen(port, () => {
    // db.get("PRAGMA foreign_keys = ON;", (err, res) => {
    //     console.log(res);
    // })
    console.log("Server started.");
    
}); 