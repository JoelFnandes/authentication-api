const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("express-flash");
const bcrypt = require("bcrypt");
const { pool } = require("./dbConfig");
const passport = require("passport");
const amqp = require('amqplib');
const initializePassport = require("./passportConfig");

initializePassport(passport);

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
    secret: 'secret',

    resave: false,

    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

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
// app.get("/users/register", (req, res) => {
//     res.render("register");
// });

// app.get("/users/login", (req, res) => {
//     res.render("login");
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
            console.log(results.rows)
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

app.post("/signIn", async (req, res) => {
    let errors = [];
    let successes = [];
    let isAuthenticated;
    let user;
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        errors.push({ message: "Por favor preencha todos os campos." })
        res.send({ errors });
    }
    else {
        pool.query(`SELECT * FROM users WHERE email = $1`, [email], (err, results) => {
            if (err) {
                errors.push({ message: "Email incorreto" });
                res.send({ errors });
            }
            console.log(results.rows);
            if (results.rows.length > 0) {
                const user = results.rows[0];
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if (isMatch) {
                        successes.push({ message: user.id })
                        successes.push({ message: user.name });
                        res.send({ successes });

                    } else {
                        errors.push({ message: "Senha incorreta" });
                        res.send({ errors });
                    }

                });
            }
            else {
                errors.push({ message: "Email não cadastrado" });
                res.send({ errors });
            }
        });
    }
});

app.post("/createRooms", async (req, res) => {
    const nameRoom = req.body.nameRoom;
    const user_id = req.body.user_id;
    let errors = [];
    let successes = [];
    let chats = [];

    try {
        const roomExists = await pool.query("SELECT * FROM rooms WHERE name = $1", [nameRoom]);
        console.log(roomExists.rows);
        if (roomExists.rows.length > 0) {
            errors.push({ message: "Nome já existente" });
        } else {
            const insertedRoom = await pool.query("INSERT INTO rooms (name) VALUES ($1) RETURNING id", [nameRoom]);
            console.log(insertedRoom.rows);
            if (insertedRoom.rows.length > 0) {
                const roomId = insertedRoom.rows[0].id;
                chats = insertedRoom.rows;

                const insertedParticipant = await pool.query(
                    "INSERT INTO participants (user_id, room_id) VALUES ($1, $2) RETURNING id",
                    [user_id, roomId]
                );
                console.log(insertedParticipant.rows);
                if (insertedParticipant.rows.length > 0) {
                    const myUserParti = insertedParticipant.rows[0];
                    successes.push({ myUserParti });
                }
            }
        }

        // Verificar se ocorreram erros ou sucessos e enviar a resposta apropriada
        if (errors.length > 0) {
            res.send({ errors });
        } else if (successes && successes.length > 0) { // Adicione a verificação para successes
            res.send({ successes });
        }
    } catch (err) {
        console.error(err);
        errors.push({ message: "Ocorreu um erro ao criar a sala" });
        res.send({ errors });
    }
});

app.get("/chats", async (req, res) => {
    try {
        const user_id = req.query.user_id;
        const { rows } = await pool.query(
            `SELECT * FROM participants WHERE user_id = $1`,
            [user_id]
        );
        if (rows.length > 0) {
            const promises = rows.map(async (participant) => {
                const { rows: rowsChats } = await pool.query(
                    `SELECT * FROM rooms WHERE id = $1`,
                    [participant.room_id]
                );
                return rowsChats;
            });
            const results = await Promise.all(promises);
            const chats = results.flat();
            res.send({ successes: [{ chats }] });
        } else {
            res.send({ errors: [{ message: "Nenhum chat encontrado" }] });
        }
    } catch (err) {
        console.log(err);
        res.send({ errors: [{ message: "Erro ao buscar chats" }] });
    }
});


app.post("/addParticipants", async (req, res) => {
    const nameParti = req.body.nameParti;
    const room_id = req.body.room_id;
    const user_id = req.body.user_id;
    let errors = [];
    let successes = [];

    pool.query(
        `SELECT * FROM users
            WHERE name = $1`, [nameParti], (err, results) => {
        if (err) {
            throw err;
        }
        console.log(results.rows)
        if (results.rows.length > 0) {
            const userParti = results.rows[0];
            pool.query(
                `SELECT * FROM participants
                WHERE id = $1`, [user_id], (err, results) => {
                if (err) {
                    throw err;
                }
                if (results.rows.length == 0) {
                    pool.query(
                        `INSERT INTO participants (user_id, room_id)
                                VALUES ($1, $2)
                                RETURNING id`,
                        [userParti.id, room_id], (err, results) => {
                            if (err) {
                                throw err;
                            }
                            console.log(results.rows);
                            if (results.rows.length > 0) {
                                successes.push({ message: "Grupo criado" });
                                res.send({ successes });

                            }

                        }

                    );
                }
            }
            );

        } else {
            errors.push({ message: "Usuario não encontradao" });
            res.send({ errors });
        }
    }
    )
});

app.get("/messages", async (req, res) => {
    try {
      const chat_id = req.query.chat_id;
      const { rows } = await pool.query(
        `SELECT * FROM messages WHERE room_id = $1`,
        [chat_id]   
      );
      res.send({ successes: rows });
    } catch (err) {
      console.log(err);
      res.send({ errors: [{ message: "Erro ao buscar mensagens" }] });
    }
  });


app.post("/messages", async (req, res) => {
    const user_id = req.body.user_id;
    const chat_id = req.body.chat_id;
    const message = req.body.message;

    if (!message) {
        return res.status(400).json({ error: "Por favor, preencha a mensagem" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO messages (room_id, user_id, message)
            VALUES ($1, $2, $3)
            RETURNING *`,
            [chat_id, user_id, message]
        );

        const newMessage = result.rows[0];
        res.status(201).json({ success: true, message: "Mensagem enviada com sucesso", data: newMessage });
    } catch (error) {
        console.error("Erro ao inserir a mensagem:", error);
        res.status(500).json({ error: "Ocorreu um erro ao inserir a mensagem" });
    }
});


// function checkAuthenticated(req, res, next){
//     if((req.isAuthenticated())){
//         return res.redirect("src/pages/HomeMain/HomeMain");
//     }
//     next();
// }

// function checkNotAuthenticated(req, res, next){
//     if((req.isAuthenticated())){
//         return next();
//     }

// }

app.listen(PORT, () => {
    console.log(`Server rodando na porta ${PORT}`);
});
