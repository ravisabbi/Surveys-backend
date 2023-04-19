const { request } = require("express");
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer")
require("dotenv").config()

router.post("/re",(req,res) => {
    const {email} = req.body;
    console
    try{
         const transporter = nodemailer.createTransport({
            service:"gmail",
            auth:{
                user:process.env.EMAIL,
                pass:process.env.PASSWORD
            }
         })

         const mailOptions = {
            from:process.env.EMAIL,
            to:email,
            subject:"Success",
            html:"<h1>HEllo</h1>"
         }

        transporter.sendMail(mailOptions,(error,info) =>{
            if(error){
                console.log(error);
            }
            else{
                console.log(info.response);
                res.send(info);
            }

        });

    }
    catch(e){
              console.log(e);
    }

});

module.exports = router;