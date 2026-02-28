const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

function initialize(passport,db) {
    const authenticateUser = async (username, password,done) => {
        db.get(`SELECT * FROM Users WHERE username = ?`, [username] , async (err,user) => {
            if(err) return done(err);

            if(!user){
                return done(null,false,{message : 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ'});
            }
            try {
                if(await bcrypt.compare(password, user.password)) {
                    return done(null, user);
                } else {
                    return done(null, false, {message: 'รหัสผ่านไม่ถูกต้อง'});
                }
            } catch(e){
                return done(e);
            }
        });
    }
    passport.use(new LocalStrategy({ usernameField: 'username' }, authenticateUser))

    passport.serializeUser((user, done) => {
        done(null, user.user_id);
    });

    passport.deserializeUser((id, done) => {
        db.get(`SELECT * FROM Users WHERE user_id = ?`, [id], (err,user) => {
            if (err) return done(err);

            return done(null, user);
        })
    });
}

module.exports = initialize;