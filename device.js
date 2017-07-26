/*
Author: LawrenceDon 
Mail: lawrencedon@163.com
QQ: 20515042 
Website: www.espruino.cn
Github: github.com/LawrenceDon/nodejs-device-hekr
MIT License 
Copyright (c) 2017 LawrenceDon
*/

var debugOutputFlag = true; //设置是否输出debug信息，本脚本运行之后，在CMD窗口输入eval:logOn()或者eval:logOff()来打开或者关闭debug信息输出
function getDevTid() 
{
  return "NODEJS_" + "SN20170725001"; //使用前请修改，devTid代表设备ID，可以自己定义设备ID规则，devTid的最大长度是32   
}
var device = {  //本脚本运行之后，在CMD窗口输入eval:device，会显示该对象的内容，其中的devTid,prodKey,token,ctrlKey,bindKey我们需要记录下来，其中的devTid和bindKey将用于生成绑定设备时需要的二维码
	devTid:"",
	prodKey:"xxxxxx", //需要填写自己产品的prodKey。更改prodKey之前应该先运行本脚本，在CMD窗口输入eval:clearDevToken(localStorage,devTokenKey)清除之前的token，如果该设备已经被绑定，那需要先在APP中将该设备删除掉
	token:"",
  ctrlKey:"",
  bindKey:"",
  mainTCPLink:null,
  mainTCPLinkReady:false,
  getProdInfoTCPLink:null,
  heartbeatIntervalID:0
};

var devInfo = {
  devTid:"",
  mid:"",
  workMode:0,
  tokenType:2,
  serviceHost:"",
  servicePort:0,
  binVer:"0.1.0",
  binType:"NA",
  sdkver:"2.0.0",
  SDKVer:"2.0.0",
  mac:"",
  MAC:"",
  ssid:"",
  SSID:"",
  lanIp:""
};

var infoServer = {
    host:'info-dev.hekr.me',
    port:91
};

var server = {
	host:"",
	port:0
};   

var net = require('net');
var qr = require('qr-image');
var LocalStorage = require('node-localstorage').LocalStorage;
var localStorage = new LocalStorage('./devParams');
var devTokenKey = "devToken";
var msgId = -1;     
var respStrTemp = "";  
var heartbeatRespFlag = 0;

function getMsgId() 
{
  if(msgId == 65535) 
  {
    msgId = 0;
  } 
  else 
  {
    msgId++;
  }                
  return msgId;
}

function isRespComplete(data)
{
  var index0 = data.indexOf("\n");  
  if(index0 != -1)
  {
    return 1;  
  }
  return 0;   
}

function getDevToken(localStorage,key)
{
  var lsDevToken = localStorage.getItem(key);
  if(lsDevToken == null)
  {
    localStorage.setItem(key, '');   
    lsDevToken = '';
  }
  device.token = lsDevToken; 
  return lsDevToken;
}

function setDevToken(localStorage,key,data)
{
  localStorage.setItem(key, data); 
}

function clearDevToken(localStorage,key)
{ 
  localStorage.setItem(key, ''); 
}

function getProdInfo()
{
  var getInfo_tpl='{"msgId" : "{msgId}","action" : "getProdInfo","params" : {"devTid" : "{devTid}","prodKey" : "{prodKey}"}}\n';
  var getInfo_str=getInfo_tpl.replace('{msgId}',getMsgId()).replace('{devTid}',device.devTid).replace('{prodKey}',device.prodKey);
  device.getProdInfoTCPLink = net.connect(infoServer, function(){
    debugOutput("getProdInfo TCP connected!");
    debugOutput('getProdInfo send : ' + getInfo_str);
    device.getProdInfoTCPLink.write(getInfo_str);
  }); 
  getProdInfoBind(device.getProdInfoTCPLink);
}

function getProdInfoBind(client)
{
  client.on('data', function(data){
    respStrTemp += data;
    if(isRespComplete(respStrTemp) == 1)
    {
      debugOutput('getProdInfo recv : ' + respStrTemp);	
      var jsonData = JSON.parse(respStrTemp);  
      if(jsonData.code == 200)
      {
        getProdInfoCallback(jsonData.params); 
      }
      else
      {
        debugOutput("getProdInfo recv : " + jsonData.action + " with error {code:" + jsonData.code + ", desc:" + jsonData.desc + "}");   
      } 
      respStrTemp = "";       
    } 
  });
  client.on('error', function(e){
    debugOutput("getProdInfo connection error!");
	  debugOutput(e);
    debugOutput("reconnect for getProdInfo");
    setTimeout(getProdInfo,5000);    
  });
  client.on('close', function(){
     debugOutput('getProdInfo connection closed');
  });
}

