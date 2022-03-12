import { intersect, x, M, altTrigger, plotHours } from './utils';
import { DailyData, LocationData, SoundingData, ForecastData, Location, Hour, Sources } from './data';

export interface CalcData {
    [key: Location]: {
        [key: Hour]: CalcHourData;
    };
};

export interface CalcHourData {
    virtual?: HourlyData;
    measured?: HourlyData;
};

export interface HourlyData {
    hour: Hour;
    alt: number[];
    temp: number[];
    dew: number[];
    t0: number;
    h0: number;
    windDir: number[];
    windSpeed: number[];

    TI: number;
    TIM3: number;
    CB: number;
    trig?: number;
    isTriggered: boolean;
}

// Returns map of place to date to date data, which includes hours which is hour to hour data.
export default async function calc(locations: LocationData[], raw: DailyData): Promise<CalcData> {
    // Construct the measured data as map[place]measured.
    const measuredData = new Map<Location, SoundingData>();
    Object.values(raw).forEach(places =>
        Object.entries(places).forEach(([place, sources]) => {
            if (sources.uwyo) {
                measuredData.set(place, sources.uwyo);
            }
        }));

    const data = {} as CalcData;
    Object.entries(raw).forEach(([hour, places]) => {
        if (!plotHours.includes(parseInt(hour))) {
            return;
        }
        Object.entries(places).forEach(([place, sources]) => {
            const placeInfo = locations.find(loc => loc.name === place);
            if (!placeInfo) {
                return;
            }
            if (!data[place]) {
                data[place] = {};
            }
            if (measuredData.has(placeInfo.uwyo_station)) {
                sources.uwyo = measuredData.get(placeInfo.uwyo_station);
            }
            // Calc hourly data.
            data[place][hour] = calcHourData(placeInfo, hour, sources)
        });
    });
    return data;
}

function calcHourData(placeInfo: LocationData, hour: Hour, sources: Sources): CalcHourData {
    if (!sources.ims) {
        return {};
    }
    return {
        virtual: sources.noaa ? calcHourSounding(placeInfo, hour, sources.ims, sources.noaa) : undefined,
        measured: sources.uwyo ? calcHourSounding(placeInfo, hour, sources.ims, sources.uwyo) : undefined,
    }
}

function calcHourSounding(placeInfo: LocationData, hour: Hour, forecast: ForecastData, soundingData: SoundingData): HourlyData {
    const data: HourlyData = {
        hour: hour,
        alt: soundingData.Height,
        temp: soundingData.Temp,
        dew: soundingData.Dew,
        t0: forecast.Temp, // Temperature at ground level.
        h0: placeInfo.alt, // Ground altitude.
        windDir: soundingData.WindDir,
        windSpeed: soundingData.WindSpeed,

        TI: placeInfo.alt,
        TIM3: placeInfo.alt,
        CB: placeInfo.alt,
        isTriggered: false,
    }

    // Thermal index calculations.
    function thermalIndex(t0: number, minAlt: number) {
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
        }
        return minAlt;
    }

    data.TIM3 = thermalIndex(data.t0 - 3, data.h0);
    data.TI = thermalIndex(data.t0, data.h0);

    // Cloud base calculation.
    const dewH0 = intersect(data.alt, data.dew, data.h0, 0, 1);
    if (dewH0) {
        const cb = 1000.0 / 3 * (data.t0 - dewH0[1]) + data.h0
        if (cb > 0) {
            data.CB = cb
        }
    }

    // Calculate the trigger temperature.
    const altTriggerT = intersect(data.alt, data.temp, altTrigger, 0, 1);
    if (altTriggerT) {
        data.trig = x(data.h0, altTriggerT[1], altTrigger)
        data.isTriggered = data.trig <= data.t0
    }
    return data;
}