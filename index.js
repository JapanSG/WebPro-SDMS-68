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

// ==========================================
// Muftee's Pages (Subject Management)
// ==========================================


// หน้าจัดการวิชา (Manage Subject)
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
                totalPages: totalPages ,
                errorMsg: req.query.error || null,
                successMsg: req.query.success || null
            });
        });
    });
});

app.get('/admin/subject/add', checkAuthenticated, checkRole('admin'), (req, res) => {
    // ดึงรายชื่อครูจากตาราง Teacher เพื่อไปทำ Dropdown ให้เลือก
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
    // 1. รับค่า teacher_id เพิ่มมาจากฟอร์ม
    const { subject_id, subject_name, credit, grade_level, teacher_id } = req.body;
    
    // 2. เพิ่มคอลัมน์ teacher_id ในคำสั่ง INSERT
    const sql = "INSERT INTO Subjects (subject_id, subject_name, grade_level, credit, teacher_id) VALUES (?, ?, ?, ?, ?)";
    
    // 3. ส่งค่า teacher_id เข้าไปใน array (ถ้าไม่ได้เลือก ให้เป็น null)
    db.run(sql, [subject_id, subject_name, grade_level, credit, teacher_id || null], function(err) {
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
        
        // ส่งข้อมูล subject ไปแสดงผลที่หน้า Edit
        res.render('Edit-Subject-Admin', { user: req.user, subject: subject });
    });
});

