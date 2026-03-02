/**
 * seed.js - Mock Data Generator for WebPro-SDMS
 * สร้างข้อมูล Mock สำหรับทดสอบระบบ
 * รัน: node seed.js
 * Password สำหรับทุก account: 1234
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('school.db');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(new Error(`SQL Error:\n${sql}\nParams: ${JSON.stringify(params)}\n${err.message}`));
      } else {
        resolve(this);
      }
    });
  });
}

async function main() {
  console.log('🔐 Generating bcrypt hash for password "1234"...');
  const pwd = await bcrypt.hash('1234', 10);
  console.log('✅ Hash generated');

  try {
    await run('BEGIN TRANSACTION');

    // ================================================================
    // 1. CLEAN UP GARBAGE DATA
    // ================================================================
    await run(`DELETE FROM Subjects WHERE subject_id = 21213`);
    console.log('🧹 Cleaned up garbage data');

    // ================================================================
    // 2. FIX EXISTING SUBJECTS
    // ================================================================
    await run(`UPDATE Subjects SET subject_name = 'ภาษาไทย', grade_level = 4, teacher_id = 1 WHERE subject_id = 101`);
    await run(`UPDATE Subjects SET subject_name = 'คณิตศาสตร์', grade_level = 4, teacher_id = 2 WHERE subject_id = 102`);
    console.log('✅ Fixed existing subjects');

    // ================================================================
    // 3. ADD TEACHER USERS (user_id 20-27, role = teacher)
    // ================================================================
    const teacherUsers = [
      [20, 't0020', pwd, 'teacher'],
      [21, 't0021', pwd, 'teacher'],
      [22, 't0022', pwd, 'teacher'],
      [23, 't0023', pwd, 'teacher'],
      [24, 't0024', pwd, 'teacher'],
      [25, 't0025', pwd, 'teacher'],
      [26, 't0026', pwd, 'teacher'],
      [27, 't0027', pwd, 'teacher'],
    ];
    for (const u of teacherUsers) {
      await run(`INSERT OR IGNORE INTO Users (user_id, username, password, role) VALUES (?, ?, ?, ?)`, u);
    }
    console.log('✅ Teacher users inserted (user_id 20-27)');

    // ================================================================
    // 4. ADD TEACHERS (teacher_id 3-10)
    // ================================================================
    const teachers = [
      [3,  'วิชัย',      'รักษ์ดี',    '0861234503', 'vichai@school.th',      '20'],
      [4,  'นภาพร',     'เจริญสุข',   '0861234504', 'naphaporn@school.th',   '21'],
      [5,  'ประเสริฐ',  'ทองคำ',      '0861234505', 'prasert@school.th',     '22'],
      [6,  'สุภาพร',   'แก้วมณี',    '0861234506', 'suphaporn@school.th',   '23'],
      [7,  'ธนกร',     'บุญรอด',     '0861234507', 'thanagorn@school.th',   '24'],
      [8,  'กนกวรรณ', 'สุวรรณ',     '0861234508', 'kanokwan@school.th',    '25'],
      [9,  'ณัฐพล',   'ศรีสมบัติ',  '0861234509', 'nathaphon@school.th',   '26'],
      [10, 'ปิยะดา',   'อินทร์ดี',   '0861234510', 'piyada@school.th',      '27'],
    ];
    for (const t of teachers) {
      await run(
        `INSERT OR IGNORE INTO Teacher (teacher_id, first_name, last_name, phone, email, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
        t
      );
    }
    console.log('✅ Teachers inserted (teacher_id 3-10)');

    // ================================================================
    // 5. UPDATE EXISTING ROOMS + ADD NEW ROOMS
    // ================================================================
    await run(`UPDATE Rooms SET description = 'ห้องเรียนชั้น ป.4/1', status = 'in-used', advisor_id = 1 WHERE room_id = 1`);
    await run(`UPDATE Rooms SET description = 'ห้องเรียนชั้น ป.1/1', status = 'in-used', advisor_id = 3 WHERE room_id = 101`);
    await run(`UPDATE Rooms SET description = 'ห้องเรียนชั้น ป.1/2', status = 'in-used', advisor_id = 4 WHERE room_id = 102`);
    await run(`UPDATE Rooms SET description = 'ห้องเรียนชั้น ป.1/3', status = 'in-used', advisor_id = 5 WHERE room_id = 103`);
    // Add grade 2 room
    await run(
      `INSERT OR IGNORE INTO Rooms (room_id, room_name, description, status, advisor_id, grade_level) VALUES (201, '2/1', 'ห้องเรียนชั้น ป.2/1', 'in-used', 7, 2)`
    );
    console.log('✅ Rooms updated/inserted');

    // ================================================================
    // 6. ADD SUBJECTS
    // Grade 4 (103-106), Grade 1 (111-116), Grade 2 (211-216)
    // ================================================================
    const subjects = [
      // Grade 4 extra subjects
      [103, 'วิทยาศาสตร์',  4, 2, 3],
      [104, 'สังคมศึกษา',   4, 2, 4],
      [105, 'ภาษาอังกฤษ',  4, 2, 5],
      [106, 'พลศึกษา',      4, 1, 6],
      // Grade 1
      [111, 'ภาษาไทย',      1, 2, 1],
      [112, 'คณิตศาสตร์',  1, 2, 2],
      [113, 'วิทยาศาสตร์',  1, 2, 3],
      [114, 'สังคมศึกษา',   1, 2, 4],
      [115, 'ภาษาอังกฤษ',  1, 2, 5],
      [116, 'พลศึกษา',      1, 1, 6],
      // Grade 2
      [211, 'ภาษาไทย',      2, 2, 7],
      [212, 'คณิตศาสตร์',  2, 2, 8],
      [213, 'วิทยาศาสตร์',  2, 2, 9],
      [214, 'สังคมศึกษา',   2, 2, 10],
      [215, 'ภาษาอังกฤษ',  2, 2, 7],
      [216, 'พลศึกษา',      2, 1, 8],
    ];
    for (const s of subjects) {
      await run(
        `INSERT OR IGNORE INTO Subjects (subject_id, subject_name, grade_level, credit, teacher_id) VALUES (?, ?, ?, ?, ?)`,
        s
      );
    }
    console.log('✅ Subjects inserted (grade 1, 2, 4)');

    // ================================================================
    // 7. ADD STUDENT USERS (user_id 100-148)
    // ================================================================
    for (let uid = 100; uid <= 148; uid++) {
      await run(
        `INSERT OR IGNORE INTO Users (user_id, username, password, role) VALUES (?, ?, ?, 'student')`,
        [uid, `s${String(uid).padStart(4, '0')}`, pwd]
      );
    }
    console.log('✅ Student users inserted (user_id 100-148)');

    // ================================================================
    // 8. ADD 49 NEW STUDENTS (1001 exists already → total 50)
    // ================================================================
    // Format: [student_id, first_name, last_name, phone, sex, nationality, email,
    //          room_id, semester, year, user_id, citizen_id, dob, enroll_year]

    // Room 1 (ป.4/1, grade 4): student_id 1002-1010, user_id 100-108
    const studentsRoom1 = [
      [1002, 'สมศักดิ์',   'ดีดวง',       '0861230002', 'Male',   'Thai', 's1002@school.th', 1,   1, 2568, 100, '1100200020021', '2014-03-15', 2025],
      [1003, 'วาสนา',     'มีชัย',        '0861230003', 'Female', 'Thai', 's1003@school.th', 1,   1, 2568, 101, '1100200030031', '2014-06-20', 2025],
      [1004, 'วิชัย',      'ใจดี',         '0861230004', 'Male',   'Thai', 's1004@school.th', 1,   1, 2568, 102, '1100200040041', '2014-09-10', 2025],
      [1005, 'ประเสริฐ',  'สุขสม',       '0861230005', 'Male',   'Thai', 's1005@school.th', 1,   1, 2568, 103, '1100200050051', '2014-12-05', 2025],
      [1006, 'รัชนี',      'รักษ์ดี',      '0861230006', 'Female', 'Thai', 's1006@school.th', 1,   1, 2568, 104, '1100200060061', '2014-04-22', 2025],
      [1007, 'สุรศักดิ์',  'เจริญสุข',    '0861230007', 'Male',   'Thai', 's1007@school.th', 1,   1, 2568, 105, '1100200070071', '2014-07-30', 2025],
      [1008, 'นภาพร',     'ทองคำ',       '0861230008', 'Female', 'Thai', 's1008@school.th', 1,   1, 2568, 106, '1100200080081', '2014-11-14', 2025],
      [1009, 'ธนกร',      'แก้วมณี',     '0861230009', 'Male',   'Thai', 's1009@school.th', 1,   1, 2568, 107, '1100200090091', '2015-01-08', 2025],
      [1010, 'สุภาพร',    'บุญรอด',      '0861230010', 'Female', 'Thai', 's1010@school.th', 1,   1, 2568, 108, '1100200100101', '2015-02-25', 2025],
    ];

    // Room 101 (ป.1/1, grade 1): student_id 1011-1020, user_id 109-118
    const studentsRoom101 = [
      [1011, 'ณัฐพล',     'สุวรรณ',      '0861230011', 'Male',   'Thai', 's1011@school.th', 101, 1, 2568, 109, '1100200110111', '2017-03-15', 2025],
      [1012, 'ปิยะดา',    'ศรีสมบัติ',   '0861230012', 'Female', 'Thai', 's1012@school.th', 101, 1, 2568, 110, '1100200120121', '2017-05-20', 2025],
      [1013, 'ชาญณรงค์',  'อินทร์ดี',    '0861230013', 'Male',   'Thai', 's1013@school.th', 101, 1, 2568, 111, '1100200130131', '2017-08-10', 2025],
      [1014, 'กนกวรรณ',  'คงประสิทธิ์', '0861230014', 'Female', 'Thai', 's1014@school.th', 101, 1, 2568, 112, '1100200140141', '2017-11-05', 2025],
      [1015, 'วรัญญู',    'ใจเย็น',       '0861230015', 'Male',   'Thai', 's1015@school.th', 101, 1, 2568, 113, '1100200150151', '2018-01-22', 2025],
      [1016, 'อัญชลี',    'รุ่งโรจน์',    '0861230016', 'Female', 'Thai', 's1016@school.th', 101, 1, 2568, 114, '1100200160161', '2017-04-18', 2025],
      [1017, 'ธีรวัฒน์',  'มั่งมี',       '0861230017', 'Male',   'Thai', 's1017@school.th', 101, 1, 2568, 115, '1100200170171', '2017-07-30', 2025],
      [1018, 'ณัฐกานต์',  'ชูใจ',         '0861230018', 'Female', 'Thai', 's1018@school.th', 101, 1, 2568, 116, '1100200180181', '2017-10-14', 2025],
      [1019, 'ภานุวัฒน์', 'สง่างาม',     '0861230019', 'Male',   'Thai', 's1019@school.th', 101, 1, 2568, 117, '1100200190191', '2018-02-08', 2025],
      [1020, 'สุธิดา',    'พูลสวัสดิ์',  '0861230020', 'Female', 'Thai', 's1020@school.th', 101, 1, 2568, 118, '1100200200201', '2017-12-25', 2025],
    ];

    // Room 102 (ป.1/2, grade 1): student_id 1021-1030, user_id 119-128
    const studentsRoom102 = [
      [1021, 'อนุชา',      'เฉลิมวงษ์',  '0861230021', 'Male',   'Thai', 's1021@school.th', 102, 1, 2568, 119, '1100200210211', '2017-03-11', 2025],
      [1022, 'พัชรินทร์', 'ทิพย์วงศ์',   '0861230022', 'Female', 'Thai', 's1022@school.th', 102, 1, 2568, 120, '1100200220221', '2017-06-25', 2025],
      [1023, 'รัฐพล',     'สิงห์โต',     '0861230023', 'Male',   'Thai', 's1023@school.th', 102, 1, 2568, 121, '1100200230231', '2017-09-14', 2025],
      [1024, 'นิตยา',     'ปานทอง',      '0861230024', 'Female', 'Thai', 's1024@school.th', 102, 1, 2568, 122, '1100200240241', '2017-12-03', 2025],
      [1025, 'ปกรณ์',     'บัวทอง',      '0861230025', 'Male',   'Thai', 's1025@school.th', 102, 1, 2568, 123, '1100200250251', '2018-02-19', 2025],
      [1026, 'รุ่งนภา',   'วงค์วาน',     '0861230026', 'Female', 'Thai', 's1026@school.th', 102, 1, 2568, 124, '1100200260261', '2017-05-07', 2025],
      [1027, 'ศิวพล',     'ทวีผล',       '0861230027', 'Male',   'Thai', 's1027@school.th', 102, 1, 2568, 125, '1100200270271', '2017-08-23', 2025],
      [1028, 'มาลี',      'ประภาส',      '0861230028', 'Female', 'Thai', 's1028@school.th', 102, 1, 2568, 126, '1100200280281', '2017-11-12', 2025],
      [1029, 'ชนาธิป',   'นิ่มนวล',     '0861230029', 'Male',   'Thai', 's1029@school.th', 102, 1, 2568, 127, '1100200290291', '2018-01-30', 2025],
      [1030, 'พิมพ์ใจ',  'แสงอรุณ',     '0861230030', 'Female', 'Thai', 's1030@school.th', 102, 1, 2568, 128, '1100200300301', '2017-04-16', 2025],
    ];

    // Room 103 (ป.1/3, grade 1): student_id 1031-1040, user_id 129-138
    const studentsRoom103 = [
      [1031, 'นนทพัทธ์',   'รัตนชาติ',    '0861230031', 'Male',   'Thai', 's1031@school.th', 103, 1, 2568, 129, '1100200310311', '2017-03-05', 2025],
      [1032, 'จิราภรณ์',   'พรพิมล',      '0861230032', 'Female', 'Thai', 's1032@school.th', 103, 1, 2568, 130, '1100200320321', '2017-06-20', 2025],
      [1033, 'กิตติพงศ์',  'เมืองไทย',   '0861230033', 'Male',   'Thai', 's1033@school.th', 103, 1, 2568, 131, '1100200330331', '2017-09-08', 2025],
      [1034, 'ธัญญารัตน์', 'ดาวเรือง',    '0861230034', 'Female', 'Thai', 's1034@school.th', 103, 1, 2568, 132, '1100200340341', '2017-12-17', 2025],
      [1035, 'พงษ์ศักดิ์', 'หงษ์ทอง',    '0861230035', 'Male',   'Thai', 's1035@school.th', 103, 1, 2568, 133, '1100200350351', '2018-02-28', 2025],
      [1036, 'เบญจมาภรณ์','อ่อนหวาน',    '0861230036', 'Female', 'Thai', 's1036@school.th', 103, 1, 2568, 134, '1100200360361', '2017-05-15', 2025],
      [1037, 'ยศพล',       'สีทอง',       '0861230037', 'Male',   'Thai', 's1037@school.th', 103, 1, 2568, 135, '1100200370371', '2017-08-01', 2025],
      [1038, 'กัญญาณัฐ',  'นาคทอง',      '0861230038', 'Female', 'Thai', 's1038@school.th', 103, 1, 2568, 136, '1100200380381', '2017-11-19', 2025],
      [1039, 'อภิวัฒน์',  'พลับพลา',     '0861230039', 'Male',   'Thai', 's1039@school.th', 103, 1, 2568, 137, '1100200390391', '2018-01-14', 2025],
      [1040, 'อาภาพร',    'ศรีทอง',      '0861230040', 'Female', 'Thai', 's1040@school.th', 103, 1, 2568, 138, '1100200400401', '2017-04-03', 2025],
    ];

    // Room 201 (ป.2/1, grade 2): student_id 1041-1050, user_id 139-148
    const studentsRoom201 = [
      [1041, 'ธนาธร',     'จันดา',       '0861230041', 'Male',   'Thai', 's1041@school.th', 201, 1, 2568, 139, '1100200410411', '2016-03-10', 2025],
      [1042, 'ชุติมา',    'มงคล',        '0861230042', 'Female', 'Thai', 's1042@school.th', 201, 1, 2568, 140, '1100200420421', '2016-06-25', 2025],
      [1043, 'กษิดิ์เดช', 'ศักดิ์ดา',    '0861230043', 'Male',   'Thai', 's1043@school.th', 201, 1, 2568, 141, '1100200430431', '2016-09-14', 2025],
      [1044, 'ดวงกมล',   'วิมล',         '0861230044', 'Female', 'Thai', 's1044@school.th', 201, 1, 2568, 142, '1100200440441', '2016-12-03', 2025],
      [1045, 'พิชิต',     'พิทักษ์',     '0861230045', 'Male',   'Thai', 's1045@school.th', 201, 1, 2568, 143, '1100200450451', '2017-02-19', 2025],
      [1046, 'ปิยนุช',    'สาระ',         '0861230046', 'Female', 'Thai', 's1046@school.th', 201, 1, 2568, 144, '1100200460461', '2016-05-07', 2025],
      [1047, 'ระพีพัฒน์', 'ฟ้าใส',       '0861230047', 'Male',   'Thai', 's1047@school.th', 201, 1, 2568, 145, '1100200470471', '2016-08-23', 2025],
      [1048, 'พรรณวิภา', 'แสงดาว',      '0861230048', 'Female', 'Thai', 's1048@school.th', 201, 1, 2568, 146, '1100200480481', '2016-11-12', 2025],
      [1049, 'ทักษิณ',   'นาคา',         '0861230049', 'Male',   'Thai', 's1049@school.th', 201, 1, 2568, 147, '1100200490491', '2017-01-30', 2025],
      [1050, 'ศุภิสรา',  'สุขใจ',        '0861230050', 'Female', 'Thai', 's1050@school.th', 201, 1, 2568, 148, '1100200500501', '2016-04-16', 2025],
    ];

    const allNewStudents = [
      ...studentsRoom1,
      ...studentsRoom101,
      ...studentsRoom102,
      ...studentsRoom103,
      ...studentsRoom201,
    ];

    for (const s of allNewStudents) {
      await run(
        `INSERT OR IGNORE INTO Students
          (student_id, first_name, last_name, phone, sex, nationality, email,
           room_id, semester, year, user_id, citizen_id, dob, enroll_year)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s
      );
    }
    console.log('✅ Students inserted (50 total: 1 existing + 49 new)');

    // ================================================================
    // 9. ADD SCHEDULE for rooms 101, 102, 103, 201 (Mon-Fri, 7 periods)
    // Existing room 1 already has 35 records → add 4 rooms × 35 = 140
    // ================================================================
    const g1Subs = [111, 112, 113, 114, 115, 116];
    const g2Subs = [211, 212, 213, 214, 215, 216];

    function pickSubject(subs, day, period) {
      // Rotate subjects by (day-1 + period-1) so each day has different order
      return subs[(day - 1 + period - 1) % subs.length];
    }

    const scheduleConfig = [
      { roomId: 101, subs: g1Subs, idStart: 36  },
      { roomId: 102, subs: g1Subs, idStart: 71  },
      { roomId: 103, subs: g1Subs, idStart: 106 },
      { roomId: 201, subs: g2Subs, idStart: 141 },
    ];

    for (const { roomId, subs, idStart } of scheduleConfig) {
      let schedId = idStart;
      for (let day = 1; day <= 5; day++) {
        for (let period = 1; period <= 7; period++) {
          const subjectId = pickSubject(subs, day, period);
          await run(
            `INSERT OR IGNORE INTO Schedule (id, room_id, day, period, type, subject_id, semester, year)
             VALUES (?, ?, ?, ?, 'ปกติ', ?, 1, 2568)`,
            [schedId, roomId, day, period, subjectId]
          );
          schedId++;
        }
      }
    }
    console.log('✅ Schedule inserted (Mon-Fri, 7 periods × 4 rooms = 140 records)');

    // ================================================================
    // 10. ADD EXAM SCHEDULES (กลางภาค / ปลายภาค)
    // ================================================================
    const examSchedules = [
      [3, '2025-10-15', 1, 2568, 'กลางภาค', 1],
      [4, '2025-12-10', 1, 2568, 'ปลายภาค', 1],
      [5, '2025-10-15', 1, 2568, 'กลางภาค', 2],
      [6, '2025-12-10', 1, 2568, 'ปลายภาค', 2],
      [7, '2025-10-16', 1, 2568, 'กลางภาค', 4],
      [8, '2025-12-11', 1, 2568, 'ปลายภาค', 4],
    ];
    for (const e of examSchedules) {
      await run(
        `INSERT OR IGNORE INTO Exam_Schedule (exam_id, date, semester, year, type, grade_level) VALUES (?, ?, ?, ?, ?, ?)`,
        e
      );
    }
    console.log('✅ Exam schedules inserted');

    // ================================================================
    // 11. ADD EXAM SCHEDULE ENTRIES
    // ================================================================
    const examEntries = [
      // exam_id 3: grade 1 กลางภาค
      [2,  '08:30', '10:30', 111, 3],
      [3,  '10:30', '12:30', 112, 3],
      [4,  '13:00', '15:00', 113, 3],
      [5,  '15:00', '17:00', 114, 3],
      // exam_id 4: grade 1 ปลายภาค
      [6,  '08:30', '10:30', 111, 4],
      [7,  '10:30', '12:30', 112, 4],
      [8,  '13:00', '15:00', 113, 4],
      [9,  '15:00', '17:00', 114, 4],
      // exam_id 5: grade 2 กลางภาค
      [10, '08:30', '10:30', 211, 5],
      [11, '10:30', '12:30', 212, 5],
      [12, '13:00', '15:00', 213, 5],
      [13, '15:00', '17:00', 214, 5],
      // exam_id 6: grade 2 ปลายภาค
      [14, '08:30', '10:30', 211, 6],
      [15, '10:30', '12:30', 212, 6],
      [16, '13:00', '15:00', 213, 6],
      [17, '15:00', '17:00', 214, 6],
      // exam_id 7: grade 4 กลางภาค
      [18, '08:30', '10:30', 101, 7],
      [19, '10:30', '12:30', 102, 7],
      [20, '13:00', '15:00', 103, 7],
      [21, '15:00', '17:00', 104, 7],
      // exam_id 8: grade 4 ปลายภาค
      [22, '08:30', '10:30', 101, 8],
      [23, '10:30', '12:30', 102, 8],
      [24, '13:00', '15:00', 103, 8],
      [25, '15:00', '17:00', 104, 8],
    ];
    for (const e of examEntries) {
      await run(
        `INSERT OR IGNORE INTO Exam_Schedule_Entries (entry_id, start, end, subject_id, exam_id) VALUES (?, ?, ?, ?, ?)`,
        e
      );
    }
    console.log('✅ Exam schedule entries inserted');

    // ================================================================
    // 12. ADD ATTENDANCE (6 school days × 50 students = 300 records)
    // ================================================================
    const attendanceDates = [
      '2026-02-23', // Mon
      '2026-02-24', // Tue
      '2026-02-25', // Wed
      '2026-02-26', // Thu
      '2026-02-27', // Fri
      '2026-03-02', // Mon (today)
    ];

    const allStudentIds = [
      1001, // existing
      ...allNewStudents.map((s) => s[0]),
    ];

    for (const studentId of allStudentIds) {
      for (const date of attendanceDates) {
        // Skip existing record (student 1001, 2026-03-01)
        const rand = Math.random();
        let status;
        if (rand < 0.75) status = 'Present';
        else if (rand < 0.87) status = 'Sick Leave';
        else if (rand < 0.95) status = 'Personal Leave';
        else status = 'Absent';
        await run(
          `INSERT OR IGNORE INTO Attendance (student_id, date, status) VALUES (?, ?, ?)`,
          [studentId, date, status]
        );
      }
    }
    console.log('✅ Attendance inserted (6 days × 50 students = 300 records)');

    // ================================================================
    // 13. ADD GRADE ENTRIES
    // ================================================================
    const gradeGroups = [
      { students: [1001, ...studentsRoom1.map((s) => s[0])],  subjects: [101, 102, 103, 104, 105, 106] },
      { students: studentsRoom101.map((s) => s[0]),            subjects: [111, 112, 113, 114, 115, 116] },
      { students: studentsRoom102.map((s) => s[0]),            subjects: [111, 112, 113, 114, 115, 116] },
      { students: studentsRoom103.map((s) => s[0]),            subjects: [111, 112, 113, 114, 115, 116] },
      { students: studentsRoom201.map((s) => s[0]),            subjects: [211, 212, 213, 214, 215, 216] },
    ];

    let gradeId = 1;
    for (const { students, subjects } of gradeGroups) {
      for (const studentId of students) {
        for (const subjectId of subjects) {
          // Random grade 50–100
          const grade = Math.floor(Math.random() * 51) + 50;
          await run(
            `INSERT OR IGNORE INTO Grade_Entries (grade_id, student_id, year, subject_id, grade, semester)
             VALUES (?, ?, 2568, ?, ?, 1)`,
            [gradeId, studentId, String(subjectId), grade]
          );
          gradeId++;
        }
      }
    }
    console.log(`✅ Grade entries inserted (${gradeId - 1} records)`);

    // ================================================================
    // 14. ADD EVENTS (school calendar)
    // ================================================================
    const events = [
      [1,  '2025-05-12', '09:00', 'วันเปิดภาคเรียนที่ 1 ปีการศึกษา 2568', 3],
      [2,  '2025-06-05', '08:00', 'พิธีไหว้ครู ประจำปีการศึกษา 2568',     3],
      [3,  '2025-07-28', '09:00', 'วันเฉลิมพระชนมพรรษา ร.10',             3],
      [4,  '2025-08-12', '10:00', 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',  3],
      [5,  '2025-10-15', '08:00', 'สอบกลางภาคเรียนที่ 1/2568',            3],
      [6,  '2025-10-16', '08:00', 'สอบกลางภาคเรียนที่ 1/2568 (วันที่ 2)', 3],
      [7,  '2025-10-31', '18:00', 'กิจกรรมวันลอยกระทง',                   3],
      [8,  '2025-11-05', '09:00', 'วันเปิดภาคเรียนที่ 2 ปีการศึกษา 2568', 3],
      [9,  '2025-12-05', '09:00', 'วันพ่อแห่งชาติ',                       3],
      [10, '2025-12-10', '08:00', 'สอบปลายภาคเรียนที่ 1/2568',            3],
      [11, '2025-12-11', '08:00', 'สอบปลายภาคเรียนที่ 1/2568 (วันที่ 2)', 3],
      [12, '2025-12-31', '18:00', 'กิจกรรมส่งท้ายปีใหม่',                 3],
      [13, '2026-01-13', '09:00', 'วันเด็กแห่งชาติ',                      3],
      [14, '2026-02-14', '09:00', 'กิจกรรมกีฬาสีโรงเรียน',               3],
      [15, '2026-03-06', '08:00', 'สอบกลางภาคเรียนที่ 2/2568',            3],
      [16, '2026-04-06', '09:00', 'วันจักรี',                              3],
      [17, '2026-04-13', '08:00', 'วันสงกรานต์ / ปิดภาคฤดูร้อน',         3],
    ];
    for (const e of events) {
      await run(
        `INSERT OR IGNORE INTO Events (event_id, date, time, title, user_id) VALUES (?, ?, ?, ?, ?)`,
        e
      );
    }
    console.log('✅ Events inserted (17 events)');

    // ================================================================
    // COMMIT
    // ================================================================
    await run('COMMIT');
    console.log('\n🎉 ===== MOCK DATA INSERTION COMPLETE =====');
    console.log('📊 Summary:');
    console.log('   👤 Users     : 9 existing + 8 teacher + 49 student = 66 total');
    console.log('   👨‍🏫 Teachers  : 2 existing + 8 new = 10 total');
    console.log('   🏫 Rooms     : 5 total (grade 1×3, grade 2×1, grade 4×1)');
    console.log('   📚 Subjects  : 3 existing + 16 new = 19 total');
    console.log('   👨‍🎓 Students  : 1 existing + 49 new = 50 total');
    console.log('   📅 Schedule  : 35 existing + 140 new = 175 records');
    console.log('   📝 Exams     : 2 existing + 6 new = 8 exam schedules');
    console.log('   📋 Exam Entries: 1 existing + 24 new = 25 entries');
    console.log('   ✔️  Attendance: 1 existing + 300 new records');
    console.log('   🏅 Grades    : 300 records (50 students × 6 subjects)');
    console.log('   📆 Events    : 17 school events');
    console.log('\n🔑 Login credentials (password = 1234):');
    console.log('   Admin   : a0003 / 1234 (role: admin)');
    console.log('   Admin   : a0004 / 1234 (role: admin)');
    console.log('   AO      : a0002 / 1234 (role: ao)');
    console.log('   Teacher : t0020 / 1234 → t0027 / 1234');
    console.log('   Student : s0100 / 1234 → s0148 / 1234');
    console.log('   Student : s0001 / 1234 (existing student 1001)');

  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    console.error('\n❌ ERROR - ROLLED BACK:', err.message);
    throw err;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
