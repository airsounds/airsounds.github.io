package ims

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/net/html/charset"
)

const forecastPath = "https://ims.data.gov.il/sites/default/files/IMS_001.xml"

type ForecastTime struct {
	time.Time
}

func (c *ForecastTime) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	const format = "2/1/2006 15:04 MST"
	var v string
	d.DecodeElement(&v, &start)
	parse, err := time.Parse(format, v)
	if err != nil {
		return err
	}
	*c = ForecastTime{parse}
	return nil
}

type Forecast struct {
	Name      string  `xml:"LocationMetaData>LocationName"`
	Lat       float32 `xml:"LocationMetaData>LocationLatitude"`
	Long      float32 `xml:"LocationMetaData>LocationLongitude"`
	Elevation float32 `xml:"LocationMetaData>LocationHeight"`
	Forecast  []struct {
		Time      ForecastTime `xml:"ForecastTime"`
		Temp      float32      `xml:"Temperature"`
		RelHum    float32      `xml:"RelativeHumidity"`
		WindSpeed float32      `xml:"WindSpeed"`
		WindDir   float32      `xml:"WindDirection"`
	} `xml:"LocationData>Forecast"`
}

type forecastResponse struct {
	XMLName   xml.Name   `xml:"HourlyLocationsForecast"`
	Forecasts []Forecast `xml:"Location"`
}

func Predict() ([]Forecast, error) {
	resp, err := http.Get(forecastPath)
	if err != nil {
		return nil, fmt.Errorf("fetching forecast: %s", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status: %d", resp.StatusCode)
	}
	defer resp.Body.Close()

	var data forecastResponse
	d := xml.NewDecoder(resp.Body)
	d.CharsetReader = charset.NewReaderLabel
	err = d.Decode(&data)
	return data.Forecasts, err
}
