export type DailyData = {
    [key: Hour]: {
        [key: Location]: Sources;
    },
};

export type Sources = {
    ims?: ForecastData;
    noaa?: SoundingData;
    uwyo?: SoundingData;
};

export type Hour = string;

export type Location = string;

export interface ForecastData {
    Time: { Time: string; };
    Temp: number;
    RelHum: number;
    WindSpeed: number;
    WindDir: number;
};

export interface SoundingData {
    Time: string;
    Pressure: number[];
    Height: number[];
    Temp: number[];
    Dew: number[];
    WindDir: number[];
    WindSpeed: number[];
}

export type IndexData = {
    Locations: LocationData[];
    NoaaStart: string;
    NoaaEnd: string;
    NoaaLastUpdate: string;
    IMSStart: string;
    IMSEnd: string;
    IMSLastUpdate: string;
    UWYOStart: string;
    UWYOEnd: string
};

export type LocationData = {
    name: string;
    lat: number; // float32
    long: number; // float32
    alt: number; // int
    uwyo_station: string;
};

export type Errorf = (error: Error | null) => void;