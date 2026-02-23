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

const initializePassport = require('./passport-config');
initializePassport(passport, db);

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));

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

app.get('/student/home',(req, res) => {
    res.render('Home-Student', { user: req.user });
});
app.get('/teacher/home',(req, res) => {
    res.render('Home-Teacher', { user: req.user });
});
app.get('/admin/home',(req, res) => {
    res.render('Home-Admin', { user: req.user });
});
app.get('/ao/submit',(req, res) => {
    res.render('Submit-Attendance', { user: req.user });
});



function createAccount(role) {
    return new Promise(async (resolve, reject) => {
        try {
            const DEFAULT_PASSWORD = 'webPro2026';
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

            db.get(`SELECT username FROM Users WHERE role = ? ORDER BY user_id DESC LIMIT 1`,[role], (err, row) => {
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

app.get('/admin/add-users/:role',async (req, res) => {
    const requestedRole = req.params.role;
    console.log('requestedRole: ', requestedRole);

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
async function initializeUsers() {
    db.get(`SELECT * FROM Users WHERE role = 'admin'`, async (err, row) => {
        if (err) return console.error('DB Error:', err.message);

        if (!row) {
            console.log('System: Admin account not found. Creating initial Admin account...');
            const result = await createAccount('admin');

            if (result.success) {
                console.log(`System: Admin created successfully. Username: ${result.user.username}`);
            } else {
                console.log(`System: Failed to create Admin account. Error: ${result.error}`);
            }
        }
    })
    db.get(`SELECT * FROM Users WHERE role = 'ao'`, async (err, row) => {
        if (err) return console.error('DB Error:', err.message);

        if (!row) {
            console.log('System: AO account not found. Creating initial AO account...');
            const result = await createAccount('ao');

            if (result.success) {
                console.log(`System: AO created successfully. Username: ${result.user.username}`);
            } else {
                console.log(`System: Failed to create AO account. Error: ${result.error}`);
            }
        }
    })

}


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

app.listen(port, () => {
    console.log("Server started.");

    initializeUsers();
});