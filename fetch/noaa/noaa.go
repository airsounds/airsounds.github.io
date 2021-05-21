package noaa

import (
	"bufio"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/posener/tmplt"
)

var url = tmplt.Text("https://rucsoundings.noaa.gov/get_soundings.cgi?data_source=GFS&start_year={{.Start.Year}}&start_month_name={{.Start.Month}}&start_mday={{.Start.Day}}&start_hour=0&start_min=0&n_hrs=1.0&fcst_len=shortest&airport={{.Lat}}%2C{{.Long}}&text=Ascii%20text%20%28GSD%20format%29&hydrometeors=false&startSecs={{.Start.Unix}}&endSecs={{.End.Unix}}")

// NOAA forcast information.
type NOAA struct {
	// Time of Forecast
	Time time.Time
	// Pressure in hPa
	Pressure []int
	// Height in feet
	Height []int
	// Temp in Deg C
	Temp []int
	// Dew point in deg C
	Dew []int
	// WindDir in degrees
	WindDir []int
	// WindSpeed in knots
	WindSpeed []int
}

func (n *NOAA) appendFields(fields []string) error {
	if err := appendInt(&n.Pressure, fields[1], 0.1); err != nil {
		return err
	}
	if err := appendInt(&n.Height, fields[2], 3.28084 /* m to ft */); err != nil {
		return err
	}
	if err := appendInt(&n.Temp, fields[3], 0.1); err != nil {
		return err
	}
	if err := appendInt(&n.Dew, fields[4], 0.1); err != nil {
		return err
	}
	if err := appendInt(&n.WindDir, fields[5], 1); err != nil {
		return err
	}
	if err := appendInt(&n.WindSpeed, fields[6], 1); err != nil {
		return err
	}
	return nil
}

func GetDate(date time.Time, lat, long float32) ([]*NOAA, error) {
	// Set date to point on beginning of day.
	start := date.Truncate(24 * time.Hour)
	end := start.Add(24 * time.Hour)
	return Get(start, end, lat, long)
}

func Get(start time.Time, end time.Time, lat, long float32) ([]*NOAA, error) {
	// Time must be a multiple of 3 hours.
	start = start.Truncate(3 * time.Hour)
	end = end.Truncate(3 * time.Hour)

	u, err := url.Execute(struct {
		Start, End time.Time
		Lat, Long  float32
	}{
		// NOAA expects time in UTC.
		Start: start.UTC(),
		End:   end.UTC(),
		Lat:   lat,
		Long:  long,
	})
	if err != nil {
		return nil, err
	}
	log.Printf("Fetching NOAA with URL: %s", u)
	resp, err := http.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if code := resp.StatusCode; code != http.StatusOK {
		return nil, fmt.Errorf("bad status code: %d", code)
	}

	// Valid output is in the format
	//
	// 	GFS 09 h forecast valid for grid point 13.1 nm / 243 deg from 32.6,35.23:
	// 	GFS         21      19      Jun    2020
	// 	   CAPE    231    CIN     -7  Helic  99999     PW     27
	// 	      1  23062  99999  32.50 -35.00  99999  99999
	// 	      2  99999  99999  99999     35  99999  99999
	// 	      3           32.6,35.23            12     kt
	// 	      9  10000     77    225    181    260      9
	// 	      4   9750    297    209    171    265     13

	var (
		scanner = bufio.NewScanner(resp.Body)
		ns      []*NOAA
	)
	for scanner.Scan() {
		line := scanner.Text()
		if len(strings.TrimSpace(line)) == 0 {
			continue
		}
		if forecastHeader1.MatchString(line) {
			scanner.Scan()
			t, err := parseTimeLine(scanner.Text())
			if err != nil {
				return nil, fmt.Errorf("failed parsing time header %q: %s", line, err)
			}
			log.Printf("Found forecast for time: %s", t)
			ns = append(ns, &NOAA{
				Time: t,
			})

			scanner.Scan() // Skip CAPE line
			scanner.Scan() // Skip garbage line
			scanner.Scan() // Skip garbage line
			scanner.Scan() // Skip coords line
			continue
		}
		if len(ns) == 0 {
			continue
		}
		// Update the last forecast item.
		n := ns[len(ns)-1]
		fields := strings.Fields(line)
		if err := n.appendFields(fields); err != nil {
			return nil, fmt.Errorf("failed loading fields %q: %s", fields, err)
		}
	}
	ns = interpolateMissingHours(ns)
	return ns, scanner.Err()
}

func appendInt(a *[]int, s string, scale float32) error {
	v, err := strconv.Atoi(s)
	if err != nil {
		return err
	}
	*a = append(*a, int(float32(v)*scale))
	return nil
}

// Matches regexp headers:
//  GFS analysis valid for grid point 13.1 nm / 243 deg from 32.6,35.23:
//  GFS         0      20      Jun    2020
var (
	forecastHeader1 = regexp.MustCompile("^GFS .* for grid point")
	forecastHeader2 = regexp.MustCompile(`^GFS\s+(\d+)\s+(\d+)\s+(\w+)\s+(\d+)$`)
)

func parseTimeLine(line string) (time.Time, error) {
	timeStr := strings.Join(forecastHeader2.FindStringSubmatch(line)[1:], " ")
	return time.Parse("15 2 Jan 2006", timeStr)
}

func interpolateMissingHours(values []*NOAA) []*NOAA {
	if len(values) == 0 {
		return nil
	}
	out := []*NOAA{values[0]}
	for _, next := range values {
		last := out[len(out)-1]
		for t := last.Time.Add(time.Hour); t.Before(next.Time); t = t.Add(time.Hour) {
			r := float64(t.Hour()-last.Time.Hour()) / float64(next.Time.Hour()-last.Time.Hour())
			out = append(out, &NOAA{
				Time:      t,
				Pressure:  interpolate(r, last.Pressure, next.Pressure),
				Height:    interpolate(r, last.Height, next.Height),
				Temp:      interpolate(r, last.Temp, next.Temp),
				Dew:       interpolate(r, last.Dew, next.Dew),
				WindDir:   interpolate(r, last.WindDir, next.WindDir),
				WindSpeed: interpolate(r, last.WindSpeed, next.WindSpeed),
			})
		}
		out = append(out, next)
	}
	return out
}

func interpolate(r float64, x1 []int, x2 []int) []int {
	if len(x1) != len(x2) {
		panic("not equal len")
	}
	ret := make([]int, len(x1))
	for i := range x1 {
		ret[i] = x1[i] + int(r*float64(x2[i]-x1[i]))
	}
	return ret
}
