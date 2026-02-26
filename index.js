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
    db.get(query, (err, rows) => {
            if (err) {
                console.log(err.message);
            }
            res.render('Edit-Student', { data : rows});
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
            nationality = ?, phone = ?, email = ?, enroll_date = ?, room_id = ?, 
            year = ?, semester = ?, enroll_year = ?, profile_image = ?
            WHERE student_id = ?
        `;

        const values = [
            data.firstname, data.lastname, data.dob, data.citizen_id, data.gender,
            data.nationality, data.phone, data.email, data.enroll_date, data.room_id,
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
            nationality = ?, phone = ?, email = ?, enroll_date = ?, room_id = ?, 
            year = ?, semester = ?, enroll_year = ?
            WHERE student_id = ?
        `;

        const values = [
            data.firstname, data.lastname, data.dob, data.citizen_id, data.gender,
            data.nationality, data.phone, data.email, data.enroll_date, data.room_id,
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

    db.run(sql, values, (err, result) => {
        if (err) {
            console.error('Insert error:', err);
            return res.send("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        }
        
        res.redirect('/');
    });
});

app.get('/delete/:id', function (req, res) {
    const query = `DELETE FROM Students WHERE student_id = ${req.params.id}`;
    db.run(query, (err, rows) => {
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