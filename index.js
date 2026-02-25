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

let dbad = new sqlite3.Database('student.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite Student database.');
});

const initializePassport = require('./passport-config');
initializePassport(passport, db);

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/',function(req,res){
    res.render('login');
});
app.get('/student/home',function(req,res){
    res.render('Home-Student');
});
app.get('/teacher/home',function(req,res){
    res.render('Home-Teacher');
});
app.get('/admin/home',function(req,res){
    res.render('Home-Admin');
});





app.listen(port, () => {
   console.log("Server started.");
 });