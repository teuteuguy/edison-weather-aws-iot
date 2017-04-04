const awsIot = require('aws-iot-device-sdk');

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
    temperature: null,
    humidity: null,
    light: {
        raw: null,
        value: null
    },
    uv: {
        volts: null,
        intensity: null
    },
    text: {
        line1: null,
        line2: null,
        color: {
            r: null,
            g: null,
            b: null
        }
    }
};

console.log('[SETUP] thingShadow state initialized with:');
console.log(thingState);
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
    console.log('clientTokenUpdate:', clientTokenUpdate);
    if (clientTokenUpdate === null) {
        console.log('[EVENT] refreshShadow(): update shadow failed, operation still in progress');
    }

}

function refreshLCD(text) {

    if (text.line1 && text.line2 && text.color) {

        env.lcd.setColor(text.color.r, text.color.g, text.color.b); // blue: 53, 39, 249

        env.lcd.setCursor(0, 0);
        env.lcd.write(text.line1);  
        env.lcd.setCursor(1, 0);
        env.lcd.write(text.line2);

    }

}

const TEMPERATURE_FREQ = 60;
const LIGHT_FREQ = 30;


setInterval(function() {
    var temp = {
        temperature: env.th02.getTemperature(),
        humidity: env.th02.getHumidity()
    };
    console.log('[EVENT] Temperature:', temp.temperature, 'celcius');
    console.log('[EVENT] Humidity:', temp.humidity, '%');
    if (temp.temperature != thingState.temperature || temp.humidity != thingState.humidity) {
        thingState.temperature = temp.temperature;
        thingState.humidity = temp.humidity;
        refreshShadow(temp);
    }
}, TEMPERATURE_FREQ * 1000);

var measureLight = false;
setInterval(function() {

    measureLight = !measureLight;

    if (measureLight) {
        var temp = {
            light: {
                raw: env.light.raw_value(),
                value: env.light.value()
            }
        };
        console.log('[EVENT] Reading Light:', 'raw(' + temp.light.raw + ') ~= ' + temp.light.value + ' lux');
        if (temp.light.raw != thingState.light.raw || temp.light.value != thingState.light.value) {
            thingState.light.raw = temp.light.raw;
            thingState.light.value = temp.light.value;
            refreshShadow(temp);
        }
    } else {
        var temp = {
            uv: {
                volts: env.uv.volts(),
                intensity: env.uv.intensity()
            }
        };
        console.log('[EVENT] Reading UV:', temp.uv.volts, 'V,', temp.uv.intensity, 'mW/m^2');
        if (temp.uv.volts != thingState.uv.volts || temp.uv.intensity != thingState.uv.intensity) {
            thingState.uv.volts = temp.uv.volts;
            thingState.uv.intensity = temp.uv.intensity;
            refreshShadow(temp);
        }
    }

}, LIGHT_FREQ * 1000);




var thingShadow = awsIot.thingShadow(configIoT);

thingShadow.on('connect', function() {
    console.log('[IOT EVENT] thingShadow.on(connect): Connection established to AWS IoT');
    console.log('[IOT EVENT] thingShadow.on(connect): Registring to thingShadow');
    thingShadow.register(config.iotThingName, {
        persistentSubscribe: true
    }, function() {
        console.log('[IOT EVENT] thingShadow.register: registered');
        // thingShadow.subscribe('$aws/things/' + config.iotThingName + '/shadow/get/accepted');
        // console.log('clientToken:', thingShadow.get(config.iotThingName));
        refreshShadow(thingState);
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
    console.log('[IOT EVENT] thingShadow.on(status): stateObject:', stateObject);
});

thingShadow.on('message', function(topic, payload) {
    console.log('[IOT EVENT] thingShadow.on(message): on', topic, 'with', payload);
});
thingShadow.on('delta', function(thingName, stateObject) {
    console.log('[IOT EVENT] thingShadow.on(delta): on', thingName, 'with', stateObject);
    if (stateObject.state.text !== undefined) {
        thingState.text = stateObject.state.text;
        refreshLCD(thingState.text);
        refreshShadow({
            text: thingState.text
        });
    }

});
thingShadow.on('timeout', function(thingName, clientToken) {
    console.log('[IOT EVENT] thingShadow.on(timeout): on', thingName, 'with token', clientToken);
});
