const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("express-flash");
const bcrypt = require("bcrypt");
const { pool } = require("./dbConfig");

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
    secret: 'secret',

    resave: false,

    saveUninitialized: false
}));

app.use(flash());

app.use(
    cors({
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true,
    })
)

// app.get("/", (req, res) => {
//     res.send("index");
// });
// app.get("/register", (req, res) => {
//     res.render("register");
// });

app.post("/register", async (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const password2 = req.body.password2;



    let errors = [];
    let successes = [];

    if (!name || !email || !password || !password2) {
        errors.push({ message: "Por favor preencha todos os campos." })
    }
    else {
        if (password.length < 6) {
            errors.push({ message: "Por favor escolha um senha maior que 6 caracteres" })
        }
        else {
            if (password != password2) {
                errors.push({ message: "As senhas não coincidem" })
            }
        }
    }
    if (errors.length > 0) {
        res.send({ errors })
    } else {
        let hashedPassword = await bcrypt.hash(password, 10);

        pool.query(
            `SELECT * FROM users
            WHERE email = $1`, [email], (err, results) => {
            if (err) {
                throw err;
            }
            if (results.rows.length > 0) {
                errors.push({ message: "Email já cadastrado" });
                res.send({ errors });
            } else {
                pool.query(
                    `INSERT INTO users (name, email, password)
                        VALUES ($1, $2, $3)
                        RETURNING id`,
                    [name, email, hashedPassword], (err, results) => {
                        if (err) {
                            throw err;
                        }
                        console.log(results.rows);
                        if (results.rows.length > 0) {
                            successes.push({ message: "Sua conta foi criada, por favor realize o login." });
                            res.send({ successes });

                        }

                    }

                );
            }
        }
        )
    }
});

app.post("/login", async (req, res) => {
    let errors = [];
    let successes = [];
    const email = req.body.email;
    const password = await bcrypt.hash(req.body.password, 10);
    if (!email || !password) {
        errors.push({ message: "Por favor preencha todos os campos." })
        res.send({ errors });
    }
    else {
        pool.query(`SELECT * FROM users WHERE email = $1`, [email], (err, results) => {
            if (err) {
                throw err;
            }
            console.log(results.rows);  
            if (results.rows.length > 0) {
                const user = results.rows[0];
                bcrypt.compare(password, user.password, (err, isMatch) =>{
                if(err){
                    throw err;
                }
                if(isMatch){
                    return done(null, user);
                    isMatch.send(user);
                }
                // successes.push({ message: "Autenticado" });
                // res.send({ successes });
                });
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server rodando na porta ${PORT}`);
})
