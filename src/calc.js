import { max, min, limitsText, intersect, x, altMax, M, altTrigger, yTick, plotHours } from './utils';

// Returns map of place to date to date data, which includes hours which is hour to hour data.
export default async function calc(index, days) {

    // Construct the measured data. map[place][date]measured;
    const measuredData = {};
    days.forEach(day =>
        Object.values(day.hours).forEach(places =>
            Object.entries(places).forEach(([place, sources]) => {
                if (!measuredData[place]) {
                    measuredData[place] = {};
                }
                if (sources.uwyo) {
                    measuredData[place][day.text] = sources.uwyo;
                }
            })));

    const data = {};
    days.forEach(day => {
        Object.entries(day.hours).forEach(([hour, places]) => {
            if (!plotHours.includes(parseInt(hour))) {
                return;
            }
            Object.entries(places).forEach(([place, sources]) => {
                const placeInfo = index.Locations.find(loc => loc.name === place);
                if (!placeInfo) {
                    return;
                }
                if (!data[place]) {
                    data[place] = {};
                }
                if (!data[place][day.text]) {
                    data[place][day.text] = {
                        day: day,
                        hours: {},
                    };
                }
                if (measuredData[placeInfo.uwyo_station]) {
                    sources.uwyo = measuredData[placeInfo.uwyo_station][day.text];
                }
                // Calc hourly data.
                data[place][day.text].hours[hour] = calcHourData(placeInfo, hour, sources)
            });
        });
    });

    // Calc daily data.
    Object.values(data).forEach(days => {
        Object.values(days).forEach(dayData => {
            dayData.data = calcDayData(dayData.hours);
        })
    });
    return data;
}

function calcHourData(placeInfo, hour, sources) {
    if (!sources.ims) {
        return {};
    }
    return {
        virtual: sources.noaa ? calcHourSounding(placeInfo, hour, sources.ims, sources.noaa) : null,
        measured: sources.uwyo ? calcHourSounding(placeInfo, hour, sources.ims, sources.uwyo) : null,
    }
}

function calcHourSounding(placeInfo, hour, forecast, soundingData) {
    const data = {
        hour: hour,
        alt: soundingData.Height,
        temp: soundingData.Temp,
        dew: soundingData.Dew,
        t0: forecast.Temp, // Temperature at ground level.
        h0: placeInfo.alt, // Ground altitude.
        windDir: soundingData.WindDir,
        windSpeed: soundingData.WindSpeed,
    }

    // Thermal index calculations.
    function thermalIndex(t0, minAlt) {
        const ti = intersect(data.temp, data.alt, t0, data.h0, M);
        if (ti && ti[1] >= data.h0) {
            return ti[1];
        } else {
            const lastT = data.temp[data.temp.length - 1];
            const lastAlt = data.alt[data.alt.length - 1];
            if (data.h0 + M * (lastT - data.t0) > lastAlt) {
                // Sometimes the temp data is truncated before TI. In this case use the last height
                // as the TI height.
                console.warn('Temp data truncated, TI set to maximal measured height');
                return lastAlt;
            }
            return minAlt;
        }
    }

    data.TIM3 = thermalIndex(data.t0 - 3, data.h0);
    data.TI = thermalIndex(data.t0, data.TIM + 200);

    // Cloud base calculation.
    const dewH0 = intersect(data.alt, data.dew, data.h0, 0, 1);
    if (dewH0) {
        data.cloudBase = 1000.0 / 3 * (data.t0 - dewH0[1]) + data.h0
        if (data.cloudBase < 0) {
            data.cloudBase = null;
        }
    }

    // Calculate the trigger temperature.
    const altTriggerT = intersect(data.alt, data.temp, altTrigger, 0, 1);
    if (altTriggerT) {
        data.trig = x(data.h0, altTriggerT[1], altTrigger)
        data.isTriggered = data.trig <= data.t0
    }

    // Find the maximal altitude value, and get the yTick above it.
    data.maxY = [altMax, data.TI, data.TIM3, data.cloudBase]
        .reduce(max)
    data.maxY = Math.ceil(data.maxY / yTick) * yTick;
    data.minY = Math.floor(data.h0 / yTick) * yTick;

    // Truncate the data values to the maximal altitude value.
    var i = max(data.alt.findIndex(v => v > data.minY) - 1, 0);
    var j = data.alt.findIndex(v => v > data.maxY) + 1;
    if (j !== 0) {
        data.alt = data.alt.slice(i, j);
        data.temp = data.temp.slice(i, j);
        data.dew = data.dew.slice(i, j);
        data.windDir = data.windDir.slice(i, j);
        data.windSpeed = data.windSpeed.slice(i, j);
    }

    return data;
}

function calcDayData(hours) {
    const virtual = [];
    const measured = [];
    Object.values(hours).forEach(hourData => {
        if (hourData.virtual) {
            virtual.push(hourData.virtual);
        }
        if (hourData.measured) {
            measured.push(hourData.measured);
        }
    });
    if (virtual.length === 0) {
        return {
            virtual: [],
            measured: [],
        };
    }
    const TIMax = virtual.map(h => h.TI).reduce(max).toFixed(0);
    const TIM3Max = virtual.map(h => h.TIM3).reduce(max).toFixed(0);
    const cloudBaseMin = virtual.map(h => h.cloudBase).reduce(min).toFixed(0);
    const cloudBaseMax = virtual.map(h => h.cloudBase).reduce(max).toFixed(0);
    const isTriggered = virtual.map(h => h.isTriggered).reduce((a, b) => a || b);
    return {
        virtual,
        measured,
        TIMax,
        TIM3Max,
        isTriggered,
        cloudBaseMin,
        cloudBaseMax,
        TIText: limitsText(TIM3Max, TIMax, ' ft'),
        cloudBaseText: limitsText(cloudBaseMin, cloudBaseMax, 'ft'),
    }
}