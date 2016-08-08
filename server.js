var http = require('http');
var child_process = require('child_process');
var fs = require('fs');

// fallback to 8080 port when it isnot provided in the cli arguments
var PORT = Number(process.argv[2]) || 8000;
// Matches endpoint with variation /battery or /battery/
var RE_BATTERY = /\/battery\/?/;

var BASE_URL = './';

var BATTERY_ERR_MSG = 'Unable to retrieve battery status';

// Error response
function onError(response, msg){
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.write(msg);
  response.end();
}

var CONFIG = getConfigForCurrentOS();

// function to find out the underlying os
function getConfigForCurrentOS(){
  switch(process.platform){
    case 'linux':
      return {
        batteryCommand: 'upower -i /org/freedesktop/UPower/devices/battery_BAT0 | grep -E "state|time to empty|to full|percentage"',
        batteryProcess: batteryProcessForLinux
      }
      break;
    case 'darwin':
      return {
        batteryCommand: 'pmset -g batt | egrep "([0-9]+\%).*" -o',
        batteryProcess : batteryProcessForMac
      }
      break;
    case 'win32':
      break;
    default:
  }
}

// Get battery status from the platform
function getBatteryStatus(response, onSuccess, onError){
  child_process.exec(CONFIG.batteryCommand, function(err, stdout, stderr){
    var battery;
    if (err){
      onError(response, BATTERY_ERR_MSG);
    }else{
      try {
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end(stdout);
      } catch(e){
        onError(response, BATTERY_ERR_MSG);
      }
    }
  })
}
// success response
function jsonResponseWrapper(response, data) {
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Access-Control-Allow-Origin': '*'
  });
  response.write(data);
  response.end();
}

var onBatteryInfo = jsonResponseWrapper;

// Battery status parser
function batteryProcessForMac(stdout){
  console.log('here we are');
  var battery = stdout.split(';').map(trimParam);
  return battery;
}


function trimParam(param) {
  return param.trim();
}

var server = http.createServer(function(request, response){
  var requestUrl = request.url;
  var filePath = BASE_URL + requestUrl;
  if (requestUrl === '/' || requestUrl === ''){
    response.writeHead(301, {
      Location: BASE_URL + 'public/demo.html'
    })
  } else if (RE_BATTERY.test(requestUrl)){
    getBatteryStatus(response, onBatteryInfo, onError);
  } else {
    fs.exists(filePath, function(exists){
      if (exists){
        fs.readFile(filePath, function(error, content){
          if (error){
            response.writeHead(500);
          } else{
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.end(content);
          }
        })
      } else {
        response.writeHead(404, {'Content-Type': 'text/plain'});
        response.write('404 - Resource not found');
        response.end();
      }
    })
  }
}).listen(PORT);
