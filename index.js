const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

const app = express();

//เพื่อรับค่าจาก Form
app.use(express.urlencoded({ extended: true }));

let db = new sqlite3.Database('school.db', (err) => {
if (err) {
    return console.error(err.message);
}
console.log('Connected to the SQlite database.');
});



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
app.get('/admin/manage-schedule',function(req,res){

    //---ส่วนจัดการตัวกรองปีและเทอม---

    //คำสั่งหาปีเก่าที่สุดในโรงเรียน
    db.get(`SELECT MIN(year) as start_year FROM Year`,[],(err,row)=>{

        //เพื่อข้อมูลไม่มีใน database ใช่ค่าคงที่เอา
        let SCHOOL_START_YEAR = 2550;

        //เช็คว่าถ้ามีข้อมูลในdatabaseก็เอามาใช้
        if(!err && row && row.start_year){
            SCHOOL_START_YEAR = row.start_year;
        }

        //---ส่วนfilter การค้นหาปีการศึกษาเก่าๆหรือปัจจุบัน และเทอม---
        const currentYear = new Date().getFullYear() + 543;
        const selectedYear = parseInt(req.query.year) || currentYear;
        const selectedSemester = parseInt(req.query.semester) || 1;

        //สร้างArray เก็บปีการศึกษาไว่
        const years=[];
        for (let y = currentYear; y >= SCHOOL_START_YEAR; y--){
            years.push(y);
        }
        //สร้างArray เก็บเทอม
        const semesters = [1,2];

        //---ส่วนสร้างโครงสร้างของระดับชั้นและห้อง---
        const lockedRooms = [];
        for (let grade = 1; grade <= 6; grade++){
            for (let roomNum = 1; roomNum <= 3; roomNum++){
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

        db.all(sql, [selectedYear, selectedSemester], (err, dbRooms)=>{
            if(err){
                console.error("DB Error:",err.message);
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

            res.render('Manage-Schedule',{
                rooms : displayRooms, years : years, semesters : semesters,
                selectedYear : selectedYear, selectedSemester: selectedSemester
            });
        });
    });
});

app.get('/admin/manage-schedule/inside/new', function(req, res){
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
        
        db.run(sqlInsertRoom, [room, grade], function(err) {
            if (err) {
                console.error("Error creating new room:", err.message);
                return res.status(500).send("เกิดข้อผิดพลาดในการสร้างห้อง");
            }
            
            const newRoomId = this.lastID;
            res.redirect(`/admin/manage-schedule/inside/${newRoomId}?year=${year}&semester=${semester}`);
        });
    });
});

app.get('/admin/manage-schedule/inside/:id',(req,res)=>{
    const roomId = req.params.id;
    const {year, semester} = req.query;

    db.get(`SELECT * FROM Rooms WHERE room_id = ?`,[roomId], (err,room)=>{
        if (err || !room){
            return res.status(404).send("ไม่พบข้อมูลห้องเรียน");
        }

        db.all(`SELECT * FROM Subjects WHERE grade_level = ?`,[room.grade_level], (err,subjects)=>{
            if(err) subjects = []; //เพื่อยังไม่มีข้อมูล subject

            const sqlSchedule = `SELECT s.day, s.period, sub.subject_name
                                FROM Schedule s
                                JOIN Subjects sub ON s.subject_id = sub.subject_id
                                WHERE s.room_id = ? AND s.year = ? AND s.semester = ?`;
            
            db.all(sqlSchedule,[roomId,year,semester],(err, schedules)=>{
                if (err) schedules = [];

                res.render('Manage-Schedule-Inside',{
                    room: room,
                    subjects: subjects,
                    schedules: schedules,
                    year:year,
                    semester: semester
                });
            });
        });
    });
});

app.post('/admin/manage-schedule/inside/add',(req,res)=>{
    const {room_id, day, period, subject_id, year, semester} = req.body;

    const sqlInsertSchedule = `INSERT INTO Schedule(room_id,day,period, subject_id,year,semester)
                                VALUES(?,?,?,?,?,?)`;

    db.run(sqlInsertSchedule,[room_id, day, period, subject_id, year, semester],(err)=>{
        if (err){
            console.error("Error adding schedule:",err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการเพิ่มวิชา");
        }
        res.redirect(`/admin/manage-schedule/inside/${room_id}?year=${year}&semester=${semester}`);
    });
});

app.post('/admin/manage-schedule/inside/delete',(req,res)=>{
    const {room_id, day, period, year, semester} = req.body;

    const sqlDeleteSchedule =`
        DELETE FROM Schedule
        WHERE room_id = ? AND day= ? AND period = ? AND year = ? AND semester = ?`;

    db.run(sqlDeleteSchedule,[room_id, day, period, year, semester],(err)=>{
        if (err){
            console.error("Error deleting schedule:",err.message);
            return res.status(500).send("เกิดข้อผิดพลาดในการลบวิชา");
        }
        res.redirect(`/admin/manage-schedule/inside/${room_id}?year=${year}&semester=${semester}`);
    });
});

app.listen(port, () => {
console.log("Server started.");
});