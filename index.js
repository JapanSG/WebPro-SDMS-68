const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

const app = express();

let db = new sqlite3.Database('school.db', (err) => {    
  if (err) {
      return console.error(err.message);
  }
  console.log('Connected to the SQlite database.');
});



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