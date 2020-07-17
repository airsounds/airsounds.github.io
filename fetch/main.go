package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/airsounds/airsounds.github.io/fetch/ims"
	"github.com/airsounds/airsounds.github.io/fetch/noaa"
	"github.com/posener/goaction"
	"github.com/posener/goaction/actionutil"
)

var (
	//goaction:required
	source = flag.String("source", "", "Which source to update")
)

var locations = map[string]struct {
	lat, long float32
	alt       float32
}{
	"megido": {
		lat:  32.6,
		long: 35.23,
		alt:  200,
	},
}

var index struct {
	NoaaStart, NoaaEnd time.Time
	NoaaLastUpdate     time.Time

	IMSStart, IMSEnd time.Time
	IMSLastUpdate    time.Time
}

const (
	noaaForecast = 4 * 24 * time.Hour
	dataDir      = "data"
)

var (
	startOfDay = time.Now().Truncate(24 * time.Hour)
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

	if *source == "noaa" || *source == "" {
		modified = append(modified, runNOAA()...)
	}
	if *source == "ims" || *source == "" {
		modified = append(modified, runIMS()...)
	}

	mustEncodeJson(indexPath, index)

	commit(modified)
}

func runNOAA() (paths []string) {
	for location, info := range locations {
		ns, err := noaa.Get(startOfDay, startOfDay.Add(noaaForecast), info.lat, info.long)
		if err != nil {
			log.Fatalf("Fetching NOAA for %s: %s", location, err)
		}
		for _, n := range ns {
			datePath := n.Time.Format("2006/01/02/15")
			path := filepath.Join(dataDir, datePath, fmt.Sprintf("noaa-%s.json", location))
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
	imss, err := ims.Predict()
	if err != nil {
		log.Fatalf("Fetching IMS: %s", err)
	}
	for _, i := range imss {
		if _, ok := locations[string(i.Name)]; !ok {
			log.Printf("Skipping location: %s", i.Name)
			continue
		}
		for _, f := range i.Forecast {
			if f.Time.Truncate(time.Hour*3) != f.Time.Time {
				continue
			}
			datePath := f.Time.Format("2006/01/02/15")
			path := filepath.Join(dataDir, datePath, fmt.Sprintf("ims-%s.json", i.Name))
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
