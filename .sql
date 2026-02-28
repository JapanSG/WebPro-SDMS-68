-- Get Student
SELECT * 
FROM GRADE_ENTRIES 
JOIN Subjects
USING (subject_id)
WHERE student_id = (SELECT student_id FROM Students WHERE user_id = ${req.user.user_id})

-- -- Submit Grade
-- SELECT * 
-- FROM Students st
-- LEFT JOIN Grade_Entries g
-- USING (student_id)
-- LEFT JOIN Subjects su
-- USING (subject_id)
-- LEFT JOIN Teachers t
-- USING (teacher_id)
-- WHERE t.user_id = ${req.user.user_id} AND subject_id = ${req.query.type};

-- Submit Grade
SELECT *
FROM Students st
JOIN Rooms
USING (room_id)
WHERE grade_level IN    (   SELECT grade_level 
                            FROM Subjects
                            WHERE subject_id = ${req.query.type}
                        )

SELECT *
FROM Subjects s
JOIN Teacher t
USING (teacher_id)
JOIN Users u
ON t.user_id == u.user_id
JOIN grade_entries
USING (subject_id)
WHERE t.teacher_id = ${req.user.user_id} AND s.subject_id = ${req.query.type};
