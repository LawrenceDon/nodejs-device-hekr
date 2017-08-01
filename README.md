# nodejs-device-hekr
使用nodejs作为设备端接入氦氪云平台

### 必备条件：
* 氦氪云平台的开发者账号(个人开发者认证就可以了)
* nodejs https://nodejs.org/en/download 我使用的nodejs版本为v7.2.0
* nodejs模块node-localstorage https://www.npmjs.com/package/node-localstorage
* nodejs模块qr-image https://www.npmjs.com/package/qr-image

### 使用方法：
根据作品的通信协议，修改device.js的内容

代码开头的位置
```javascript
return "NODEJS_" + "SN20170725001" 使用前请修改，这里return的是devTid，其代表设备ID，可以自己定义设备ID规则，devTid的最大长度是32
prodKey:"xxxxxx" 需要填写自己产品的prodKey
```

代码结尾的位置
```javascript
deviceFunction,parseAppSend,reportStatus这3个函数的内容需要开发者自己完成
function deviceFunction() 具体的设备功能在此函数中完成
function parseAppSend(jsonData) 根据产品通信协议，解析从云端下发的协议数据
function reportStatus(tcplink) 根据产品通信协议，上报设备当前状态
```
我为deviceFunction函数编写了默认的功能，脚本运行之后，在CMD窗口可以输入以下形式的数据：
1. **eval:1+1**

     eval:后面可以跟任何的javascript语句，我们可以查看当前脚本中的变量和执行其中的函数。

2. **data:"cmdId":1,"power":1**

     data:后面跟的数据是[氦氪设备云端通信协议](http://docs.hekr.me/v4/%E5%BC%80%E5%8F%91%E6%96%87%E6%A1%A3/%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE/%E8%AE%BE%E5%A4%87%E4%BA%91%E7%AB%AF%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE/)规范中的data部分的内容。

3. **{"msgId" : 1,"action" : "heartbeat"}**

     这样直接输入的JSON字符串必须符合[氦氪设备云端通信协议](http://docs.hekr.me/v4/%E5%BC%80%E5%8F%91%E6%96%87%E6%A1%A3/%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE/%E8%AE%BE%E5%A4%87%E4%BA%91%E7%AB%AF%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE/)规范。

device-example.js使用的产品通信协议来自 [氦氪云入门教程04-基于氦氪主控协议的作品-SDK演示插座](http://bbs.hekr.me/forum.php?mod=viewthread&tid=74&fromuid=1)
实际使用时只需要把devTid和prodKey修改成自己的就可以了。

详细的使用实例请参考
[使用nodejs作为设备端接入氦氪云平台之SDK演示插座](http://bbs.hekr.me/forum.php?mod=viewthread&tid=92)

### 注意事项：
* 本程序支持TCP断线重连，路由器断电或者断网恢复之后，TCP会重新连接。

* 本程序中的token是自动维护的，如果设备登录过一次云端，你想在代码中更改devTid或者prodKey的话，则需要手动在CMD窗口输入eval:clearDevToken(localStorage,devTokenKey)清除之前的token，如果该设备已经被绑定，那需要先在APP中将该设备删除掉。
可以使用setDevToken(localStorage,devTokenKey,“yourDevToken”)设置token的值。

### 参考文档：

[氦氪云联网功能组件](http://docs.hekr.me/v4/%E5%BC%80%E5%8F%91%E6%96%87%E6%A1%A3/%E4%BA%91%E7%AB%AFAPI/%E8%AE%BE%E5%A4%87%E8%81%94%E7%BD%91/)

[设备云端通信协议](http://docs.hekr.me/v4/%E5%BC%80%E5%8F%91%E6%96%87%E6%A1%A3/%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE/%E8%AE%BE%E5%A4%87%E4%BA%91%E7%AB%AF%E9%80%9A%E4%BF%A1%E5%8D%8F%E8%AE%AE/)

* 本程序涉及的上行服务指令如下：
  * getProdInfo
  * devLogin
  * reportDevInfo
  * devSend
  * heartbeat

* 本程序涉及的下行服务指令如下：
  * appSend
