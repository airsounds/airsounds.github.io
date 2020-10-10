package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/airsounds/airsounds.github.io/fetch/ims"
	"github.com/airsounds/airsounds.github.io/fetch/noaa"
	"github.com/airsounds/airsounds.github.io/fetch/uwyo"
	"github.com/posener/goaction"
	"github.com/posener/goaction/actionutil"
)

var (
	//goaction:required
	source = flag.String("source", "", "Which source to update")
)

var timezone, _ = time.LoadLocation("Asia/Jerusalem")

type Location struct {
	Name        string  `json:"name"`
	Lat         float32 `json:"lat"`
	Long        float32 `json:"long"`
	Alt         int     `json:"alt"`
	UWYOStation int     `json:"uwyo_station"`
	IMSName     string  `json:-`
}

var locations = []Location{
	{
		Name:        "megido",
		Lat:         32.597662,
		Long:        35.234076,
		Alt:         200,
		IMSName:     "AFULA NIR HAEMEQ",
		UWYOStation: 40179, // Bet Dagan
	},
	{
		Name:        "sde-teiman",
		Lat:         31.287646,
		Long:        34.722855,
		Alt:         656,
		IMSName:     "BEER SHEVA",
		UWYOStation: 40179, // Bet Dagan
	},
	{
		Name:        "zefat",
		Lat:         32.965719,
		Long:        35.497225,
		Alt:         2559,
		IMSName:     "ZEFAT HAR KENAAN",
		UWYOStation: 40179, // Bet Dagan
	},
	{
		Name:        "bet-shaan",
		Lat:         32.102560,
		Long:        35.197610,
		Alt:         -394,
		IMSName:     "EDEN FARM",
		UWYOStation: 40179, // Bet Dagan
	},
}

var index struct {
	NoaaStart, NoaaEnd time.Time
	NoaaLastUpdate     time.Time

	IMSStart, IMSEnd time.Time
	IMSLastUpdate    time.Time
	Locations        []Location

	UWYOStart, UWYOEnd time.Time
}

const (
	noaaForecast = 4 * 24 * time.Hour
	dataDir      = "data"
)

var (
	startOfDay = time.Now().In(timezone).Truncate(24 * time.Hour)
	indexPath  = filepath.Join(dataDir, "index.json")
)

func init() {
	log.SetFlags(log.Lshortfile | log.Ltime)
	flag.Parse()
}

func main() {
	// List of modified files.
	var modified []string

	mustDecodeJson(indexPath, &index)
	index.Locations = locations

	if *source == "noaa" || *source == "" {
		modified = append(modified, runNOAA()...)
	}
	if *source == "ims" || *source == "" {
		modified = append(modified, runIMS()...)
	}

	if *source == "uwyo" || *source == "" {
		modified = append(modified, runUWYO()...)
	}

	mustEncodeJson(indexPath, index)
	if len(modified) > 0 {
		modified = append(modified, indexPath)
	}

	commit(modified)
}

func runNOAA() (paths []string) {
	for _, loc := range locations {
		ns, err := noaa.Get(startOfDay, startOfDay.Add(noaaForecast), loc.Lat, loc.Long)
		if err != nil {
			log.Fatalf("Fetching NOAA for %s: %s", loc.Name, err)
		}
		for _, n := range ns {
			path := outputPath("noaa", loc.Name, n.Time)
			mustEncodeJson(path, n)
			paths = append(paths, path)

			// Update index
			index.NoaaLastUpdate = time.Now()
			index.NoaaStart = timeMin(index.NoaaStart, n.Time)
			index.NoaaEnd = timeMax(index.NoaaEnd, n.Time)
			log.Printf("Wrote NOAA forcast file %s", path)
		}
	}
	return
}

func runIMS() (paths []string) {
	var locationNames = map[string]string{}
	for _, l := range locations {
		locationNames[l.IMSName] = l.Name
	}
	imss, err := ims.Predict()
	if err != nil {
		log.Fatalf("Fetching IMS: %s", err)
	}
	for _, i := range imss {
		name := locationNames[string(i.Name)]
		if name == "" {
			log.Printf("Skipping unmapped location: %q", i.Name)
			continue
		}

		for _, f := range i.Forecast {
			if f.Time.Truncate(time.Hour*3) != f.Time.Time {
				continue
			}
			path := outputPath("ims", name, f.Time.Time)
			mustEncodeJson(path, f)
			paths = append(paths, path)

			// Update index
			index.IMSStart = timeMin(index.IMSStart, f.Time.Time)
			index.IMSEnd = timeMax(index.IMSEnd, f.Time.Time)
			log.Printf("Wrote IMS forcast file %s", path)
		}
	}

	index.IMSLastUpdate = time.Now()
	return
}

func runUWYO() (paths []string) {
	for _, station := range collectStations() {
		tables, err := uwyo.Fetch(station, time.Now())
		if err != nil {
			log.Fatalf("Fetching UWYO: %s", err)
		}
		for _, table := range tables {
			if table.Time.Truncate(time.Hour*3) != table.Time {
				continue
			}
			path := outputPath("uwyo", strconv.Itoa(station), table.Time)
			mustEncodeJson(path, table)
			paths = append(paths, path)

			// Update index
			index.UWYOStart = timeMin(index.UWYOStart, table.Time)
			index.UWYOEnd = timeMax(index.UWYOEnd, table.Time)
			log.Printf("Wrote UWYO file %s", path)
		}
	}
	return
}

func outputPath(sourceName, locationName string, t time.Time) string {
	return filepath.Join(dataDir, t.Format("2006/01/02/15"), fmt.Sprintf("%s-%s.json", sourceName, locationName))
}

func mustDecodeJson(path string, data interface{}) {
	f, err := os.Open(indexPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return
		}
		log.Fatal(err)
	}
	defer f.Close()
	err = json.NewDecoder(f).Decode(data)
	if err != nil {
		log.Fatal(err)
	}
}

func mustEncodeJson(path string, data interface{}) {
	err := os.MkdirAll(filepath.Dir(path), 0755)
	if err != nil {
		log.Fatal(err)
	}
	f, err := os.Create(path)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	d := json.NewEncoder(f)
	d.SetIndent("  ", "  ")
	err = d.Encode(data)
	if err != nil {
		log.Fatal(err)
	}
}

func commit(paths []string) {
	if !goaction.CI {
		return
	}

	diffs, err := actionutil.GitDiffAll()
	if err != nil {
		log.Fatal("Failed check Git diff:", err)
	}
	if len(diffs) == 0 {
		log.Println("No changes")
		return
	}
	err = actionutil.GitConfig("Forecast Bot", "bot@airsounds.github.io")
	if err != nil {
		log.Fatal(err)
	}
	actionutil.GitCommitPush(paths, "Update forecast data")
}

func timeMin(a, b time.Time) time.Time {
	switch {
	case a == time.Time{}:
		return b
	case b == time.Time{} || a.Before(b):
		return a
	default:
		return b
	}
}

func timeMax(a, b time.Time) time.Time {
	switch {
	case a == time.Time{}:
		return b
	case b == time.Time{} || a.After(b):
		return a
	default:
		return b
	}
}

func collectStations() []int {
	stationsSet := map[int]bool{}
	for _, location := range locations {
		stationsSet[location.UWYOStation] = true
	}
	var stations []int
	for station := range stationsSet {
		stations = append(stations, station)
	}
	return stations
}
