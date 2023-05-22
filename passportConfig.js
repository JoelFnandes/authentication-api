const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");

function initialize(passport) {
    const autheticateUser = (email, password, done) => {
        pool.query(`SELECT * FROM users WHERE email = $1`, [email], (err, results) => {
            if (err) {
                throw err;
            }
            console.log(results.rows);
            if (results.rows.length > 0) {
                const user = results.rows[0];
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (err) {
                        throw err;
                    }
                    console.log(err)
                    if (isMatch) {
                        return done(null, user);
                        isMatch.send(user);
                        successes.push({ message: "Autenticado" });
                        res.send({ successes });
                    } else {
                        return done(null, false, { message: "Senha incorreta!" })
                    }

                });
            } else {
                return done(null, false, { message: "Email não registrado" })
            }
        });
    }
    passport.use(
        new LocalStrategy(
            {
                usernameField: "email",
                passwordField: "password"
            },
            autheticateUser
        )
    );
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((id, done) =>{
        pool.query(
            `SELECT * FROM users WHERE id = $1`, [id], (err, results) =>{
                if(err){
                    throw err;
                }
                return done(null, results.rows[0]);
            }
        )
    })
}

module.exports = initialize;
