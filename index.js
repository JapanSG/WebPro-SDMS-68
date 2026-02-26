const express = require("express");
const path = require("path");
const bcrypt = require('bcrypt')
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

const app = express();

let db = new sqlite3.Database('school.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({ storage: storage });


app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//หน้า Student Record
app.get('/', function (req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit; // ต้องข้ามกี่คน
    let whereSQL = '';
    const search = req.query.search || '';
    if (search !== '') { // ดูว่ามีคำค้นหา
        whereSQL = `WHERE student_id LIKE '%${search}%' OR first_name LIKE '%${search}%'`;
    }
    const query = `SELECT rowid, * FROM Students ${whereSQL} LIMIT ${limit} OFFSET ${offset}`;
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
            res.render('Manage_Student_Records', { totalStudents: totals, students : rows, currentPage: page, totalPages: totalPages, searchKeyword: search});
        });
    });
});

//กด edit
app.get('/edit/:id', function (req, res) {
    const query = `SELECT rowid, * FROM Students WHERE rowid = ${req.params.id}`;
    db.get(query, (err, row) => {
        if (err) {
            console.log(err.message);
            return res.send("เกิดข้อผิดพลาด");
        }

        if (!row) {
            return res.send("ไม่พบข้อมูลนักเรียน");
        }

        let imageBase64 = null;
        // ตรวจสอบว่ามีข้อมูลในคอลัมน์ profile_image หรือไม่
        if (row.profile_image) {
            // แปลง Buffer (BLOB) ให้เป็น Base64 string
            const base64Data = row.profile_image.toString('base64');
            // สร้างเป็น Data URL ที่ถูกต้องสำหรับใส่ใน src ของ <img>
            imageBase64 = `data:image/jpeg;base64,${base64Data}`;
        }

        // 3. ส่งข้อมูลไปที่ไฟล์ EJS
        // ส่ง 'data' เป็นข้อมูลนักเรียน และ 'profileImg' เป็นรูป Base64
        res.render('Edit-Student', { data: row, profileImg : imageBase64 });
    });
});
app.post('/update/:id', upload.single('profile_image'), (req, res) => {
    const student_id = req.params.id;
    const data = req.body;

    // เช็คว่ามีการส่งไฟล์รูปใหม่มาหรือไม่
    if (req.file) {
        // กรณีมีรูปภาพใหม่ อัปเดตข้อมูลทั้งหมดพร้อมรูปลง DB (BLOB)
        const imageBuffer = req.file.buffer;
        
        const sql = `
            UPDATE Students SET 
            first_name = ?, last_name = ?, dob = ?, citizen_id = ?, sex = ?, 
            nationality = ?, phone = ?, email = ?, room_id = ?, 
            year = ?, semester = ?, enroll_year = ?, profile_image = ?
            WHERE student_id = ?
        `;

        const values = [
            data.firstname, data.lastname, data.dob, data.citizen_id, data.gender,
            data.nationality, data.phone, data.email, data.room_id,
            data.year, data.semester, data.enroll_year, imageBuffer, student_id
        ];

        db.run(sql, values, (err) => {
            if (err) return console.error(err.message);
            res.redirect('/');
        });

    } else {
        // กรณีไม่มีรูปภาพใหม่ อัปเดตเฉพาะข้อมูลตัวหนังสือ ไม่ยุ่งกับคอลัมน์ profile_image
        const sql = `
            UPDATE Students SET 
            first_name = ?, last_name = ?, dob = ?, citizen_id = ?, sex = ?, 
            nationality = ?, phone = ?, email = ?, room_id = ?, 
            year = ?, semester = ?, enroll_year = ?
            WHERE student_id = ?
        `;

        const values = [
            data.firstname, data.lastname, data.dob, data.citizen_id, data.gender,
            data.nationality, data.phone, data.email, data.room_id,
            data.year, data.semester, data.enroll_year, student_id
        ];

        db.run(sql, values, (err) => {
            if (err) return console.error(err.message);
            res.redirect('/');
        });
    }
});
app.get('/students', function (req, res) {
        res.render('Add-Student');
});
app.post('/add', (req, res) => {
    const data = req.body;

    const sql = `
        INSERT INTO Students 
        (first_name, last_name, dob, citizen_id, sex, nationality, phone, student_id, email, room_id, year, semester, enroll_year) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [
        data.firstname, 
        data.lastname,
        data.dob,
        data.citizen_id,
        data.gender, 
        data.nationality,
        data.phone, 
        data.student_id,
        data.email,
        data.room_id,
        data.year,
        data.semester,
        data.enroll_year
    ];
    createAccount("student");
    db.run(sql, values, (err, result) => {
        if (err) {
            console.error('Insert error:', err);
            return res.send("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        }
        
        res.redirect('/');
    });
})
pp.get('/delete/:id', function (req, res) {
    const query = `DELETE * FROM Students WHERE id = ${req.params.id}`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.redirect('/');
    });
})


app.get('/student/home', function (req, res) {
    res.render('Home-Student');
});
app.get('/teacher/home', function (req, res) {
    res.render('Home-Teacher');
});
app.get('/admin/home', function (req, res) {
    res.render('Home-Admin');
});





app.listen(port, () => {
    console.log("Server started.");
});
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