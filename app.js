var express   = require('express'),
    app       = express(),
    serv      = require('http').Server(app);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client', express.static(__dirname + '/client'));


serv.listen(2000);
console.log('Server started at 2000');

var SOCKET_LIST = [];
// var PLAYER_LIST = [];

var Entity = function(){
  var self = {
    x:250,
    y: 250,
    spdX: 0,
    spdY: 0,
    id: "",
  }
  self.update = function(){
    self.updatePosition();
  }
  self.updatePosition = function(){
    self.x += self.spdX;
    self.y += self.spdY;
  }
  return self;
}

var Player = function(id){
  var self =  Entity();
  self.id = id;
  self.number = "" + Math.floor(10 * Math.random());
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.mouseAngle = 0;
  self.maxSpd = 10;

  var super_update = self.update;
  self.update = function(){
    self.updateSpd();
    super_update();
    if(Math.random() < 0.1){
      self.shootBullet(Math.random()*360);
    }
  }

  self.shootBullet = function(angle){
    var b = new Bullet(angle);
    b.x = self.x;
    b.y = self.y;
  }


  self.updateSpd = function(){
    if(self.pressingRight){
      self.x += self.maxSpd
    }
    if(self.pressingLeft){
      self.x -= self.maxSpd
    }
    if(self.pressingUp){
      self.y -= self.maxSpd
    }
    if(self.pressingDown){
      self.y += self.maxSpd
    }
  }
  Player.list[id] = self;
  return self;
}
Player.list = {};

Player.onConnect = function(socket){
  var player = new Player(socket.id);
  socket.on('keyPressed', function(data){
    if(data.inputId == 'left'){
      player.pressingLeft = data.state;
    }
    else if (data.inputId == 'right') {
      player.pressingRight = data.state;
    }
    else if (data.inputId == 'up') {
      player.pressingUp = data.state;
    }
    else if (data.inputId == 'down') {
      player.pressingDown = data.state;
    }
  });
}

Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
}

var Bullet = function(angle){
  var self = Entity();
  self.id = Math.random();
  self.spdX = Math.cos(angle/180*Math.PI) * 10;
  self.spdY = Math.sin(angle/180*Math.PI) * 10;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > 1000){
        self.toRemove = true;
    }
    super_update();
  }
  Bullet.list[self.id] = self;
  return self;
}
Bullet.list = {};

Bullet.update = function(){

  var pack = [];
  for(var i in Bullet.list){
    var bullet = Bullet.list[i];
    bullet.update();
    pack.push({
      x: bullet.x,
      y: bullet.y
    })
  }
  return pack;
}

var DEBUG = true;

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  Player.onConnect(socket);

  socket.on('disconnect', function(){
    delete SOCKET_LIST[socket.id];
    delete Player.onDisconnect(socket);
  });

  socket.on('sendMsgToServer', function(data){
    var playerName = ("" + socket.id).slice(2,7);
    console.log('chat came');
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data);
    }
  });
  socket.on('debugMe', function(data){
    if(!DEBUG){
      return;
    }
    socket.emit('debugMeAnswer', eval(data));
  })
});

Player.update = function(){
  var pack = [];

  for(var i in Player.list){
    var player = Player.list[i];
    player.update();
    pack.push({
      x: player.x,
      y: player.y,
      number: player.number
    })
  }
  return pack;
}
setInterval(function(){
  var pack = {
    player: Player.update(),
    bullet: Bullet.update()
  }
  for(var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('newPosition', pack);
  }
},1000/25);
