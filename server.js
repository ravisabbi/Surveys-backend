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
const cors = require("cors");
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

app.use(cors());
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
        console.log(!(user[0]?.action.readInt8()===1))
        if(!(user[0]?.action.readInt8()===1)){
              response.status(400).send({msg:"Your acceess denied"})
        }
        else{
        if (!is_password_matched) {
          response.status(401);
          response.send({ msg: "Invalid Password" });
        } else {
          const payload = { userName };
          const jwt_token = jwt.sign(payload, "ravisabbi");
          user_details = {
            ...user[0],
            action: user[0]?.action.readUInt8() === 1,
          };
          delete user_details["password"];
          response.status(200);
          response.send({ jwt_token, user_details });
        }
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
  const { search_result = "" } = req.query;
  console.log('search',search_result);
  const role = "user";

  db.query(
    `SELECT id,firstname,lastname,username,email,action,role FROM user WHERE role = ? AND LOWER(username) LIKE ?`,
    [role, `%${search_result.toLocaleLowerCase()}%`],
    (error, result) => {
      if (error) {
        res.status(400).send(error);
      } else {
        result.map((row) => {
          console.log(row?.action.readInt8() == 1);
        });
         
        const mappedResult = result.map((row) => ({
          ...row,
          action: row?.action.readInt8() == 1,
        }));
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
app.get("/userSurveys/:id", (req, res) => {
  const { id } = req.params;
  const {search_result = ""} = req.query;
  const get_all_surveys_Query = `SELECT * FROM userSurvey WHERE user_id = ${id} AND LOWER(email) LIKE ?`;
  db.query(get_all_surveys_Query,[`%${search_result.toLocaleLowerCase()}%`], (error, result) => {
    if (error) res.status(400).send(error);
    else {
      const updated_result = result.map((row) => ({
        ...row,
        survey_date:row.survey_date.toLocaleDateString("en-GB"),
        status: row.status?.readUInt8() === 1,
      }));
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
      const formattedData = result.map((eachItem) => ({
        ...eachItem,
        survey_date: eachItem.survey_date.toLocaleDateString("en-GB"),
      }));
      console.log(formattedData);
      db.query(completedAndInCompletedQurey, [id], (err, counts) => {
        if (err) res.status(400).send(err);
        else {
          const { no_of_completed, no_of_incompleted } = counts[0];
          const resData = {
            status_count: { no_of_completed, no_of_incompleted },
            user_survey_list: formattedData,
          };

          res.status(200).send(resData);
        }
      });
    }
  });
});

//Send Survey via Mail
app.post("/survey", (req, res) => {
  const { email, user_id } = req.body;
  console.log(req.body);
  const date = new Date();
  const status = false;
        db.query(
          "INSERT INTO userSurvey(user_id,email,survey_date,status) VALUES (?,?,?,?)",
          [user_id, email, date, status],
          (error, result) => {
            if (error) res.send(error);
            else {
              console.log(result.insertId);
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
                  subject: "Please complete your survey",
                  text: `http://localhost:3000/surveyForm/${result.insertId}`,
                };
      
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    res.staus(400).send(error);
                  } else {
                    res.status(200).send("Survey sent successfully");
                  }
                });
              } catch (e) {
                res.status(400).send(e);
              }
            }
          }
        );  
});

//submiting form and updating status
app.patch("/submitSurveyForm", (req, res) => {
  const { survey_id } = req.body;
  console.log(req.body);
  db.query(
    `UPDATE userSurvey SET status=? WHERE id = ?`,
    [true, survey_id],
    (error, result) => {
      if (error) {
        console.log(error);
        res.send(error);
      } else {
        console.log(result);
        res.send("Status Updated Successfully!");
      }
    }
  );
});

//Get status of survey

app.get("/survey/:id",(req,res)=>{
  const {id} = req.params
  db.query('SELECT * FROM userSurvey WHERE id = ?',[id],(error,result) => {
    if(error){
      res.status(400).send(error)
    }
    else{
      console.log(result)
      if(result.length>0){
      const formattedData = {...result[0],status:result[0]?.status.readInt8() ===1}
      res.status(200).send(formattedData);
      }
      else{
        res.status(400).send({msg:"Survey not found"})
      }
    }
  })

});






 