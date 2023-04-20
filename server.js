// import { format } from "date-fns";
const { format } = require("date-fns");
const addDays = require("add-days");
const nodemailer = require("nodemailer");
//const router = require("./route/router.js");
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
require("dotenv").config();

const db = mysql.createConnection({
  host: process.env.HOST,
  user: "ravi",
  password: process.env.PASSW,
  database: process.env.DATABASE,
});

const initializeDb = () => {
  try {
    db.connect();
  } catch (e) {
    console.log(e.message);
  }
};

// initializeDb();

app.listen(5000, () => {
  console.log("Server Running at htttp://localhost:5000");
});

const authenticateToken = (request, response, next) => {
  console.log(request.headers);
  const authorizationData = request.headers.authorization;
  console.log(authorizationData);
  const jwtToken = authorizationData.split(" ")[1];
  if (jwtToken === undefined) {
    response.send("Invalid Access Tocken");
  } else {
    jwt.verify(jwtToken, "ravisabbi", async (error, payload) => {
      if (error) {
        response.send(401);
        response.send("Invalid Access Tocken");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//REGISTRATION OF USER API

app.post("/user", (request, response) => {
  //console.log(request.body);
  const { firstName, lastName, userName, email, password, action, role } =
    request.body;

  let user;
  db.query(
    "SELECT * FROM user WHERE username = ? OR email = ?",
    [userName, email],
    async (err, result) => {
      if (err) response.send(err).status(400);
      user = result;
      console.log(result);
      if (user.length > 0) {
        if (result[0].username === userName) {
          response.status(401).send({ msg: "Username already exists" });
        } else {
          response.status(401).send({ msg: "email already exists" });
        }
      } else {
        const bcrypted_password = await bcrypt.hash(password, 10);
        db.query(
          `INSERT INTO user ( firstname, lastname,username,email, password,action,role) VALUES (?, ?, ?, ?,?,?,?)`,
          [
            firstName,
            lastName,
            userName,
            email,
            bcrypted_password,
            action,
            role,
          ]
        );
        response.status(200);
        response.send({ msg: "User created successfully" });
      }
      // console.log(user);
    }
  );
});

//Login API

app.post("/login", (request, response) => {
  const { userName, password } = request.body;
  console.log(request.body);
  let user;
  db.query(
    `SELECT * FROM user WHERE username = ?`,
    [userName],
    async (err, result) => {
      if (err) response.send(err);
      user = result;
      console.log(user);
      if (user.length > 0) {
        const is_password_matched = await bcrypt.compare(
          password,
          user[0].password
        );
        //  console.log(is_password_matched)
        if (!is_password_matched) {
          response.status(401);
          response.send({ msg: "Invalid Password" });
        } else {
          const payload = { userName };
          const jwt_token = jwt.sign(payload, "ravisabbi");
          user_details = {...user[0],action:user[0].action?.data?.readUInt8(0)===1}
          response.status(200);
          response.send({ jwt_token, user_details});
        }
      } else {
        response.status(404).send({ msg: "User not found" });
      }
    }
  );

  //console.log(user.length);
});

app.post("/sendmail", (req, res) => {
  const { email } = req.body;
  //res.send(email);
  //console.log(req);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: "ravisabbi7036@gmail.com",
      to: email,
      subject: "http://localhost:3000/signUp",
      text: "http://localhost:3000/signUp",
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        res.send(error);
        //console.log(error);
      } else {
        console.log(info);
        res.send(info);
      }
    });
  } catch (e) {
    console.log(e);
    res.send(e);
  }
});

// GET ALL USERS

app.get("/getUsers", (req, res) => {
  const role = "user";

  db.query(
    "SELECT id,firstname,lastname,username,email,action,role FROM user WHERE role = ?",
    [role],
    (error, result) => {
      if (error) {
        res.status(400).send(error);
      } else {
        const mappedResult = result.map((row) => ({...row,action: row.action?.data?.readUInt8(0) === 1}))
        res.status(200).send(mappedResult);
      }
    }
  );
});

//RESTRICT USER API

app.patch("/restrictUser", (req, res) => {
  const { id, action } = req.body;
  //res.send("Hello");
  db.query(
    "UPDATE user SET action = ? WHERE id = ?",
    [action, id],
    (error, result) => {
      if (error) res.status(400).send("Error");
      else {
        res.status(200).send("User Updated");
      }
    }
  );
});

//getUsersData

app.get("/getUserData", (req, res) => {
  const userDataQuery = `SELECT
                   user.id,
                   user.username,COUNT(*) as no_surveys,
                   user.role
                   from user inner join userSurvey on user.id = userSurvey.user_id
                   WHERE role = "user"
                   group by user.username`;
  const activeInactiveQuery = `SELECT
                                (SELECT COUNT(*) FROM user WHERE action = ${true} AND role = "user") as active_users,
                                (SELECT COUNT(*) FROM user WHERE action = ${false} AND role = "user") as inactive_users`;
  db.query(userDataQuery, (error, result) => {
    if (error) {
      res.status(400).send(error);
    } else {
      db.query(activeInactiveQuery, (err, re) => {
        if (err) {
          res.status(500).send(err);
        } else {
          const data = {
            status_count: re[0],
            user_data: result,
          };
          res.send(data);
        }
      });
    }
  });
});

//get all surveys API
app.get("/usersurveys/:id", (req, res) => {
  const { id } = req.params;
  const get_all_surveys_Query = `SELECT * FROM userSurvey WHERE user_id = ${id}`;
  db.query(get_all_surveys_Query, (error, result) => {
    if (error) res.status(400).send(error);
    else {
      const updated_result =result.map((row) => ({...row,status: row.status?.data?.readUInt8(0) === 1}));
      res.status(200).send(updated_result);
    }
  });
});

//get last 5'days survey data
app.get("/getUserSurveysData/:id", (req, res) => {
  const { id } = req.params;

  const today = new Date();
  const startDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 5
  );

  console.log(startDate);

  const completedAndInCompletedQurey = `SELECT
  COUNT(CASE WHEN status = true THEN 1 ELSE NULL END) as no_of_completed,
  COUNT(CASE WHEN status = false THEN 1 ELSE NULL END) as no_of_incompleted
FROM
  userSurvey
WHERE user_id=?
GROUP BY
  user_id`;

  const userSurveyQuery = `
    SELECT
      id,
      DATE(survey_date) as survey_date,
      COUNT(*) as no_surveys
    FROM userSurvey
    WHERE user_id = ? AND DATE(survey_date) >= ?
    GROUP BY DATE(survey_date)
  `;

  db.query(userSurveyQuery, [id, startDate], (error, result) => {
    if (error) res.status(400).send(error);
    else {
      //res.send(result);
      console.log(result);
      db.query(completedAndInCompletedQurey, [id], (err, counts) => {
        if (err) res.status(400).send(err);
        else {
          const resData = [
            {
              status_count: counts,
              data: result,
            },
          ];
          res.status(200).send(resData);
        }
      });
    }
  });
});