app.post('/admin/subject/edit/:id', checkAuthenticated, checkRole('admin'), (req, res) => {
    const old_subject_id = req.params.id; 
    // รับ teacher_id เพิ่มเข้ามาจาก req.body
    const { subject_id, subject_name, credit, grade_level, teacher_id } = req.body; 
   
    // จัดการค่า teacher_id ถ้าว่างให้เป็น null เพื่อไม่ให้ติด Foreign Key หากไม่ได้ระบุ
    const t_id = (teacher_id && teacher_id.trim() !== "") ? teacher_id : null;

    const sql = `
        UPDATE Subjects 
        SET subject_id = ?, subject_name = ?, grade_level = ?, credit = ?, teacher_id = ? 
        WHERE subject_id = ?
    `;
    
    // ส่งค่า t_id เข้าไปใน array ลำดับที่ 5
    db.run(sql, [subject_id, subject_name, grade_level, credit, t_id, old_subject_id], function(err) {
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

    db.run(sql, [subjectId], function(err) {
        if (err) {
            console.error("Error deleting subject:", err.message);
            
            const errorMsg = "ไม่สามารถลบวิชานี้ได้ เนื่องจากมีการใช้งานอยู่ในตารางเรียนหรือตารางสอบ";
            return res.redirect('/admin/subject?error=' + encodeURIComponent(errorMsg));
        }
        
        
        const successMsg = "ลบรายวิชาสำเร็จ";
        res.redirect('/admin/subject?success=' + encodeURIComponent(successMsg));
    });
});
// เพิ่ม Route นี้ใน index.js
// Route สำหรับหน้าตารางเรียนฝั่งนักเรียน
app.get('/student/class-schedule', checkAuthenticated, checkRole('student'), (req, res) => {
    
    // ตั้งค่าตามข้อมูลที่เรา Insert ไว้: ห้อง 1, เทอม 1, ปี 2568
    // (ในอนาคต: roomId ควรดึงมาจากตาราง Students โดยใช้ req.user.user_id ครับ)
    const roomId = 1; 
    const targetSemester = 1;
    const targetYear = 2568; 

    // คำสั่ง SQL ดึงข้อมูลตารางเรียน พร้อมชื่อวิชาและชื่ออาจารย์
    const sql = `
        SELECT sch.day, sch.period, sub.subject_id, sub.subject_name, t.first_name, t.last_name
        FROM Schedule sch
        LEFT JOIN Subjects sub ON sch.subject_id = sub.subject_id
        LEFT JOIN Teacher t ON sub.teacher_id = t.teacher_id
        WHERE sch."room-id" = ? AND sch.semester = ? AND sch.year = ?
        ORDER BY sch.day, sch.period
    `;

    db.all(sql, [roomId, targetSemester, targetYear], (err, schedules) => {
        if (err) {
            console.error("Error fetching class schedule:", err.message);
            return res.status(500).send("Database Error: ไม่สามารถดึงข้อมูลตารางเรียนได้");
        }

        // จัดกลุ่มข้อมูลให้อยู่ในรูปแบบ Object เพื่อให้ฝั่ง EJS วนลูปสร้างตารางง่ายๆ
        // 1=จันทร์, 2=อังคาร, 3=พุธ, 4=พฤหัส, 5=ศุกร์
        const timetable = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
        
        schedules.forEach(item => {
            if (timetable[item.day]) {
                timetable[item.day][item.period] = item;
            }
        });

        // ส่งข้อมูลไปที่ไฟล์ EJS (สมมติว่าไฟล์ชื่อ Schedule.ejs ตามที่เราเคยเขียน CSS มินิมอลไว้)
        res.render('Schedule', { 
            user: req.user, 
            timetable: timetable,
            year: targetYear,
            semester: targetSemester
        });
    });
});

// ==========================================



// ==========================================
app.get('/test-data', checkAuthenticated, (req, res) => {
    const userId = req.user.user_id; // เช่น ID 1 จากตาราง Users

    // ล้างข้อมูลเก่าก่อน
    db.run(`DELETE FROM Students WHERE user_id = ?`, [userId], (err) => {
        
        // 1. สร้างนักเรียน (ใช้ชื่อคอลัมน์ underscore ตามที่คุยกัน)
        const insertStudent = `
            INSERT INTO Students (
                student_id, first_name, last_name, phone, sex, 
                nationality, room_id, user_id, citizen_id, dob, enroll_year
            ) VALUES (?, 'สมชาย', 'ใจดี', '0812345678', 'Male', 'Thai', 401, ?, '1234567890123', '2010-01-01', 2026)`;
        
        db.run(insertStudent, [userId + 100, userId], (err) => {
            if (err) return res.send("Error Students: " + err.message);

            // 2. จัดตารางเรียน (ใช้วิชา 101 และ 102 ที่ลูกพี่มีอยู่แล้วในตาราง Subjects)
            // และใช้ room_id เป็น 401 ให้ตรงกับนักเรียน
            const insertSchedule = `
                INSERT INTO Schedule (room_id, day, period, type, subject_id, semester, year) 
                VALUES (401, 1, 1, 'ปกติ', 101, 1, 2026), 
                       (401, 1, 2, 'ปกติ', 102, 1, 2026),
                       (401, 2, 3, 'ปกติ', 201, 1, 2026)`;
            
            db.run(insertSchedule, (err) => {
                if (err) return res.send("Error Schedule: " + err.message);
                
                res.send(`
                    <h2>เสกข้อมูลสำเร็จ! ✅</h2>
                    <p>1. สร้างนักเรียนรหัส ${userId + 100} อยู่ห้อง 401 แล้ว</p>
                    <p>2. เพิ่มวิชา 101, 102 ลงในตารางเรียนห้อง 401 แล้ว</p>
                    <br>
                    <a href="/student/class-schedule">👉 ไปดูตารางเรียน (ถ้ายัง Error ให้ส่งไฟล์ EJS มาครับ)</a>
                `);
            });
        });
    });
});
app.get('/setup-admin', async (req, res) => {
    const result = await createAccount('admin');
    if (result.success) {
        res.send(`สร้าง Admin สำเร็จ! Username: ${result.user.username} | Password: webPro2026`);
    } else {
        res.send(`พังครับ: ${result.error}`);
    }
});

app.get('/setup-student', async (req, res) => {
    const result = await createAccount('student');
    res.send(`สร้างสำเร็จ! เอาไอดีนี้ไปล็อกอินได้เลย -> Username: ${result.user?.username} | Password: webPro2026`);
});

app.listen(port, () => {
    console.log("Server started.");
});