function getProdInfoCallback(obj)
{
  server.host = obj.serviceHost;                   
  server.port = obj.servicePort;
  
  devInfo.mid = obj.mid; 
  devInfo.workMode = obj.workMode;
  devInfo.tokenType = obj.tokenType;
  devInfo.serviceHost = obj.serviceHost;
  devInfo.servicePort = obj.servicePort; 
  
  login();  
}            
                                
function login()
{
  var login_tpl='{"msgId" : "{msgId}","action" : "devLogin","params" : {"devTid" : "{devTid}","prodKey" : "{prodKey}","token" : "{token}"}}\n'; 
  var login_str=login_tpl.replace('{msgId}',getMsgId()).replace('{devTid}',device.devTid).replace('{prodKey}',device.prodKey).replace('{token}',getDevToken(localStorage,devTokenKey));  
  device.mainTCPLink = net.connect(server, function(){ 
    debugOutput("main TCP connected!");  
    debugOutput('CONNECTED TO : ' + server.host + ':' + server.port);	
    debugOutput('main send devLogin : ' + login_str);
    device.mainTCPLink.write(login_str);	
  });
  loginBind(device.mainTCPLink);
}

function loginBind(client)
{
  client.on('data', function(data){
    respStrTemp += data;
    if(isRespComplete(respStrTemp) == 1)
    {
      var jsonData = JSON.parse(respStrTemp);
      if(jsonData != undefined)
      { 
        parseData(jsonData);
      }
      respStrTemp = ""; 
     }     
  });

  client.on('error', function(e){
    debugOutput("main connection error!");
	  debugOutput(e);
  });

  client.on('close', function(){
    debugOutput('main connection closed');
    clearInterval(device.heartbeatIntervalID);
    device.mainTCPLinkReady = false;
    heartbeatRespFlag = 0;    
    debugOutput("reconnect for login");
    setTimeout(login,5000);
  });  
}

function reportDevInfo(devinfo,tcplink)
{
  var reportDevInfo_tpl='{"msgId" : "{msgId}","action" : "reportDevInfo","params" : {devInfo}}\n'; 
  var reportDevInfo_str=reportDevInfo_tpl.replace('{msgId}',getMsgId()).replace('{devInfo}',JSON.stringify(devinfo));
  debugOutput('main send reportDevInfo : ' + reportDevInfo_str);
  tcplink.write(reportDevInfo_str);
}

function parseData(jsonData)  
{
  switch(jsonData.action){
    case "heartbeatResp":
      if(jsonData.code == 200)
      {
        heartbeatRespFlag = 0;
        debugOutput("main receive : " + jsonData.action + " with msgId " + jsonData.msgId);  
      }
      else
      {
        debugOutput("main receive : " + jsonData.action + " with error {code:" + jsonData.code + ", desc:" + jsonData.desc + "}");   
      }
      break;
    case "devLoginResp": 
      debugOutput("main receive : " + JSON.stringify(jsonData));    
      if(jsonData.code == 200)
      {
        debugOutput("main receive : " + jsonData.action);
        if(jsonData.params.token != getDevToken(localStorage,devTokenKey))
        {
          setDevToken(localStorage,devTokenKey,jsonData.params.token);
          device.token = jsonData.params.token;
          var qrDevBind = qr.image('http://www.hekr.me?action=bind&devTid=' + jsonData.params.devTid + '&bindKey=' + jsonData.params.bindKey, {type: 'png'});
          qrDevBind.pipe(require('fs').createWriteStream('qrDevBind.png'));            
        }
        device.ctrlKey = jsonData.params.ctrlKey;
        device.bindKey = jsonData.params.bindKey;
        device.mainTCPLinkReady = true;        
        reportDevInfo(devInfo,device.mainTCPLink); 
        device.heartbeatIntervalID = setInterval(function(){ 
          if(heartbeatRespFlag == 0)
          {
            heartbeatRespFlag = 1;           
            var msgId = getMsgId(); 
            debugOutput("main send : heartbeat with msgId " + msgId);  
            device.mainTCPLink.write('{"msgId" : ' + msgId + ',"action" : "heartbeat"}\n');
          }
          else
          {
            device.mainTCPLinkReady = false;
            debugOutput("no heartbeat response");
          }
        }, 25000);         
      }
      else
      {
        debugOutput("main receive : " + jsonData.action + " with error {code:" + jsonData.code + ", desc:" + jsonData.desc + "}");   
      }      
      break;
    case "devSendResp":
      if(jsonData.code == 200)
      {
        debugOutput("main receive : " + jsonData.action);
      }
      else
      {
        debugOutput("main receive : " + jsonData.action + " with error {code:" + jsonData.code + ", desc:" + jsonData.desc + "}");   
      }  
      break;
    case "reportDevInfoResp":
      debugOutput("main receive : " + JSON.stringify(jsonData));    
      if(jsonData.code == 200)
      {
        debugOutput("main receive : " + jsonData.action);
      } 
      else
      {
        debugOutput("main receive : " + jsonData.action + " with error {code:" + jsonData.code + ", desc:" + jsonData.desc + "}");   
      }     
      break;
    case "errorResp":
      debugOutput("main receive : " + jsonData.action + " with error {code:" + jsonData.code + ", desc:" + jsonData.desc + "}");  
      break;
    case "appSend":
      debugOutput("main receive : " + jsonData.action);
      var jsonAppSendResp = jsonData;
      jsonAppSendResp.action = "appSendResp";
      jsonAppSendResp.code = 200;
      jsonAppSendResp.desc = "success"; 
      sendData(JSON.stringify(jsonAppSendResp) + '\n',device.mainTCPLink);
      parseAppSend(jsonData);              
      break;
    default:
      debugOutput("main receive : " + JSON.stringify(jsonData));           
  }   
}

