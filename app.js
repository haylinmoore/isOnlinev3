require('dotenv').config()
var express = require('express')
var app = express()
var port = process.env.PORT || 8080;
var mysql = require('mysql');
var requestify = require('requestify');
var jsSha256 = require("js-sha256");
var connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

function makeid(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < len; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

connection.connect()

app.all('/', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
 });

app.get('/', function(req, res) {
    res.redirect("https://isonlinev3.docs.apiary.io")
})

//STATUS PATH

app.get('/v1/status/get/:users', function(req, res) {
    let names = req.params.users.split(",");
    let command = 'SELECT `username`,`date` FROM users WHERE (';
    console.log(names);
    for (var i in names) {
        command += 'BINARY username = ? OR ';
    }

    command = command.slice(0, -4);
    command += ")";

    connection.query(command, names, function(err, rows, fields) {
        if (err) throw err
        
        let timestamp = Math.floor(new Date() / 1000);
        let users = {};
        
		for (var i in rows){
			if (users[rows[i].username] == undefined || users[rows[i].username] < rows[i].date){
				users[rows[i].username] = rows[i].date;
			}
		}
		
        for (var i in users){
            let time = timestamp - users[i];
            
            if (time < 180){ // 3 minutes
                time = "online";
            } else if (time < 1209600) { // Less than 2 weeks
                time = "offline";
            } else { // Longer than 2 weeks
                time = "unknown";
            }
            
            names = names.filter(e => e !== i);
            
            users[i] = time;
        }
        
        for (var i in names){
            users.push({name:names[i], status:"notiouser"});
        }
        
        res.json(users);
    })

})

app.get('/v1/totalusers', function(req, res) {
    let command = "SELECT COUNT(DISTINCT(username)) FROM users"
    connection.query(command, function(err, rows, fields) {
        if (err) {
            res.json(err);
            console.log(err);
        } else {
            res.json({count:rows[0]["COUNT(DISTINCT(username))"]});
        }
    })

})

app.get('/v1/status/onlineusers', function(req, res) {
    let command = "SELECT COUNT(DISTINCT(username)) FROM users WHERE date>=" + (Math.floor(new Date() / 1000)-180);
    connection.query(command, function(err, rows, fields) {
        if (err) {
            res.json(err);
            console.log(err);
        } else {
            res.json({count:rows[0]["COUNT(DISTINCT(username))"]});
        }
    })

})

app.get('/v1/status/set/:user/:userkey', function(req, res) {
    let command = "UPDATE users SET date = ? WHERE BINARY username = ? AND BINARY token = ?";

    connection.query(command, [Math.floor(new Date() / 1000), req.params.user, req.params.userkey], function(err, result) {
        if (result.changedRows != 1 || err) {
            res.json({
                success: false
            });
            console.log(err);
        } else {
            res.json({
                success: true
            });
        }
    })

})

// VERIFY PATH

app.get('/v1/verify/gettoken/:username/:passphrase', function(req, res) {
    let command = "INSERT INTO users (username, date, token, comment) VALUES (?, ?, ?, ?)";

    requestify.get('https://api.scratch.mit.edu/projects/274388698/comments?' + Math.random()).then(function(response) {
        // Get the response body
        
        let messages = response.getBody();
        let hash = jsSha256(req.params.passphrase);
        let verified = 0;
        for (var i in messages){
            if (messages[i].author.username === req.params.username && messages[i].content === hash){
                verified = 1;
                break;
            }
        }
        
        if (verified == 0){
            res.json({
                token: false
            });
            return;
        }
        let token = makeid(64);

        connection.query(command, [req.params.username, Math.floor(new Date() / 1000), token, hash], function(err, result) {
            if (err) {
                res.json({
                    token: false
                });
                //console.log(err);
            } else {
                res.json({
                    token: token
                });
            }
        })

    });

})

app.listen(port, () => console.log(`isOnlineV3 listening on port ${port}!`))
