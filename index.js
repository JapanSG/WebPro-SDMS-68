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

app.get('/student/class-schedule', checkAuthenticated, checkRole('student'), (req, res) => {
    const userId = req.user.user_id; 
    const targetSemester = 1;
    const targetYear = 2568; 

    
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
            WHERE sch."room-id" = ? AND sch.semester = ? AND sch.year = ?
            ORDER BY sch.day, sch.period
        `;

        db.all(scheduleSql, [roomId, targetSemester, targetYear], (err, schedules) => {
            if (err) {
                console.error("Error fetching class schedule:", err.message);
                return res.status(500).send("Database Error: ไม่สามารถดึงข้อมูลตารางเรียนได้");
            }

            // 3. จัดกลุ่มข้อมูลลงใน Array แบบ 2 มิติ ให้หน้าเว็บเอาไปวนลูปง่ายๆ
            const timetable = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
            
            schedules.forEach(item => {
                if (timetable[item.day]) {
                    timetable[item.day][item.period] = item;
                }
            });

            // 4. ส่งไปที่ไฟล์ EJS (สังเกตว่าส่ง roomName ไปแทน roomId แล้ว)
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


app.listen(port, () => {
    console.log("Server started.");
});