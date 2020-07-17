package ims

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/posener/tmplt"
)

type Measurement struct {
	// Time of Forecast
	Time       time.Time
	GroundTemp float32
	DryTemp    float32
	RelHumid   float32
	WindDir    float32
	WindSpeed  float32
}

type Station int

const (
	StationMegido Station = 16
)

var url = tmplt.Text("https://api.ims.gov.il/v1/envista/stations/{{.Station}}/data/daily/{{.Date}}")

type response struct {
	Data []struct {
		DataTime time.Time `json:"datetime"`
		Channels []struct {
			ID    int     `json:"id"`
			Name  string  `json:"name"`
			Value float32 `json:"value"`
		} `json:"channels"`
	} `json:"data"`
}

// According to https://ims.gov.il/sites/default/files/%D7%A4%D7%A7%D7%95%D7%93%D7%95%D7%AA%20API.pdf
func Measure(token string, station Station, date time.Time) ([]Measurement, error) {
	u, err := url.Execute(struct {
		Station Station
		Date    string
	}{
		Station: station,
		Date:    date.Format("2006/01/02"),
	})
	if err != nil {
		return nil, fmt.Errorf("formatting url: %s", err)
	}
	log.Printf("Request URL: %s", u)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %s", err)
	}
	req.Header.Set("Authorization", "ApiToken "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("perform request: %s", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status: %d", resp.StatusCode)
	}

	var data response
	err = json.NewDecoder(resp.Body).Decode(&data)
	if err != nil {
		return nil, fmt.Errorf("decoding response: %s", err)
	}

	var ims []Measurement

	for _, d := range data.Data {
		if d.DataTime.Truncate(time.Hour*3) != d.DataTime {
			log.Printf("Skip time %s", d.DataTime)
			continue
		}
		i := Measurement{Time: d.DataTime}
		for _, ch := range d.Channels {
			switch ch.Name {
			case "TG":
				i.GroundTemp = ch.Value
			case "RH":
				i.RelHumid = ch.Value
			case "TD":
				i.DryTemp = ch.Value
			case "WD":
				i.WindDir = ch.Value
			case "WS":
				i.WindSpeed = ch.Value
			}
		}
		ims = append(ims, i)
	}

	return ims, nil
}