function sendData(data,tcplink)
{
  if(device.mainTCPLinkReady == true)
  {
    debugOutput("sendData : " + data);
    tcplink.write(data);   
  } 
  else
  {
    debugOutput("TCP link is not ready!");  
  }
} 

function sendParamsData(data,tcplink)
{
  var send_tpl='{"msgId" : "{msgId}","action" : "devSend","params" : {"devTid" : "{devTid}","appTid" : [],"data" : {{data}}}}\n'; 
  var send_str=send_tpl.replace('{msgId}',getMsgId()).replace('{devTid}',device.devTid).replace('{data}',data); 
  if(device.mainTCPLinkReady == true)
  {
    debugOutput("sendParamsData : " + send_str);
    tcplink.write(send_str);   
  } 
  else
  {
    debugOutput("TCP link is not ready!");  
  }
} 

function getCurrentDateTime()
{
  var date=new Date();
  return date.toLocaleString();
}

function debugOutput(content)
{
  if(debugOutputFlag == true)
  console.log(getCurrentDateTime() + " : " + content);
}

function logOn()
{
  debugOutputFlag = true;
}

function logOff()
{
  debugOutputFlag = false;
}

function startDevice()
{
  device.devTid = getDevTid();
  devInfo.devTid = getDevTid(); 
  getProdInfo();
  deviceFunction();
}

//deviceFunction,parseAppSend,reportStatus这3个函数的内容需要开发者自己完成
function deviceFunction() //具体的设备功能在此函数中完成
{
  process.stdin.setEncoding('utf8');
  process.stdin.on('readable', function(){
    var data = process.stdin.read();
    if(data !== null){
		  data=data.substring(0,data.length-2); //去除\r\n 
      if(data[0]=='e' && data[1]=='v' && data[2]=='a' && data[3]=='l' && data[4]==':')
      {
        console.log(eval(data.substr(5))); //示例：直接在cmd窗口输入或ctrl+v eval:1+1
      }
      else if(data[0]=='d' && data[1]=='a' && data[2]=='t' && data[3]=='a' && data[4]==':')
      {
        sendParamsData(data.substr(5),device.mainTCPLink); //示例：直接在cmd窗口输入或ctrl+v data:"cmdId":1,"power":1  
      }
      else
      {
        if(data.length >0 && device.mainTCPLinkReady == true)
        {
          data=data + '\n';
          sendData(data,device.mainTCPLink); //示例：直接在cmd窗口输入或ctrl+v {"msgId" : 1,"action" : "heartbeat"}
        }
      }
	  }
  });
}

function parseAppSend(jsonData) //根据产品通信协议，解析从云端下发的协议数据
{
  //jsonData是一个对象，可以从中获得协议数据，示例: jsonData.params.data.cmdId, jsonData.params.data.power   
}

function reportStatus(tcplink) //根据产品通信协议，上报设备当前状态
{
  //可以使用sendParamsData发送协议数据给云端，示例: sendParamsData("\"cmdId\":1,\"power\":0",tcplink);         
}

startDevice();
