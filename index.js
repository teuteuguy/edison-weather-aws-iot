const awsIot = require('aws-iot-device-sdk');
const OS = require('os');

const ENVIRONMENT = require('edison-environment');

var env = new ENVIRONMENT(2, 3, 0, 5, 7);

// Load config file
const config = require('./config.json');

console.log('[START] Start of update-ip-in-aws-iot-shadow application');

var configIoT = {
    "keyPath": config.iotKeyPath,
    "certPath": config.iotCertPath,
    "caPath": config.iotCaPath,
    "clientId": config.iotClientId,
    "region": config.iotRegion,
    "host": config.iotEndpoint,
    "reconnectPeriod": 5 //300,
};

var thingState = {
    sensorFrequency: 5
};

console.log('[SETUP] thingShadow state initialized with:', JSON.stringify(thingState));
console.log('[SETUP] Initializing IoT thingShadow with config:');
console.log(configIoT);

var clientTokens = [];

function refreshShadow(toUpdate) {

    console.log('[EVENT] refreshShadow(): Refhreshing the Shadow:');
    console.log(toUpdate);

    var clientTokenUpdate = thingShadow.update(config.iotThingName, {
        state: {
            reported: toUpdate
        }
    });

    // console.log('[EVENT] refreshShadow(): clientTokenUpdate:', clientTokenUpdate);
    if (clientTokenUpdate === null) {
        console.log('[IOT EVENT] refreshShadow(): update shadow failed, operation still in progress:', clientTokenUpdate);
    }

}

function refreshLCD(text) {

    if (text.color) {
        env.lcd.setColor(text.color.r, text.color.g, text.color.b); // blue: 53, 39, 249
    }

    if (text.line1) {
        env.lcd.setCursor(0, 0);
        env.lcd.write(text.line1);
    }
    if (text.line2) {
        env.lcd.setCursor(1, 0);
        env.lcd.write(text.line2);
    }

}

var measureLight = false;
setInterval(function() {

    console.log('[SENSORS EVENT] START');

    var temp = {};
    var refresh = false;
    var refreshTemperature = false;
    var refreshHumidity = false;
    var refreshLight = false;
    var refreshIP = false;

    var ifaces = OS.networkInterfaces();

    if (ifaces[config.interface]) {
        ifaces[config.interface].forEach(function(iface) {
            if (iface.family == 'IPv4') {
                temp.ip = iface.address;
                if (thingState.ip !== temp.ip) {
                    refresh = refreshIP = true;
                }
                thingState.ip = temp.ip;
                refreshLCD({
                    line2: temp.ip
                });
                console.log('[SENSORS EVENT] IP:       ', temp.ip);
            }
        });
    }

    var temperature = env.th02.getTemperature();
    var humidity = env.th02.getHumidity();

    if (temperature !== thingState.temperature) refresh = refreshTemperature = true;
    if (humidity !== thingState.humidity) refresh = refreshHumidity = true;

    thingState.temperature = temperature;
    thingState.humidity = humidity;

    console.log('[SENSORS EVENT] TEMPARURE:', temperature, refreshTemperature ? ' -' : '');
    console.log('[SENSORS EVENT] HUMIDITY: ', humidity, refreshHumidity ? ' -' : '');

    refreshLCD({
        line1: 'T:' + (Math.floor(temperature * 10) / 10) + 'C, H:' + (Math.floor(humidity * 10) / 10)
    });

    var lightRaw = env.light.raw_value();
    var ligthValue = env.light.value();

    if (thingState.light === undefined || lightRaw !== thingState.light.raw) refresh = refreshLight = true;
    if (thingState.light === undefined || ligthValue !== thingState.light.value) refresh = refreshLight = true;

    thingState.light = {
        raw: lightRaw,
        value: ligthValue
    };

    console.log('[SENSORS EVENT] LIGHT:    ', 'raw(' + lightRaw + ') ~= ' + ligthValue + ' lux', refreshLight ? ' -' : '');

    if (refresh) refreshShadow(thingState);

    console.log('[SENSORS EVENT] END');

}, thingState.sensorFrequency * 1000);


var thingShadow = awsIot.thingShadow(configIoT);

thingShadow.on('connect', function() {
    console.log('[IOT EVENT] thingShadow.on(connect): Connection established to AWS IoT');
    console.log('[IOT EVENT] thingShadow.on(connect): Registring to thingShadow');
    thingShadow.register(config.iotThingName, {
        persistentSubscribe: true
    }, function() {
        console.log('[IOT EVENT] thingShadow.register: registered');
        // thingShadow.subscribe('$aws/things/' + config.iotThingName + '/shadow/get/accepted');
        // console.log('[IOT EVENT] thingShadow.register: clientToken:', thingShadow.get(config.iotThingName));
        // refreshShadow(thingState);
    });
});

thingShadow.on('reconnect', function() {
    console.log('[IOT EVENT] thingShadow.on(reconnect) Trying to reconnect to AWS IoT');
});

thingShadow.on('close', function() {
    console.log('[IOT EVENT] thingShadow.on(close) Connection closed');
    console.log('[IOT EVENT] thingShadow.on(close) unregistring to shadow.');
    thingShadow.unregister(config.iotThingName);
});

thingShadow.on('error', function(err) {
    console.error('[IOT EVENT] thingShadow.on(error) error:', err);
    // process.exit();
    throw new Error('[ERROR] Lets crash the node code because of this error.');
});

thingShadow.on('status', function(thingName, status, clientToken, stateObject) {
    console.log('[IOT EVENT] thingShadow.on(status): thingName:', thingName);
    console.log('[IOT EVENT] thingShadow.on(status): status:', status);
    console.log('[IOT EVENT] thingShadow.on(status): clientToken:', clientToken);
    console.log('[IOT EVENT] thingShadow.on(status): stateObject:', JSON.stringify(stateObject));
});

thingShadow.on('message', function(topic, payload) {
    console.log('[IOT EVENT] thingShadow.on(message): on', topic, 'with', payload);
});
thingShadow.on('delta', function(thingName, stateObject) {
    console.log('[IOT EVENT] thingShadow.on(delta): on', thingName, 'with', stateObject);
    if (stateObject.state.sensorFrequency !== undefined) {
        thingState.sensorFrequency = stateObject.state.sensorFrequency;
        refreshShadow({
            sensorFrequency: thingState.sensorFrequency
        });
    }
});
thingShadow.on('timeout', function(thingName, clientToken) {
    console.log('[IOT EVENT] thingShadow.on(timeout): on', thingName, 'with token', clientToken);
});
