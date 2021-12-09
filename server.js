const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("express-flash");
const bcrypt = require("bcrypt");
const {pool} = require("./dbConfig");

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(bodyParser.urlencoded({extended: false}));

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

app.post("/register", async (req, res) =>{
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const password2 = req.body.password2;

    console.log({
        name,
        email,
        password,
        password2,
    });

    let errors = [];

    if(!name || !email || !password || !password2){
        errors.push({message: "Por favor preencha todos os campos."})
    }
    if(password.length < 6){
        errors.push({message: "Por favor escolha um senha maior que 6 caracteres"})
    }
    if(password != password2){
        errors.push({message: "As senhas não coincidem"})
    }
    if(errors.length > 0){
        res.render("register", {errors})
    }else{
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);

        pool.query(
            `SELECT * FROM users
            WHERE email = $1`, [email], (err, results)=>{
                if(err){
                    throw err;
                } 
                console.log(results.rows);
                if (results.rows.length > 0){
                    errors.push({message: "Email já cadastrado"});
                    res.render("register", {errors});
                }else{
                    pool.query(
                        `INSERT INTO users (name, email, password)
                        VALUES ($1, $2, $3)
                        RETURNING id, password`,
                        [name, email, hashedPassword],(err, results)=>{
                            if(err){
                                throw err;
                            } 
                            console.log(results.rows);
                            req.flash("success_msg", "Sua conta foi criada, por favor realize o login");
                            // res.redirect("/")
                        }
                    );
                }
            }
        )
    }
});

app.post("/login", async (req, res) =>{
    const email = req.body.email;
    const password = await bcrypt.hash(req.body.password, 10);

    pool.query(`SELECT * FROM users
    WHERE email, password = $1`, [email, password])
    if(!email || !password){
        errors.push({message: "Por favor preencha todos os campos."})
    }

    console.log({
        email,
        password
    });

});

app.listen(PORT, ()=>{
    console.log(`Server rodando na porta ${PORT}`);
})
